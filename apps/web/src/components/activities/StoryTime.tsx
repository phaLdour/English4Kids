'use client';

import { TapCard } from '@e4k/ui';
import type {
  ActivityItem,
  AudioAssetMap,
  StoryPanel,
  StoryQuestion,
} from '@e4k/content-schema';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MascotReaction } from '@e4k/ui';
import { useAudio } from '@/lib/audio-client';
import { getSetting } from '@e4k/db';
import { activityMessages } from './messages';
import { WordHighlighter } from './WordHighlighter';

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

interface StoryDoc {
  id: string;
  title: string;
  ageBand: '6-8' | '9-12';
  panels: StoryPanel[];
  questions: StoryQuestion[];
}

type Phase = 'panels' | 'question' | 'done';

const ADVANCE_AFTER_CORRECT_MS = 900;
const NARRATION_SPEED_DEFAULT = 1.0;

/**
 * Tokenize narration text into word + whitespace + punctuation runs so we can
 * highlight the word tokens karaoke-style while preserving original spacing.
 */
interface Token {
  text: string;
  isWord: boolean;
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const re = /\s+|[^\s\w']+|[\w']+/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop.
  while ((m = re.exec(text)) !== null) {
    const t = m[0];
    const isWord = /[\w']/.test(t);
    out.push({ text: t, isWord });
  }
  return out;
}

function speakWord(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    synth.cancel();
    synth.speak(u);
  } catch {
    // Speech synthesis unavailable; tap is a no-op.
  }
}

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
  const filteredItems = useMemo(
    () => items.filter((i) => i.ageBand === ageBand || items.length === 1),
    [items, ageBand],
  );
  // Always at least one item available — fallback to first if filter excludes all.
  const effectiveItems = filteredItems.length > 0 ? filteredItems : items;

  const [itemIndex, setItemIndex] = useState(0);
  const [story, setStory] = useState<StoryDoc | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [panelIndex, setPanelIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('panels');
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(ageBand === '6-8');
  const [narrationSpeed, setNarrationSpeed] = useState<number>(NARRATION_SPEED_DEFAULT);
  const [sequenceOrder, setSequenceOrder] = useState<number[]>([]);
  const [sequencePicks, setSequencePicks] = useState<number[]>([]);
  const [wobbleKey, setWobbleKey] = useState(0);
  const questionAttemptsRef = useRef<boolean[]>([]);
  const lastPlayedRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const panelStartRef = useRef<number>(0);
  const panelPausedAtRef = useRef<number | null>(null);

  const item = effectiveItems[itemIndex];
  const isYoung = ageBand === '6-8';
  const nextButtonHeight = isYoung ? 80 : 56;

  // Hydrate user preferences (captions, narration speed) from settings.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cap, speed] = await Promise.all([
        getSetting<boolean>('captions.enabled', ageBand === '6-8'),
        getSetting<number>('narration.speed', NARRATION_SPEED_DEFAULT),
      ]);
      if (cancelled) return;
      setCaptionsEnabled(cap);
      setNarrationSpeed(speed);
    })();
    return () => {
      cancelled = true;
    };
  }, [ageBand]);

  // Fetch the story doc whenever the active item changes.
  useEffect(() => {
    if (!item) return;
    setStory(null);
    setStoryError(null);
    setPanelIndex(0);
    setQuestionIndex(0);
    setPhase('panels');
    setActiveWordIdx(-1);
    questionAttemptsRef.current = [];
    lastPlayedRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/content/stories/${encodeURIComponent(item.storyId)}`,
        );
        if (!res.ok) {
          if (!cancelled) {
            // Fallback: use the embedded panels/questions on the item itself.
            setStory({
              id: item.storyId,
              title: item.storyId,
              ageBand: item.ageBand,
              panels: item.panels,
              questions: item.questions,
            });
          }
          return;
        }
        const json = (await res.json()) as StoryDoc;
        if (!cancelled) setStory(json);
      } catch {
        if (!cancelled) {
          setStory({
            id: item.storyId,
            title: item.storyId,
            ageBand: item.ageBand,
            panels: item.panels,
            questions: item.questions,
          });
          setStoryError('offline');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  const panels = story?.panels ?? [];
  const questions = story?.questions ?? [];
  const panel = panels[panelIndex];
  const question = questions[questionIndex];

  // Karaoke animation: linear fill across the panel's duration.
  useEffect(() => {
    if (phase !== 'panels' || !panel) return;
    const tokens = tokenize(panel.narrationText);
    const wordTokenIndices = tokens
      .map((t, idx) => (t.isWord ? idx : -1))
      .filter((idx) => idx !== -1);
    if (wordTokenIndices.length === 0) {
      setActiveWordIdx(-1);
      return;
    }
    if (paused) return;
    const durationMs = Math.max(800, (panel.duration / narrationSpeed) * 1000);
    panelStartRef.current = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - panelStartRef.current;
      const frac = Math.min(1, elapsed / durationMs);
      const idx = Math.min(
        wordTokenIndices.length - 1,
        Math.floor(frac * wordTokenIndices.length),
      );
      setActiveWordIdx(wordTokenIndices[idx] ?? -1);
      if (frac < 1) {
        raf = requestAnimationFrame(tick);
        rafRef.current = raf;
      }
    };
    raf = requestAnimationFrame(tick);
    rafRef.current = raf;
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, panel, paused, narrationSpeed]);

  // Play narration audio whenever the panel/question changes.
  useEffect(() => {
    if (paused) return;
    if (phase === 'panels' && panel && lastPlayedRef.current !== panel.narrationAudio) {
      lastPlayedRef.current = panel.narrationAudio;
      onMascotChange?.('listening');
      playPrompt(panel.narrationAudio, audioMap);
    } else if (
      phase === 'question' &&
      question &&
      lastPlayedRef.current !== question.promptAudio
    ) {
      lastPlayedRef.current = question.promptAudio;
      onMascotChange?.('thinking');
      playPrompt(question.promptAudio, audioMap);
    }
  }, [phase, panel, question, audioMap, playPrompt, onMascotChange, paused]);

  // Stop audio on unmount.
  useEffect(() => {
    return () => {
      player?.stopAll();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [player]);

  // Initialize sequencing question randomization.
  useEffect(() => {
    if (phase !== 'question' || !question) return;
    if (question.questionType === 'sequencing') {
      const order = question.items.map((_, idx) => idx);
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = order[i] as number;
        order[i] = order[j] as number;
        order[j] = tmp;
      }
      setSequenceOrder(order);
      setSequencePicks([]);
    }
  }, [phase, question]);

  const finishItem = useCallback(() => {
    const correctCount = questionAttemptsRef.current.filter(Boolean).length;
    const total = Math.max(1, questionAttemptsRef.current.length);
    const overallCorrect = correctCount / total >= 0.5;
    onItemComplete({ firstAttemptCorrect: overallCorrect });
    if (itemIndex + 1 >= effectiveItems.length) {
      onActivityComplete();
    } else {
      setItemIndex((i) => i + 1);
    }
  }, [effectiveItems.length, itemIndex, onActivityComplete, onItemComplete]);

  const advancePanel = useCallback(() => {
    if (!story) return;
    if (panelIndex + 1 >= panels.length) {
      if (questions.length === 0) {
        finishItem();
      } else {
        setPhase('question');
      }
    } else {
      setPanelIndex((i) => i + 1);
      setActiveWordIdx(-1);
      lastPlayedRef.current = null;
    }
  }, [story, panelIndex, panels.length, questions.length, finishItem]);

  const advanceQuestion = useCallback(() => {
    if (questionIndex + 1 >= questions.length) {
      finishItem();
    } else {
      setQuestionIndex((i) => i + 1);
      lastPlayedRef.current = null;
    }
  }, [questionIndex, questions.length, finishItem]);

  const handleTogglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (next) {
        player?.stopAll();
        panelPausedAtRef.current = Date.now();
      } else {
        // Resume: shift panel start forward by the paused duration.
        if (panelPausedAtRef.current !== null) {
          panelStartRef.current += Date.now() - panelPausedAtRef.current;
          panelPausedAtRef.current = null;
        }
        lastPlayedRef.current = null;
      }
      return next;
    });
  }, [player]);

  if (!item) return null;

  // Loading state for story doc.
  if (!story && !storyError) {
    return (
      <section
        aria-label="Loading story"
        className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-4)]"
      >
        <p
          aria-live="polite"
          className="text-lg text-[var(--color-mist)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Loading story…
        </p>
      </section>
    );
  }

  if (phase === 'panels' && panel) {
    const tokens = tokenize(panel.narrationText);
    const imageSrc = imageResolver?.(panel.imageConcept);
    return (
      <section
        aria-label="Story panel"
        className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-5)]"
      >
        <div
          aria-hidden={!imageSrc}
          className="relative flex w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-pop)]"
          style={{ maxWidth: 720, aspectRatio: '4 / 3' }}
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
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '4rem',
                color: 'var(--color-mist)',
              }}
            >
              {panelIndex + 1}
            </span>
          )}
          <div
            aria-hidden="true"
            className="absolute bottom-[var(--space-3)] left-[var(--space-3)] flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem' }}
            data-mascot="milo"
            data-reaction={paused ? 'idle' : 'thinking'}
          >
            Milo
          </div>
        </div>
        {captionsEnabled ? (
          <div
            aria-live="polite"
            className="w-full max-w-2xl rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] text-center text-xl text-[var(--color-ink)] shadow-[var(--shadow-card)]"
            style={{ fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
            data-testid="story-caption"
          >
            {tokens.map((t, idx) => {
              // Tokens are stable for a given panel; the panelId+offset gives a
              // unique key without depending on bare list index.
              const tokenKey = `tok-${panel.panelId}-${idx}-${t.text}`;
              if (!t.isWord) {
                return (
                  <span key={tokenKey} aria-hidden="true">
                    {t.text}
                  </span>
                );
              }
              return (
                <WordHighlighter
                  key={tokenKey}
                  text={t.text}
                  isActive={idx === activeWordIdx}
                  onTap={speakWord}
                />
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center gap-[var(--space-3)]">
          <button
            type="button"
            aria-label={paused ? 'Resume story' : 'Pause story'}
            onClick={handleTogglePause}
            className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] px-[var(--space-5)] text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95"
            style={{
              minHeight: nextButtonHeight,
              fontFamily: 'var(--font-display)',
              fontSize: '1.125rem',
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={advancePanel}
            className="flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
            style={{
              minHeight: nextButtonHeight,
              minWidth: nextButtonHeight * 2,
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
            }}
          >
            {panelIndex + 1 >= panels.length
              ? activityMessages.storyTime.finish
              : activityMessages.storyTime.next}
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'question' && question) {
    const tappedFirst = questionAttemptsRef.current[questionIndex];
    if (question.questionType === 'multiple_choice') {
      const correctIndex = question.correctIndex ?? 0;
      return (
        <section
          aria-label={activityMessages.storyTime.question}
          className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-5)]"
        >
          <p
            aria-live="polite"
            className="text-center text-xl text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {question.promptTranscript}
          </p>
          <motion.div
            key={`mc-wobble-${wobbleKey}`}
            animate={
              wobbleKey > 0 ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }
            }
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="grid w-full grid-cols-2 gap-[var(--space-4)]"
          >
            {question.items.map((choice, idx) => (
              <TapCard
                key={`q-${question.id}-opt-${idx}`}
                label={choice}
                isCorrect={idx === correctIndex}
                size={isYoung ? 'young' : 'old'}
                onSelect={(result) => {
                  if (tappedFirst === undefined) {
                    questionAttemptsRef.current[questionIndex] = result === 'correct';
                  }
                  if (result === 'correct') {
                    onMascotChange?.('celebrating');
                    setTimeout(() => {
                      advanceQuestion();
                    }, ADVANCE_AFTER_CORRECT_MS);
                  } else {
                    onMascotChange?.('gentle-hmm');
                    setWobbleKey((k) => k + 1);
                    if (question.promptAudio) {
                      setTimeout(() => {
                        onMascotChange?.('thinking');
                        playPrompt(question.promptAudio, audioMap);
                      }, 600);
                    }
                  }
                }}
              />
            ))}
          </motion.div>
        </section>
      );
    }
    // sequencing — 9-12 only per spec
    const remaining = sequenceOrder.filter((idx) => !sequencePicks.includes(idx));
    return (
      <section
        aria-label={activityMessages.storyTime.question}
        className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-5)]"
      >
        <p
          aria-live="polite"
          className="text-center text-xl text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {question.promptTranscript}
        </p>
        <div
          aria-label="Chosen order"
          className="flex min-h-[60px] w-full flex-wrap items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
        >
          {sequencePicks.length === 0 ? (
            <span className="text-sm text-[var(--color-mist)]">Tap items in order</span>
          ) : (
            sequencePicks.map((idx, slot) => (
              <span
                key={`pick-${slot}-${idx}`}
                className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-[var(--space-3)] py-[var(--space-1)] text-[var(--color-surface-high)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {slot + 1}. {question.items[idx]}
              </span>
            ))
          )}
        </div>
        <motion.div
          key={`seq-wobble-${wobbleKey}`}
          animate={wobbleKey > 0 ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="grid w-full grid-cols-2 gap-[var(--space-3)]"
        >
          {remaining.map((idx) => (
            <button
              key={`opt-${idx}`}
              type="button"
              onClick={() => {
                const nextPicks = [...sequencePicks, idx];
                setSequencePicks(nextPicks);
                if (nextPicks.length === question.items.length) {
                  // Validate against correctOrder
                  const correctOrder = question.correctOrder ?? question.items.map((_, i) => i);
                  const isCorrect = nextPicks.every((v, i) => v === correctOrder[i]);
                  if (tappedFirst === undefined) {
                    questionAttemptsRef.current[questionIndex] = isCorrect;
                  }
                  if (isCorrect) {
                    onMascotChange?.('celebrating');
                    setTimeout(() => advanceQuestion(), ADVANCE_AFTER_CORRECT_MS);
                  } else {
                    onMascotChange?.('gentle-hmm');
                    setWobbleKey((k) => k + 1);
                    setTimeout(() => {
                      setSequencePicks([]);
                      onMascotChange?.('thinking');
                    }, 700);
                  }
                }
              }}
              className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-4)] text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95"
              style={{
                minHeight: 'var(--tap-min-old)',
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
              }}
            >
              {question.items[idx]}
            </button>
          ))}
        </motion.div>
      </section>
    );
  }

  return null;
}
