import '@/test-utils/mock-next-intl';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAssetMap } from '@e4k/content-schema';

// JSX without runtime plugin: expose React on global.
(globalThis as { React?: typeof React }).React = React;

// --- Mocks --------------------------------------------------------------

type MicState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'denied'
  | 'error'
  | 'requesting-permission'
  | 'unsupported';

interface MockMicSession {
  state: MicState;
  start: (opts?: { maxDurationMs?: number }) => Promise<void>;
  stop: () => void;
  lastResult: { transcript: string; confidence: number } | null;
  error: string | null;
  isSupported: boolean;
}

const hoisted = vi.hoisted(() => {
  const playPromptMock = vi.fn();
  const stopAllMock = vi.fn();
  const getSettingMock = vi.fn();
  const scorePronunciationMock = vi.fn();
  // Each call to the hook installs a setter; we update via this latch so the
  // component re-renders with new lastResult values.
  const subscribers = new Set<(s: MockMicSession) => void>();
  const baseSession = (): MockMicSession => ({
    state: 'idle',
    start: async () => undefined,
    stop: () => undefined,
    lastResult: null,
    error: null,
    isSupported: true,
  });
  let current: MockMicSession = baseSession();
  return {
    playPromptMock,
    stopAllMock,
    getSettingMock,
    scorePronunciationMock,
    subscribers,
    baseSession,
    getCurrent: (): MockMicSession => current,
    setCurrent: (next: MockMicSession): void => {
      current = next;
      for (const fn of Array.from(subscribers)) fn(next);
    },
    resetCurrent: (): void => {
      current = baseSession();
    },
  };
});

const {
  playPromptMock,
  stopAllMock,
  getSettingMock,
  scorePronunciationMock,
} = hoisted;

vi.mock('@/lib/audio-client', () => ({
  useAudio: () => ({
    player: { stopAll: hoisted.stopAllMock } as unknown,
    ready: true,
    playPrompt: hoisted.playPromptMock,
  }),
}));

vi.mock('@/lib/use-mic-session', () => {
  // Use require inline so React is resolved against the test bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect, useState } = require('react') as typeof import('react');
  return {
    useMicSession: () => {
      const [s, setS] = useState<MockMicSession>(hoisted.getCurrent());
      useEffect(() => {
        hoisted.subscribers.add(setS);
        setS(hoisted.getCurrent());
        return () => {
          hoisted.subscribers.delete(setS);
        };
      }, []);
      return s;
    },
  };
});

vi.mock('@e4k/db', () => ({
  getSetting: hoisted.getSettingMock,
  setSetting: vi.fn(),
}));

vi.mock('@e4k/audio', () => ({
  scorePronunciation: hoisted.scorePronunciationMock,
}));

// Spy on getUserMedia globally (must NOT be called when mic.enabled=false).
const getUserMediaSpy = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: { getUserMedia: getUserMediaSpy },
});

import { SpeakIt } from './SpeakIt';

const audioMap: AudioAssetMap = {
  'vo.milo.sayHello': {
    src: '/audio/sayHello.mp3',
    durationSec: 1,
    transcript: "Your turn! Say 'hello'.",
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
};

const phonemeMap = {
  hello: ['HH', 'AH', 'L', 'OW'],
};

function buildItem(over?: Partial<{
  id: string;
  targetUtterance: string;
  promptAudio: string;
  encouragementSet: string[];
}>) {
  return {
    id: 'u1.l1.a3.i1',
    type: 'speak_it' as const,
    ageBand: '6-8' as const,
    targetUtterance: 'hello',
    promptAudio: 'vo.milo.sayHello',
    promptTranscript: "Your turn! Say 'hello'.",
    attempts: 3,
    scoreThreshold: 0.55,
    encouragementSet: [
      'You got it!',
      'Almost! Listen one more time.',
      "Let's say it together.",
    ],
    ...over,
  };
}

function buildActivity(items = [buildItem()]) {
  return {
    id: 'u1.l1.a3',
    type: 'speak_it' as const,
    title: 'Speak It: Greetings',
    items,
  };
}

function resetMicSession(): void {
  hoisted.resetCurrent();
}

// --- Tests --------------------------------------------------------------

describe('SpeakIt', () => {
  beforeEach(() => {
    playPromptMock.mockReset();
    stopAllMock.mockReset();
    getSettingMock.mockReset();
    scorePronunciationMock.mockReset();
    getUserMediaSpy.mockReset();
    resetMicSession();
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-passes via Listen & Repeat when mic.enabled = false (no getUserMedia)', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return false;
      if (key === 'pronunciation.strictness') return 'normal';
      return fb;
    });

    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();

    await act(async () => {
      render(
        <SpeakIt
          activity={buildActivity()}
          ageBand="6-8"
          audioMap={audioMap}
          phonemeMap={phonemeMap}
          childId="guest"
          onItemComplete={onItemComplete}
          onActivityComplete={onActivityComplete}
        />,
      );
    });

    // Shadow mode plays model twice (~2400ms) then advances (~1200ms).
    await waitFor(
      () => {
        expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
      },
      { timeout: 5000 },
    );
    await waitFor(
      () => {
        expect(onActivityComplete).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
    expect(getUserMediaSpy).not.toHaveBeenCalled();
  });

  it('shows great banner and firstAttemptCorrect=true on a perfect first attempt', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'pronunciation.strictness') return 'normal';
      return fb;
    });
    scorePronunciationMock.mockReturnValue({ score: 90, band: 'great' });

    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();

    await act(async () => {
      render(
        <SpeakIt
          activity={buildActivity()}
          ageBand="6-8"
          audioMap={audioMap}
          phonemeMap={phonemeMap}
          childId="guest"
          onItemComplete={onItemComplete}
          onActivityComplete={onActivityComplete}
        />,
      );
    });

    // Simulate the mic adapter delivering a result. The mock useMicSession
    // is reactive, so this re-renders SpeakIt with new lastResult.
    await act(async () => {
      hoisted.setCurrent({
        ...hoisted.getCurrent(),
        lastResult: { transcript: 'hello', confidence: 0.92 },
        state: 'idle',
      });
    });

    await waitFor(() => {
      expect(scorePronunciationMock).toHaveBeenCalled();
    });

    expect(screen.getByText('You got it!')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
      },
      { timeout: 3000 },
    );
    await waitFor(
      () => {
        expect(onActivityComplete).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
  });

  it('routes a mid-score then a great-score: good banner, then advance with firstAttemptCorrect=false', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'pronunciation.strictness') return 'normal';
      return fb;
    });
    scorePronunciationMock
      .mockReturnValueOnce({ score: 50, band: 'good' })
      .mockReturnValueOnce({ score: 80, band: 'great' });

    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();

    await act(async () => {
      render(
        <SpeakIt
          activity={buildActivity()}
          ageBand="6-8"
          audioMap={audioMap}
          phonemeMap={phonemeMap}
          childId="guest"
          onItemComplete={onItemComplete}
          onActivityComplete={onActivityComplete}
        />,
      );
    });

    // Attempt 1: mid score.
    await act(async () => {
      hoisted.setCurrent({
        ...hoisted.getCurrent(),
        lastResult: { transcript: 'helo', confidence: 0.6 },
        state: 'idle',
      });
    });
    await waitFor(() =>
      expect(screen.getByText('Almost! Listen one more time.')).toBeInTheDocument(),
    );

    // Attempt 2: great. Use a fresh result object so reference inequality
    // triggers the component's lastProcessedRef check.
    await act(async () => {
      hoisted.setCurrent({
        ...hoisted.getCurrent(),
        lastResult: { transcript: 'hello', confidence: 0.9 },
        state: 'idle',
      });
    });
    await waitFor(() => expect(screen.getByText('You got it!')).toBeInTheDocument());

    await waitFor(
      () => {
        expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: false });
      },
      { timeout: 3000 },
    );
    await waitFor(
      () => {
        expect(onActivityComplete).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
  });

  it('auto-passes after 3 failed attempts', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'pronunciation.strictness') return 'normal';
      return fb;
    });
    scorePronunciationMock.mockReturnValue({ score: 20, band: 'try-again' });

    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();

    await act(async () => {
      render(
        <SpeakIt
          activity={buildActivity()}
          ageBand="6-8"
          audioMap={audioMap}
          phonemeMap={phonemeMap}
          childId="guest"
          onItemComplete={onItemComplete}
          onActivityComplete={onActivityComplete}
        />,
      );
    });

    for (let i = 1; i <= 3; i++) {
      await act(async () => {
        hoisted.setCurrent({
          ...hoisted.getCurrent(),
          lastResult: { transcript: `nope-${i}`, confidence: 0.3 },
          state: 'idle',
        });
      });
      await waitFor(() => {
        expect(scorePronunciationMock).toHaveBeenCalledTimes(i);
      });
    }

    expect(screen.getByText("Let's keep going!")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: false });
      },
      { timeout: 3000 },
    );
    await waitFor(
      () => {
        expect(onActivityComplete).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
  });

  it('Skip button advances immediately', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'pronunciation.strictness') return 'normal';
      return fb;
    });

    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();

    await act(async () => {
      render(
        <SpeakIt
          activity={buildActivity()}
          ageBand="6-8"
          audioMap={audioMap}
          phonemeMap={phonemeMap}
          childId="guest"
          onItemComplete={onItemComplete}
          onActivityComplete={onActivityComplete}
        />,
      );
    });

    await act(async () => {
      const skip = screen.getByLabelText('Skip this item');
      fireEvent.click(skip);
    });
    expect(onActivityComplete).toHaveBeenCalled();
  });

  it('renders no banned negative phrasing', async () => {
    getSettingMock.mockImplementation(async (key: string, fb: unknown) => {
      if (key === 'mic.enabled') return true;
      if (key === 'pronunciation.strictness') return 'normal';
      return fb;
    });
    scorePronunciationMock.mockReturnValue({ score: 10, band: 'try-again' });

    await act(async () => {
      render(
        <SpeakIt
          activity={buildActivity()}
          ageBand="6-8"
          audioMap={audioMap}
          phonemeMap={phonemeMap}
          childId="guest"
          onItemComplete={vi.fn()}
          onActivityComplete={vi.fn()}
        />,
      );
    });

    await act(async () => {
      hoisted.setCurrent({
        ...hoisted.getCurrent(),
        lastResult: { transcript: 'no idea', confidence: 0.4 },
        state: 'idle',
      });
    });

    const haystack = document.body.textContent?.toLowerCase() ?? '';
    for (const word of ['wrong', 'incorrect', 'failed', 'bad job']) {
      expect(haystack).not.toContain(word);
    }
  });
});
