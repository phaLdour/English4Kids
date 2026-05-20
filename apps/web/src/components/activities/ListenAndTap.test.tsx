import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAssetMap } from '@e4k/content-schema';
import { ListenAndTap } from './ListenAndTap';

// JSX in this file relies on the React global because vitest is not running
// the React JSX runtime plugin.
(globalThis as { React?: typeof React }).React = React;

const playPromptMock = vi.fn();
const stopAllMock = vi.fn();
const stablePlayer = { stopAll: stopAllMock } as unknown;
const stableAudioReturn = {
  player: stablePlayer,
  ready: true,
  playPrompt: playPromptMock,
};

vi.mock('@/lib/audio-client', () => ({
  useAudio: () => stableAudioReturn,
}));

const audioMap: AudioAssetMap = {
  'prompt.cat': {
    src: '/audio/cat.mp3',
    durationSec: 1,
    transcript: 'Where is the cat?',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
};

function buildItem(id: string) {
  return {
    id,
    type: 'listen_tap' as const,
    ageBand: '6-8' as const,
    promptAudio: 'prompt.cat',
    promptTranscript: 'Where is the cat?',
    options: [
      { imageConcept: 'animals/cat', isCorrect: true },
      { imageConcept: 'animals/dog', isCorrect: false },
    ],
  };
}

describe('ListenAndTap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playPromptMock.mockReset();
    stopAllMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function findOptionButtons() {
    return screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label') !== 'Play the question again');
  }

  it('plays the prompt and fires firstAttemptCorrect=true on first correct tap', () => {
    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();
    act(() => {
      render(
        <ListenAndTap
          items={[buildItem('a')]}
          ageBand="6-8"
          audioMap={audioMap}
          onItemComplete={onItemComplete}
          onActivityComplete={onActivityComplete}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(playPromptMock).toHaveBeenCalled();

    const opts = findOptionButtons();
    expect(opts.length).toBeGreaterThanOrEqual(2);
    const cat = opts[0];
    if (!cat) throw new Error('option buttons missing');
    fireEvent.click(cat);
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onActivityComplete).toHaveBeenCalled();
  });

  it('records firstAttemptCorrect=false when first tap is wrong and replays prompt', () => {
    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();
    render(
      <ListenAndTap
        items={[buildItem('a')]}
        ageBand="6-8"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    const initialCalls = playPromptMock.mock.calls.length;

    const opts = findOptionButtons();
    const dog = opts[1];
    if (!dog) throw new Error('dog option missing');
    fireEvent.click(dog);
    expect(onItemComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(playPromptMock.mock.calls.length).toBeGreaterThan(initialCalls);

    const after = findOptionButtons();
    const cat = after[0];
    if (!cat) throw new Error('cat option missing after wrong');
    fireEvent.click(cat);
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: false });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onActivityComplete).toHaveBeenCalled();
  });
});
