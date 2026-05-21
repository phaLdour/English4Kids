'use client';

import { TapCard } from '@e4k/ui';
import type { ActivityItem, AudioAssetMap } from '@e4k/content-schema';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MascotReaction } from '@e4k/ui';
import { useAudio } from '@/lib/audio-client';

type WordBuilderItem = Extract<ActivityItem, { type: 'word_builder' }>;

export interface WordBuilderProps {
  items: WordBuilderItem[];
  ageBand: '6-8' | '9-12';
  audioMap: AudioAssetMap;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange?: (reaction: MascotReaction) => void;
  imageResolver?: (imageConcept: string) => string | undefined;
}

const ADVANCE_MS = 1200;
const PROMPT_DELAY_MS = 800;

export function WordBuilder({
  items,
  ageBand,
  audioMap,
  onItemComplete,
  onActivityComplete,
  onMascotChange,
  imageResolver,
}: WordBuilderProps) {
  const { playPrompt, player } = useAudio();
  const [itemIndex, setItemIndex] = useState(0);
  const firstAttemptCorrectRef = useRef<boolean | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const item = items[itemIndex];

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const playPromptForCurrent = useCallback(() => {
    if (!item) return;
    onMascotChange?.('listening');
    const t = setTimeout(() => {
      playPrompt(item.promptAudio, audioMap);
    }, PROMPT_DELAY_MS);
    timersRef.current.push(t);
  }, [audioMap, item, onMascotChange, playPrompt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: itemIndex is the change-detection trigger; playPromptForCurrent + clearTimers are intentionally re-bound per render
  useEffect(() => {
    firstAttemptCorrectRef.current = null;
    playPromptForCurrent();
    return clearTimers;
  }, [itemIndex, playPromptForCurrent, clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      player?.stopAll();
    };
  }, [clearTimers, player]);

  const advance = useCallback(() => {
    onMascotChange?.('celebrating');
    onItemComplete({ firstAttemptCorrect: firstAttemptCorrectRef.current === true });
    const t = setTimeout(() => {
      onMascotChange?.('idle');
      if (itemIndex + 1 >= items.length) {
        onActivityComplete();
      } else {
        setItemIndex((i) => i + 1);
      }
    }, ADVANCE_MS);
    timersRef.current.push(t);
  }, [itemIndex, items.length, onActivityComplete, onItemComplete, onMascotChange]);

  if (!item) return null;

  const handleWrong = () => {
    if (firstAttemptCorrectRef.current === null) firstAttemptCorrectRef.current = false;
    onMascotChange?.('gentle-hmm');
    const t = setTimeout(() => {
      onMascotChange?.('listening');
      playPrompt(item.promptAudio, audioMap);
    }, 700);
    timersRef.current.push(t);
  };

  const handleCorrect = () => {
    if (firstAttemptCorrectRef.current === null) firstAttemptCorrectRef.current = true;
    advance();
  };

  if (item.variant === 'whole_word_drag') {
    return (
      <WholeWordDrag
        item={item}
        ageBand={ageBand}
        imageResolver={imageResolver}
        onWrong={handleWrong}
        onCorrect={handleCorrect}
      />
    );
  }

  if (item.variant === 'sentence_chunks') {
    return (
      <SentenceChunks
        item={item}
        ageBand={ageBand}
        imageResolver={imageResolver}
        onWrong={handleWrong}
        onCorrect={handleCorrect}
      />
    );
  }

  return (
    <LetterSpell
      item={item}
      imageResolver={imageResolver}
      onWrong={handleWrong}
      onCorrect={handleCorrect}
    />
  );
}

interface VariantProps {
  item: WordBuilderItem;
  imageResolver?: (concept: string) => string | undefined;
  onCorrect: () => void;
  onWrong: () => void;
}

function WholeWordDrag({
  item,
  ageBand,
  imageResolver,
  onCorrect,
  onWrong,
}: VariantProps & { ageBand: '6-8' | '9-12' }) {
  const t = useTranslations();
  const options = item.options ?? [];
  const correctIndex = item.correctIndex ?? 0;
  const [selected, setSelected] = useState<number | null>(null);
  const [wobbleKey, setWobbleKey] = useState(0);
  const imageSrc = item.targetImage ? imageResolver?.(item.targetImage) : undefined;

  return (
    <section
      aria-label={t('activities.wordBuilderAria')}
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
    >
      <p
        aria-live="polite"
        className="text-center text-xl text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('activities.wordBuilderWholeWord')}
      </p>
      <div
        className="flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]"
        style={{ width: 200, height: 200 }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={item.targetWord}
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain' }}
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
            {item.targetWord.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <motion.div
        key={`wobble-${wobbleKey}`}
        animate={wobbleKey > 0 ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="grid grid-cols-2 gap-[var(--space-4)]"
      >
        {options.map((word, idx) => {
          const isCorrect = idx === correctIndex;
          const state =
            selected === idx ? (isCorrect ? 'correct' : 'idle') : 'idle';
          return (
            <TapCard
              key={`wb-${item.id}-opt-${idx}-${word}`}
              label={word}
              isCorrect={isCorrect}
              size={ageBand === '6-8' ? 'young' : 'old'}
              state={state}
              disabled={selected !== null && idx === correctIndex}
              onSelect={(result) => {
                setSelected(idx);
                if (result === 'correct') {
                  onCorrect();
                  return;
                }
                setWobbleKey((k) => k + 1);
                onWrong();
                setTimeout(() => setSelected(null), 700);
              }}
            />
          );
        })}
      </motion.div>
    </section>
  );
}

function LetterSpell({ item, imageResolver, onCorrect, onWrong }: VariantProps) {
  const t = useTranslations();
  // Spaces are visual-only — strip from slot count and target comparison so
  // a `letter_spell` variant with single-char pool tiles never goes out of bounds.
  const targetLetters = item.targetWord.replace(/\s/g, '');
  const pool = item.letterPool ?? Array.from(targetLetters.toLowerCase());
  const slots = targetLetters.length;
  const [placed, setPlaced] = useState<(number | null)[]>(() => Array.from({ length: slots }, () => null));
  const [usedTiles, setUsedTiles] = useState<Set<number>>(() => new Set());
  const [wobbleKey, setWobbleKey] = useState(0);
  const imageSrc = item.targetImage ? imageResolver?.(item.targetImage) : undefined;

  const checked = useRef(false);

  const tryPlace = (tileIdx: number) => {
    if (usedTiles.has(tileIdx)) return;
    const nextSlot = placed.findIndex((p) => p === null);
    if (nextSlot === -1) return;
    const newPlaced = [...placed];
    newPlaced[nextSlot] = tileIdx;
    setPlaced(newPlaced);
    setUsedTiles((s) => new Set(s).add(tileIdx));
  };

  const clearSlot = (slotIdx: number) => {
    const tileIdx = placed[slotIdx];
    if (tileIdx === null || tileIdx === undefined) return;
    const newPlaced = [...placed];
    newPlaced[slotIdx] = null;
    setPlaced(newPlaced);
    setUsedTiles((s) => {
      const next = new Set(s);
      next.delete(tileIdx);
      return next;
    });
  };

  const clearAll = () => {
    setPlaced(Array.from({ length: slots }, () => null));
    setUsedTiles(new Set());
    checked.current = false;
  };

  const allFilled = placed.every((p) => p !== null);

  useEffect(() => {
    if (!allFilled || checked.current) return;
    const t = setTimeout(() => {
      if (checked.current) return;
      checked.current = true;
      const built = placed
        .map((tileIdx) => (tileIdx === null ? '' : pool[tileIdx]))
        .join('');
      if (built.toLowerCase() === targetLetters.toLowerCase()) {
        onCorrect();
      } else {
        setWobbleKey((k) => k + 1);
        onWrong();
        setTimeout(() => {
          checked.current = false;
          setPlaced(Array.from({ length: slots }, () => null));
          setUsedTiles(new Set());
        }, 700);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [allFilled, targetLetters, onCorrect, onWrong, placed, pool, slots]);

  return (
    <section
      aria-label={t('activities.wordBuilderAria')}
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
    >
      <p
        aria-live="polite"
        className="text-center text-xl text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('activities.wordBuilderLetterSpell')}
      </p>
      <div
        className="flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]"
        style={{ width: 200, height: 200 }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={item.targetWord}
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain' }}
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
            {item.targetWord.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <motion.div
        key={`slots-${wobbleKey}`}
        animate={wobbleKey > 0 ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="flex items-center gap-[var(--space-2)]"
      >
        {placed.map((tileIdx, slotIdx) => (
          <button
            key={`slot-${item.id}-${slotIdx}`}
            type="button"
            onClick={() => clearSlot(slotIdx)}
            aria-label={t('activities.wordBuilderSlotAria', { index: slotIdx + 1 })}
            className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95"
            style={{
              width: 56,
              height: 64,
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              color: 'var(--color-ink)',
              border:
                tileIdx === null
                  ? '2px dashed var(--color-muted)'
                  : '2px solid var(--color-primary)',
            }}
          >
            {tileIdx === null ? '' : pool[tileIdx]}
          </button>
        ))}
      </motion.div>
      <div className="flex flex-wrap items-center justify-center gap-[var(--space-3)]">
        {pool.map((letter, idx) => {
          const used = usedTiles.has(idx);
          return (
            <button
              key={`tile-${item.id}-${idx}-${letter}`}
              type="button"
              disabled={used}
              onClick={() => tryPlace(idx)}
              aria-label={t('activities.wordBuilderLetterAria', { letter })}
              className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95 disabled:opacity-30"
              style={{
                width: 56,
                height: 64,
                fontFamily: 'var(--font-display)',
                fontSize: '1.5rem',
                color: 'var(--color-ink)',
                minHeight: 'var(--tap-min-young)',
                minWidth: 'var(--tap-min-young)',
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={clearAll}
        className="rounded-[var(--radius-pill)] bg-transparent px-[var(--space-4)] py-[var(--space-2)] text-[var(--color-mist)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('activities.wordBuilderClear')}
      </button>
    </section>
  );
}

/**
 * Sentence-chunk variant (9-12 band, u3.l4): kid arranges multi-character word
 * tokens (e.g. "a", "bird", "can", "fly") into sentence-order slots. On all
 * slots filled, we join with a single space and compare case-insensitively
 * against `targetWord.trim()`. Wrong-answer UX matches LetterSpell exactly
 * (gentle bounce, mascot gentle-hmm via parent, no red, no shake-of-shame).
 */
function SentenceChunks({
  item,
  ageBand,
  imageResolver,
  onCorrect,
  onWrong,
}: VariantProps & { ageBand: '6-8' | '9-12' }) {
  const t = useTranslations();
  const targetTokens = item.targetWord.trim().split(/\s+/);
  const pool = item.letterPool ?? targetTokens;
  const slots = targetTokens.length;
  const [placed, setPlaced] = useState<(number | null)[]>(() =>
    Array.from({ length: slots }, () => null),
  );
  const [usedTiles, setUsedTiles] = useState<Set<number>>(() => new Set());
  const [wobbleKey, setWobbleKey] = useState(0);
  const imageSrc = item.targetImage ? imageResolver?.(item.targetImage) : undefined;
  const checked = useRef(false);

  // Per spec: chunk tiles min 64px height (6-8) / 48px (9-12). This variant
  // is 9-12 in current content but the prop is honored for future flexibility.
  const tileMinHeight = ageBand === '6-8' ? 64 : 48;

  const tryPlace = (tileIdx: number) => {
    if (usedTiles.has(tileIdx)) return;
    const nextSlot = placed.findIndex((p) => p === null);
    if (nextSlot === -1) return;
    const newPlaced = [...placed];
    newPlaced[nextSlot] = tileIdx;
    setPlaced(newPlaced);
    setUsedTiles((s) => new Set(s).add(tileIdx));
  };

  const clearSlot = (slotIdx: number) => {
    const tileIdx = placed[slotIdx];
    if (tileIdx === null || tileIdx === undefined) return;
    const newPlaced = [...placed];
    newPlaced[slotIdx] = null;
    setPlaced(newPlaced);
    setUsedTiles((s) => {
      const next = new Set(s);
      next.delete(tileIdx);
      return next;
    });
  };

  const clearAll = () => {
    setPlaced(Array.from({ length: slots }, () => null));
    setUsedTiles(new Set());
    checked.current = false;
  };

  const allFilled = placed.every((p) => p !== null);

  useEffect(() => {
    if (!allFilled || checked.current) return;
    const t = setTimeout(() => {
      if (checked.current) return;
      checked.current = true;
      const builtTokens = placed.map((tileIdx) =>
        tileIdx === null ? '' : (pool[tileIdx] ?? ''),
      );
      const built = builtTokens.join(' ').toLowerCase();
      const target = item.targetWord.trim().toLowerCase();
      if (built === target) {
        onCorrect();
      } else {
        setWobbleKey((k) => k + 1);
        onWrong();
        setTimeout(() => {
          checked.current = false;
          setPlaced(Array.from({ length: slots }, () => null));
          setUsedTiles(new Set());
        }, 700);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [allFilled, item.targetWord, onCorrect, onWrong, placed, pool, slots]);

  return (
    <section
      aria-label={t('activities.wordBuilderAria')}
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
    >
      <p
        aria-live="polite"
        className="text-center text-xl text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('activities.wordBuilderSentenceChunks')}
      </p>
      <div
        className="flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-4)] shadow-[var(--shadow-card)]"
        style={{ width: 200, height: 200 }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={item.targetWord}
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            style={{ maxWidth: 160, maxHeight: 160, objectFit: 'contain' }}
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
            {item.targetWord.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <motion.div
        key={`chunk-slots-${wobbleKey}`}
        animate={wobbleKey > 0 ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="flex flex-wrap items-center justify-center gap-[var(--space-2)]"
      >
        {placed.map((tileIdx, slotIdx) => (
          <button
            key={`chunk-slot-${item.id}-${slotIdx}`}
            type="button"
            onClick={() => clearSlot(slotIdx)}
            aria-label={t('activities.wordBuilderSlotAria', { index: slotIdx + 1 })}
            className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] px-[var(--space-3)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95"
            style={{
              minWidth: 72,
              minHeight: tileMinHeight,
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              color: 'var(--color-ink)',
              border:
                tileIdx === null
                  ? '2px dashed var(--color-muted)'
                  : '2px solid var(--color-primary)',
            }}
          >
            {tileIdx === null ? '' : (pool[tileIdx] ?? '')}
          </button>
        ))}
      </motion.div>
      <div className="flex flex-wrap items-center justify-center gap-[var(--space-3)]">
        {pool.map((chunk, idx) => {
          const used = usedTiles.has(idx);
          return (
            <button
              key={`chunk-tile-${item.id}-${idx}-${chunk}`}
              type="button"
              disabled={used}
              onClick={() => tryPlace(idx)}
              aria-label={t('activities.wordBuilderWordAria', { word: chunk })}
              className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-high)] px-[var(--space-3)] shadow-[var(--shadow-card)] transition-transform duration-[var(--motion-fast)] active:scale-95 disabled:opacity-30"
              style={{
                minWidth: 72,
                minHeight: tileMinHeight,
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                color: 'var(--color-ink)',
              }}
            >
              {chunk}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={clearAll}
        className="rounded-[var(--radius-pill)] bg-transparent px-[var(--space-4)] py-[var(--space-2)] text-[var(--color-mist)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('activities.wordBuilderClear')}
      </button>
    </section>
  );
}
