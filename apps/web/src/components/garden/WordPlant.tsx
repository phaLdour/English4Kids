'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@e4k/ui';
import type { LeitnerBox } from '@e4k/game-engine';
import { wordGardenStage, type GardenStage } from '@e4k/game-engine';
import { useTranslations } from 'next-intl';

export interface WordPlantProps {
  word: string;
  box: LeitnerBox;
  /** Pixel size of the bounding box. */
  size?: number;
  onTap?: (word: string) => void;
}

const BLOOM_PALETTE = [
  'var(--color-sunflower)',
  'var(--color-coral)',
  'var(--color-primary)',
  'var(--color-milo)',
  'var(--color-luna)',
] as const;

/** Stable color choice from word text so the same word always blooms the same. */
function bloomColorFor(word: string): string {
  let hash = 0;
  for (let i = 0; i < word.length; i += 1) {
    hash = (hash * 31 + word.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % BLOOM_PALETTE.length;
  return BLOOM_PALETTE[idx] ?? BLOOM_PALETTE[0] ?? 'var(--color-sunflower)';
}

function useStageLabels(): Record<GardenStage, string> {
  const t = useTranslations();
  return {
    seed: t('garden.stageSeedShort'),
    sprout: t('garden.stageSproutShort'),
    bud: t('garden.stageBudShort'),
    bloom: t('garden.stageBloomShort'),
    star: t('garden.stageStarShort'),
  };
}

/**
 * Per-stage SVG rendering. All stages share the same SVG viewbox so swapping
 * stages animates smoothly. Each stage is a small inline SVG — no external
 * assets so the garden works fully offline.
 */
function StageGraphic({
  stage,
  bloomColor,
}: {
  stage: GardenStage;
  bloomColor: string;
}) {
  if (stage === 'seed') {
    return (
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <circle cx="32" cy="48" r="14" fill="var(--color-muted)" opacity="0.4" />
        <circle cx="32" cy="48" r="6" fill="var(--color-primary)">
          <animate
            attributeName="r"
            values="6;7;6"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    );
  }
  if (stage === 'sprout') {
    return (
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <circle cx="32" cy="56" r="6" fill="var(--color-muted)" />
        <path
          d="M32 56 C 32 44 24 38 18 40 C 22 46 28 50 32 50"
          fill="var(--color-success)"
        />
        <path
          d="M32 56 C 32 44 40 38 46 40 C 42 46 36 50 32 50"
          fill="var(--color-success)"
        />
        <line x1="32" y1="56" x2="32" y2="44" stroke="var(--color-success)" strokeWidth="2" />
      </svg>
    );
  }
  if (stage === 'bud') {
    return (
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <circle cx="32" cy="56" r="6" fill="var(--color-muted)" />
        <line x1="32" y1="56" x2="32" y2="30" stroke="var(--color-success)" strokeWidth="3" />
        <path
          d="M32 36 C 22 36 18 32 18 28 C 26 28 32 32 32 36"
          fill="var(--color-success)"
        />
        <ellipse cx="32" cy="22" rx="8" ry="12" fill={bloomColor} opacity="0.85" />
      </svg>
    );
  }
  if (stage === 'bloom') {
    return (
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
        <circle cx="32" cy="56" r="6" fill="var(--color-muted)" />
        <line x1="32" y1="56" x2="32" y2="32" stroke="var(--color-success)" strokeWidth="3" />
        <path
          d="M32 38 C 22 38 18 34 18 30 C 26 30 32 34 32 38"
          fill="var(--color-success)"
        />
        <g transform="translate(32 22)">
          <circle r="8" fill={bloomColor} cx="0" cy="-10" />
          <circle r="8" fill={bloomColor} cx="9" cy="-3" />
          <circle r="8" fill={bloomColor} cx="6" cy="9" />
          <circle r="8" fill={bloomColor} cx="-6" cy="9" />
          <circle r="8" fill={bloomColor} cx="-9" cy="-3" />
          <circle r="5" fill="var(--color-sunflower)" cx="0" cy="0" />
        </g>
      </svg>
    );
  }
  // star
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <polygon
        points="32,6 39,24 58,24 43,36 49,55 32,44 15,55 21,36 6,24 25,24"
        fill="var(--color-sunflower)"
        stroke="var(--color-primary-dark)"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Reusable plant tile. Used by WordGarden grid + standalone in summaries.
 */
export function WordPlant({ word, box, size = 96, onTap }: WordPlantProps) {
  const prefersReduced = usePrefersReducedMotion();
  const t = useTranslations();
  const stageLabel = useStageLabels();
  const stage = wordGardenStage(box);
  const bloomColor = bloomColorFor(word);
  const label = t('garden.plantAria', { word, stage: stageLabel[stage] });

  const content = (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
      }}
    >
      <div style={{ width: size * 0.75, height: size * 0.75 }}>
        <StageGraphic stage={stage} bloomColor={bloomColor} />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.85rem',
          color: 'var(--color-ink)',
          textAlign: 'center',
          maxWidth: size,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {word}
      </span>
    </div>
  );

  if (onTap) {
    return (
      <motion.button
        type="button"
        aria-label={label}
        data-stage={stage}
        onClick={() => onTap(word)}
        initial={prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          prefersReduced
            ? { duration: 0 }
            : { type: 'spring', stiffness: 240, damping: 18 }
        }
        whileTap={prefersReduced ? undefined : { scale: 0.95 }}
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      role="img"
      aria-label={label}
      data-stage={stage}
      initial={prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { type: 'spring', stiffness: 240, damping: 18 }
      }
    >
      {content}
    </motion.div>
  );
}
