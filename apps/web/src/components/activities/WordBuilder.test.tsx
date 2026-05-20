import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAssetMap } from '@e4k/content-schema';
import { WordBuilder } from './WordBuilder';

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
    transcript: 'Tap the word cat',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
};

function buildItem() {
  return {
    id: 'wb-cat',
    type: 'word_builder' as const,
    ageBand: '6-8' as const,
    variant: 'whole_word_drag' as const,
    targetWord: 'cat',
    options: ['cat', 'dog'],
    correctIndex: 0,
    promptAudio: 'prompt.cat',
    promptTranscript: 'Tap the word cat',
  };
}

describe('WordBuilder whole_word_drag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playPromptMock.mockReset();
    stopAllMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('completes on correct tap', () => {
    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();
    render(
      <WordBuilder
        items={[buildItem()]}
        ageBand="6-8"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    const cat = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-label') === 'cat',
    );
    if (!cat) throw new Error('cat option missing');
    fireEvent.click(cat);
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onActivityComplete).toHaveBeenCalled();
  });

  it('does not complete on wrong tap and tracks first-attempt as incorrect', () => {
    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();
    render(
      <WordBuilder
        items={[buildItem()]}
        ageBand="6-8"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    const dog = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-label') === 'dog',
    );
    if (!dog) throw new Error('dog option missing');
    fireEvent.click(dog);
    expect(onItemComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    const cat = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-label') === 'cat',
    );
    if (!cat) throw new Error('cat option missing after wrong');
    fireEvent.click(cat);
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: false });
  });
});
