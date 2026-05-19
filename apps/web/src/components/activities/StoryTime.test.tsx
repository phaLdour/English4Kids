import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAssetMap } from '@e4k/content-schema';
import { StoryTime } from './StoryTime';

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

vi.mock('@e4k/db', () => ({
  getSetting: vi.fn(async (_key: string, fallback: unknown) => fallback),
  setSetting: vi.fn(async () => undefined),
}));

const audioMap: AudioAssetMap = {
  'vo.test.p1': {
    src: '/a/p1.mp3',
    durationSec: 1,
    transcript: 'Panel one narration.',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
  'vo.test.p2': {
    src: '/a/p2.mp3',
    durationSec: 1,
    transcript: 'Panel two narration.',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
  'vo.test.p3': {
    src: '/a/p3.mp3',
    durationSec: 1,
    transcript: 'Panel three narration.',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
  'vo.test.p4': {
    src: '/a/p4.mp3',
    durationSec: 1,
    transcript: 'Panel four narration.',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
  'vo.test.q1': {
    src: '/a/q1.mp3',
    durationSec: 1,
    transcript: 'What happened first?',
    type: 'narration',
    license: 'CC0',
    lang: 'en-US',
  },
};

const storyDoc = {
  id: 'story.test',
  title: 'Test Story',
  ageBand: '6-8' as const,
  panels: [
    {
      panelId: 'p1',
      imageConcept: 'img.test.p1',
      narrationAudio: 'vo.test.p1',
      narrationText: 'Hello there.',
      karaokeHighlights: [],
      duration: 2,
    },
    {
      panelId: 'p2',
      imageConcept: 'img.test.p2',
      narrationAudio: 'vo.test.p2',
      narrationText: 'How are you.',
      karaokeHighlights: [],
      duration: 2,
    },
    {
      panelId: 'p3',
      imageConcept: 'img.test.p3',
      narrationAudio: 'vo.test.p3',
      narrationText: 'I am fine.',
      karaokeHighlights: [],
      duration: 2,
    },
    {
      panelId: 'p4',
      imageConcept: 'img.test.p4',
      narrationAudio: 'vo.test.p4',
      narrationText: 'Bye.',
      karaokeHighlights: [],
      duration: 2,
    },
  ],
  questions: [
    {
      id: 'q1',
      type: 'story_question' as const,
      questionType: 'multiple_choice' as const,
      ageBand: '6-8' as const,
      promptAudio: 'vo.test.q1',
      promptTranscript: 'What did they say first?',
      items: ['Hello', 'Bye'],
      correctIndex: 0,
    },
  ],
};

function buildItem() {
  return {
    id: 'st-item-1',
    type: 'story_time' as const,
    ageBand: '6-8' as const,
    storyId: 'story.test',
    panels: storyDoc.panels,
    questions: storyDoc.questions,
  };
}

describe('StoryTime', () => {
  beforeEach(() => {
    playPromptMock.mockReset();
    stopAllMock.mockReset();
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => storyDoc,
    }));
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('walks through panels, answers question, and completes', async () => {
    const onItemComplete = vi.fn();
    const onActivityComplete = vi.fn();
    render(
      <StoryTime
        items={[buildItem()]}
        ageBand="6-8"
        audioMap={audioMap}
        onItemComplete={onItemComplete}
        onActivityComplete={onActivityComplete}
      />,
    );

    // Wait for story fetch + first panel render.
    const next1 = await screen.findByRole('button', { name: /next/i });
    expect(next1).toBeInTheDocument();

    // Advance through 4 panels.
    fireEvent.click(next1);
    const next2 = await screen.findByRole('button', { name: /next/i });
    fireEvent.click(next2);
    const next3 = await screen.findByRole('button', { name: /next/i });
    fireEvent.click(next3);
    const finish = await screen.findByRole('button', { name: /finish/i });
    fireEvent.click(finish);

    // Question phase.
    const helloOpt = await screen.findByRole('button', { name: 'Hello' });
    await act(async () => {
      fireEvent.click(helloOpt);
    });
    await waitFor(() => {
      expect(onItemComplete).toHaveBeenCalledWith({ firstAttemptCorrect: true });
    });
    await waitFor(() => {
      expect(onActivityComplete).toHaveBeenCalled();
    });
  });
});
