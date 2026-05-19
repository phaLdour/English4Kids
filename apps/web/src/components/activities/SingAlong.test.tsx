import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAssetMap } from '@e4k/content-schema';
import { SingAlong } from './SingAlong';

(globalThis as { React?: typeof React }).React = React;

const playPromptMock = vi.fn();
const stopAllMock = vi.fn();
const playMusicMock = vi.fn();
const stablePlayer = { stopAll: stopAllMock, playMusic: playMusicMock } as unknown;
const stableAudioReturn = {
  player: stablePlayer,
  ready: true,
  playPrompt: playPromptMock,
};

vi.mock('@/lib/audio-client', () => ({
  useAudio: () => stableAudioReturn,
}));

vi.mock('@e4k/db', () => ({
  getSetting: vi.fn(async (_key: string, fallback: unknown) => fallback),
  setSetting: vi.fn(async () => undefined),
}));

const songDoc = {
  id: 'song.test',
  title: 'Test Song',
  lrc:
    '[00:00.00]Hello hello hello\n' +
    '[00:04.00]Sing along with me\n' +
    '[00:08.00]Smile so bright\n',
  audioRef: 'mus.test',
  targetVocabRefs: ['vocab.hello'],
  tprMoves: [
    { ageBand: '6-8' as const, move: 'wave_hand', cueTime: 0 },
  ],
};

const audioMap: AudioAssetMap = {
  'mus.test': {
    src: '/audio/song.mp3',
    durationSec: 12,
    transcript: 'song audio',
    type: 'music',
    license: 'CC0',
    lang: 'en-US',
  },
};

function buildItem() {
  return {
    id: 'sa-1',
    type: 'sing_along' as const,
    ageBand: '6-8' as const,
    songId: 'song.test',
  };
}

describe('SingAlong', () => {
  beforeEach(() => {
    playPromptMock.mockReset();
    stopAllMock.mockReset();
    playMusicMock.mockReset();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => songDoc,
    }));
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders lyrics and completes on Done tap', async () => {
    const onComplete = vi.fn();
    const onItemComplete = vi.fn();
    render(
      <SingAlong
        items={[buildItem()]}
        ageBand="6-8"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onComplete}
      />,
    );

    // Wait for lyrics to appear.
    await screen.findByText(/Test Song/i);
    await waitFor(() => {
      expect(screen.getByLabelText(/Lyrics/i)).toBeInTheDocument();
    });

    const done = await screen.findByRole('button', { name: /done/i });
    fireEvent.click(done);
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
    expect(onComplete).toHaveBeenCalled();
  });
});
