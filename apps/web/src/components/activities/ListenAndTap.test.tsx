import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAssetMap } from '@e4k/content-schema';
import { ListenAndTap } from './ListenAndTap';

const playPromptMock = vi.fn();
const stopAllMock = vi.fn();

vi.mock('@/lib/audio-client', () => ({
  useAudio: () => ({
    player: { stopAll: stopAllMock } as unknown,
    ready: true,
    playPrompt: playPromptMock,
  }),
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

  it('plays the prompt and fires firstAttemptCorrect=true on first correct tap', () => {
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
    expect(playPromptMock).toHaveBeenCalled();

    const buttons = screen.getAllByRole('button');
    const cat = buttons.find((b) => b.getAttribute('aria-label') === 'animals/cat');
    expect(cat).toBeTruthy();
    if (!cat) return;
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

    const buttons = screen.getAllByRole('button');
    const dog = buttons.find((b) => b.getAttribute('aria-label') === 'animals/dog');
    if (!dog) throw new Error('dog tile missing');
    fireEvent.click(dog);
    expect(onItemComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(playPromptMock.mock.calls.length).toBeGreaterThan(initialCalls);

    const cat = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-label') === 'animals/cat',
    );
    if (!cat) throw new Error('cat tile missing');
    fireEvent.click(cat);
    expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: false });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onActivityComplete).toHaveBeenCalled();
  });
});
