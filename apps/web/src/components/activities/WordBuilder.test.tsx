import '@/test-utils/mock-next-intl';
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

function buildSentenceChunksItem() {
  return {
    id: 'wb-bird-fly',
    type: 'word_builder' as const,
    ageBand: '9-12' as const,
    variant: 'sentence_chunks' as const,
    targetWord: 'a bird can fly',
    letterPool: ['a', 'bird', 'can', 'fly', 'fish', 'swim', 'walk'],
    promptAudio: 'prompt.cat',
    promptTranscript: 'Put the words in order: a bird can fly.',
  };
}

function tapWord(label: string): void {
  const tile = screen
    .getAllByRole('button')
    .find((b) => b.getAttribute('aria-label') === `Word ${label}`);
  if (!tile) throw new Error(`tile for "${label}" not found`);
  fireEvent.click(tile);
}

describe('WordBuilder sentence_chunks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playPromptMock.mockReset();
    stopAllMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders one slot per token in the target sentence (no out-of-bounds)', () => {
    render(
      <WordBuilder
        items={[buildSentenceChunksItem()]}
        ageBand="9-12"
        audioMap={audioMap}
        onItemComplete={vi.fn()}
        onActivityComplete={vi.fn()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    const slots = screen
      .getAllByRole('button')
      .filter((b) => /^Slot \d+$/.test(b.getAttribute('aria-label') ?? ''));
    // "a bird can fly" -> 4 tokens -> 4 slots (NOT 14 chars).
    expect(slots).toHaveLength(4);
  });

  it('completes with firstAttemptCorrect=true when tokens are tapped in order', () => {
    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();
    render(
      <WordBuilder
        items={[buildSentenceChunksItem()]}
        ageBand="9-12"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    tapWord('a');
    tapWord('bird');
    tapWord('can');
    tapWord('fly');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onActivityComplete).toHaveBeenCalled();
  });

  it('records firstAttemptCorrect=false on wrong order then completes on retry', () => {
    const onItemComplete = vi.fn();
    render(
      <WordBuilder
        items={[buildSentenceChunksItem()]}
        ageBand="9-12"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={vi.fn()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    // Wrong order: "a fish can fly" — still 4 distinct tokens so all slots fill.
    tapWord('a');
    tapWord('fish');
    tapWord('can');
    tapWord('fly');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onItemComplete).not.toHaveBeenCalled();
    // After the wobble + reset window, tiles should be re-enabled.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    tapWord('a');
    tapWord('bird');
    tapWord('can');
    tapWord('fly');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: false });
  });
});

function buildLetterSpellItem() {
  return {
    id: 'wb-cat-spell',
    type: 'word_builder' as const,
    ageBand: '9-12' as const,
    variant: 'letter_spell' as const,
    targetWord: 'cat',
    letterPool: ['c', 'a', 't', 'p', 'o'],
    promptAudio: 'prompt.cat',
    promptTranscript: 'Spell: cat.',
  };
}

describe('WordBuilder letter_spell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playPromptMock.mockReset();
    stopAllMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('still renders 3 slots for the 3-letter target', () => {
    render(
      <WordBuilder
        items={[buildLetterSpellItem()]}
        ageBand="9-12"
        audioMap={audioMap}
        onItemComplete={vi.fn()}
        onActivityComplete={vi.fn()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(900);
    });
    const slots = screen
      .getAllByRole('button')
      .filter((b) => /^Slot \d+$/.test(b.getAttribute('aria-label') ?? ''));
    expect(slots).toHaveLength(3);
  });
});
