'use client';

import { TapCard } from '@e4k/ui';
import type { ActivityItem, AudioAssetMap } from '@e4k/content-schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MascotReaction } from '@e4k/ui';
import { useAudio } from '@/lib/audio-client';
import { activityMessages } from './messages';

type StoryTimeItem = Extract<ActivityItem, { type: 'story_time' }>;

export interface StoryTimeProps {
  items: StoryTimeItem[];
  ageBand: '6-8' | '9-12';
  audioMap: AudioAssetMap;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange?: (reaction: MascotReaction) => void;
  imageResolver?: (concept: string) => string | undefined;
}

type Phase = 'panels' | 'question' | 'done';

export function StoryTime({
  items,
  ageBand,
  audioMap,
  onItemComplete,
  onActivityComplete,
  onMascotChange,
  imageResolver,
}: StoryTimeProps) {
  const { playPrompt, player } = useAudio();
  const [itemIndex, setItemIndex] = useState(0);
  const [panelIndex, setPanelIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('panels');
  const firstAttemptCorrectRef = useRef<boolean | null>(null);
  const lastPlayedRef = useRef<string | null>(null);

  const item = items[itemIndex];

  useEffect(() => {
    if (!item) return;
    if (phase === 'panels') {
      const panel = item.panels[panelIndex];
      if (panel && lastPlayedRef.current !== panel.narrationAudio) {
        lastPlayedRef.current = panel.narrationAudio;
        onMascotChange?.('listening');
        playPrompt(panel.narrationAudio, audioMap);
      }
    } else if (phase === 'question') {
      const q = item.questions[questionIndex];
      if (q && lastPlayedRef.current !== q.promptAudio) {
        lastPlayedRef.current = q.promptAudio;
        onMascotChange?.('listening');
        playPrompt(q.promptAudio, audioMap);
      }
    }
  }, [phase, itemIndex, panelIndex, questionIndex, item, audioMap, playPrompt, onMascotChange]);

  useEffect(() => {
    return () => {
      player?.stopAll();
    };
  }, [player]);

  const advanceItem = useCallback(() => {
    if (itemIndex + 1 >= items.length) {
      onActivityComplete();
    } else {
      setItemIndex((i) => i + 1);
      setPanelIndex(0);
      setQuestionIndex(0);
      setPhase('panels');
      firstAttemptCorrectRef.current = null;
      lastPlayedRef.current = null;
    }
  }, [itemIndex, items.length, onActivityComplete]);

  if (!item) return null;

  if (phase === 'panels') {
    const panel = item.panels[panelIndex];
    if (!panel) {
      if (item.questions.length > 0) {
        setPhase('question');
      } else {
        advanceItem();
      }
      return null;
    }
    const imageSrc = imageResolver?.(panel.imageConcept);
    return (
      <section
        aria-label="Story panel"
        className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
      >
        <div
          className="flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-pop)]"
          style={{ width: '100%', maxWidth: 560, aspectRatio: '4 / 3' }}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={panel.imageConcept}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '3rem',
                color: 'var(--color-mist)',
              }}
            >
              {panelIndex + 1}
            </span>
          )}
        </div>
        <p
          aria-live="polite"
          className="text-center text-xl text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {panel.narrationText}
        </p>
        <button
          type="button"
          onClick={() => {
            if (panelIndex + 1 >= item.panels.length) {
              if (item.questions.length > 0) {
                setPhase('question');
              } else {
                advanceItem();
              }
            } else {
              setPanelIndex((i) => i + 1);
            }
          }}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
          style={{
            minHeight: 'var(--tap-primary-young)',
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
          }}
        >
          {panelIndex + 1 >= item.panels.length
            ? activityMessages.storyTime.finish
            : activityMessages.storyTime.next}
        </button>
      </section>
    );
  }

  if (phase === 'question') {
    const q = item.questions[questionIndex];
    if (!q) {
      advanceItem();
      return null;
    }
    return (
      <section
        aria-label={activityMessages.storyTime.question}
        className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
      >
        <p
          aria-live="polite"
          className="text-center text-xl text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {q.promptTranscript}
        </p>
        <div className="grid grid-cols-2 gap-[var(--space-4)]">
          {q.items.map((choice, idx) => {
            const isCorrect = q.questionType === 'multiple_choice'
              ? idx === (q.correctIndex ?? 0)
              : idx === (q.correctOrder?.[0] ?? 0);
            return (
              <TapCard
                key={`q-${q.id}-opt-${idx}`}
                label={choice}
                isCorrect={isCorrect}
                size={ageBand === '6-8' ? 'young' : 'old'}
                onSelect={(result) => {
                  if (firstAttemptCorrectRef.current === null) {
                    firstAttemptCorrectRef.current = result === 'correct';
                  }
                  if (result === 'correct') {
                    onMascotChange?.('celebrating');
                    onItemComplete({
                      firstAttemptCorrect: firstAttemptCorrectRef.current === true,
                    });
                    setTimeout(() => {
                      if (questionIndex + 1 >= item.questions.length) {
                        advanceItem();
                      } else {
                        setQuestionIndex((i) => i + 1);
                        firstAttemptCorrectRef.current = null;
                        lastPlayedRef.current = null;
                      }
                    }, 1000);
                  } else {
                    onMascotChange?.('gentle-hmm');
                    setTimeout(() => onMascotChange?.('listening'), 700);
                  }
                }}
              />
            );
          })}
        </div>
      </section>
    );
  }

  return null;
}
