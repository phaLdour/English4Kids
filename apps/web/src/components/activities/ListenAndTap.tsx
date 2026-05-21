'use client';

import { TapCard, type TapCardSize } from '@e4k/ui';
import type { ActivityItem, AudioAssetMap } from '@e4k/content-schema';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '@/lib/audio-client';
import type { MascotReaction } from '@e4k/ui';

type ListenTapItem = Extract<ActivityItem, { type: 'listen_tap' }>;

export interface ListenAndTapProps {
  items: ListenTapItem[];
  ageBand: '6-8' | '9-12';
  audioMap: AudioAssetMap;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange?: (reaction: MascotReaction) => void;
  imageResolver?: (imageConcept: string) => string | undefined;
}

const IMAGE_REVEAL_MS = 800;
const TEXT_REVEAL_AFTER_AUDIO_MS = 400;
const ADVANCE_AFTER_CORRECT_MS = 1200;

export function ListenAndTap({
  items,
  ageBand,
  audioMap,
  onItemComplete,
  onActivityComplete,
  onMascotChange,
  imageResolver,
}: ListenAndTapProps) {
  const t = useTranslations();
  const { playPrompt, player } = useAudio();
  const [itemIndex, setItemIndex] = useState(0);
  const [textVisible, setTextVisible] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [selectionState, setSelectionState] = useState<
    Record<number, 'idle' | 'correct' | 'wrong'>
  >({});
  const [wobbleKey, setWobbleKey] = useState(0);
  const [locked, setLocked] = useState(false);
  const firstAttemptCorrectRef = useRef<boolean | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const item = items[itemIndex];
  const size: TapCardSize = ageBand === '6-8' ? 'young' : 'old';

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const startAudioCycle = useCallback(() => {
    if (!item) return;
    setTextVisible(false);
    setAudioStarted(false);
    onMascotChange?.('listening');
    const audioEntry = audioMap[item.promptAudio];
    const durationMs = audioEntry?.durationSec != null
      ? Math.max(400, audioEntry.durationSec * 1000)
      : 1500;
    const imageRevealTimer = setTimeout(() => {
      setAudioStarted(true);
      playPrompt(item.promptAudio, audioMap);
      const textTimer = setTimeout(() => {
        setTextVisible(true);
      }, durationMs + TEXT_REVEAL_AFTER_AUDIO_MS);
      timersRef.current.push(textTimer);
    }, IMAGE_REVEAL_MS);
    timersRef.current.push(imageRevealTimer);
  }, [audioMap, item, onMascotChange, playPrompt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemIndex is the change-detection trigger
  useEffect(() => {
    firstAttemptCorrectRef.current = null;
    setSelectionState({});
    setLocked(false);
    startAudioCycle();
    return () => {
      clearTimers();
    };
  }, [itemIndex, startAudioCycle, clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      player?.stopAll();
    };
  }, [clearTimers, player]);

  const handleTap = (optionIndex: number, isCorrect: boolean) => {
    if (!item || locked) return;
    if (firstAttemptCorrectRef.current === null) {
      firstAttemptCorrectRef.current = isCorrect;
    }

    if (isCorrect) {
      setLocked(true);
      setSelectionState((s) => ({ ...s, [optionIndex]: 'correct' }));
      onMascotChange?.('celebrating');
      onItemComplete({ firstAttemptCorrect: firstAttemptCorrectRef.current === true });
      const advanceTimer = setTimeout(() => {
        onMascotChange?.('idle');
        if (itemIndex + 1 >= items.length) {
          onActivityComplete();
        } else {
          setItemIndex((i) => i + 1);
        }
      }, ADVANCE_AFTER_CORRECT_MS);
      timersRef.current.push(advanceTimer);
    } else {
      setSelectionState((s) => ({ ...s, [optionIndex]: 'wrong' }));
      setWobbleKey((k) => k + 1);
      onMascotChange?.('gentle-hmm');
      const resetTimer = setTimeout(() => {
        setSelectionState((s) => {
          const next = { ...s };
          delete next[optionIndex];
          return next;
        });
        onMascotChange?.('listening');
        playPrompt(item.promptAudio, audioMap);
      }, 700);
      timersRef.current.push(resetTimer);
    }
  };

  const gridCols = useMemo(() => {
    if (!item) return 'grid-cols-2';
    return item.options.length > 2 ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-2';
  }, [item]);

  if (!item) return null;

  return (
    <section
      aria-label={t('activities.listenAndTapAria')}
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
    >
      <div className="sr-only" aria-live="polite">
        {audioStarted ? item.promptTranscript : ''}
      </div>
      <button
        type="button"
        onClick={() => playPrompt(item.promptAudio, audioMap)}
        className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{
          minHeight: 'var(--tap-min-young)',
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
        }}
        aria-label={t('activities.listenAndTapReplay')}
      >
        {t('activities.listenAndTapListen')}
      </button>
      <motion.div
        key={`wobble-${wobbleKey}`}
        animate={
          wobbleKey > 0
            ? { x: [0, -8, 8, -6, 6, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className={`grid w-full gap-[var(--space-4)] ${gridCols}`}
      >
        {item.options.map((opt, idx) => {
          const state = selectionState[idx] ?? 'idle';
          const imageSrc = imageResolver?.(opt.imageConcept);
          const label = textVisible ? opt.imageConcept.replace(/^.*\//, '').replace(/[-_]/g, ' ') : '';
          return (
            <div
              key={`${item.id}-opt-${idx}-${opt.imageConcept}`}
              className="flex items-center justify-center"
            >
              <TapCard
                label={label || ' '}
                imageSrc={imageSrc}
                imageAlt={opt.imageConcept}
                isCorrect={opt.isCorrect}
                size={size}
                state={state === 'wrong' ? 'idle' : state}
                disabled={locked}
                onSelect={() => handleTap(idx, opt.isCorrect)}
              />
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
