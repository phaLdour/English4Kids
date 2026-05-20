'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@e4k/ui';
import { useTranslations } from 'next-intl';

export interface StreakPlantProps {
  current: number;
  longest: number;
  freezesAvailable: number;
  variant?: 'home' | 'detail';
}

const MAX_VISUAL_LEAVES = 30;

/**
 * A growing plant that visualizes the streak. Each consecutive day adds a leaf
 * (capped at 30); above 30 days we keep the plant in full form and rely on the
 * number to convey progress.
 *
 * Copy red line: never shame. `current === 0` is welcomed as a sapling, not a
 * loss.
 */
export function StreakPlant({
  current,
  longest,
  freezesAvailable,
  variant = 'home',
}: StreakPlantProps) {
  const prefersReduced = usePrefersReducedMotion();
  const t = useTranslations();
  const visualLeaves = Math.min(current, MAX_VISUAL_LEAVES);
  const dimensions = variant === 'home' ? 96 : 160;
  const leafTransition = prefersReduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 240, damping: 18 };

  const ariaLabel =
    current === 0
      ? freezesAvailable > 0
        ? t('streak.newPlantAriaWithFreezes', { count: freezesAvailable })
        : t('streak.newPlantAria')
      : freezesAvailable > 0
        ? t('streak.ariaWithStreakAndFreezes', {
            count: current,
            longest,
            freezes: freezesAvailable,
          })
        : t('streak.ariaWithStreak', { count: current, longest });

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-variant={variant}
      className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-high)] p-[var(--space-3)] shadow-[var(--shadow-card)]"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      <svg
        viewBox="0 0 120 160"
        width={dimensions}
        height={(dimensions * 160) / 120}
        aria-hidden="true"
      >
        <ellipse cx="60" cy="148" rx="34" ry="8" fill="var(--color-muted)" opacity="0.5" />
        <line
          x1="60"
          y1="148"
          x2="60"
          y2={Math.max(40, 148 - visualLeaves * 4)}
          stroke="var(--color-success)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {Array.from({ length: visualLeaves }, (_, idx) => idx).map((idx) => {
          const y = 140 - idx * 4;
          const side = idx % 2 === 0 ? -1 : 1;
          return (
            <motion.path
              key={`leaf-day-${idx + 1}`}
              initial={prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...leafTransition, delay: prefersReduced ? 0 : idx * 0.02 }}
              d={`M 60 ${y} Q ${60 + side * 14} ${y - 6} ${60 + side * 22} ${y}`}
              fill="var(--color-success)"
              stroke="var(--color-primary-dark)"
              strokeWidth="1"
              opacity="0.9"
            />
          );
        })}
        {current === 0 ? (
          <circle cx="60" cy="142" r="6" fill="var(--color-primary)" />
        ) : null}
      </svg>
      <div className="flex flex-col items-start gap-[var(--space-1)]">
        <span
          className="text-2xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {current === 0 ? t('streak.newPlant') : t('streak.daysActive', { count: current })}
        </span>
        {variant === 'detail' ? (
          <span
            className="text-sm text-[var(--color-mist)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t('streak.longest', { count: longest })}
          </span>
        ) : null}
        {freezesAvailable > 0 ? (
          <span
            className="flex items-center gap-[var(--space-1)] text-sm text-[var(--color-luna)]"
            style={{ fontFamily: 'var(--font-body)' }}
            aria-hidden="true"
          >
            {Array.from({ length: freezesAvailable }, (_, idx) => idx).map((idx) => (
              <svg
                key={`freeze-${idx + 1}-of-${freezesAvailable}`}
                viewBox="0 0 16 24"
                width={14}
                height={20}
                role="img"
                aria-hidden="true"
              >
                <title>{t('streak.freezeIcon')}</title>
                <path
                  d="M 8 0 L 12 8 L 10 8 L 14 24 L 2 24 L 6 8 L 4 8 Z"
                  fill="var(--color-luna)"
                  stroke="var(--color-primary-dark)"
                  strokeWidth="1"
                />
              </svg>
            ))}
            <span>{t('streak.freezes', { count: freezesAvailable })}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
