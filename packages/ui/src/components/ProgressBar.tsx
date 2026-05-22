'use client';

/**
 * Sprint 7 — ProgressBar.
 *
 * Soft pill progress bar — replaces ProgressDots in the lesson player
 * (children see one continuous visual, not a row of dots). The component
 * is intentionally minimal: a single percentage, an aria-valuenow, and a
 * soft fill animation.
 */

import { cn } from '../utils/cn';

export interface ProgressBarProps {
  /** 0-1 value. Clamped. */
  value: number;
  /** aria-label for screen readers. */
  label?: string;
  tone?: 'primary' | 'success' | 'milo';
  className?: string;
}

const TONE_BG: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  milo: 'var(--color-milo)',
};

export function ProgressBar({ value, label, tone = 'primary', className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: progressbar is a status role, not interactive.
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className={cn(
        'relative h-3 w-full overflow-hidden rounded-[var(--radius-button)] bg-[var(--color-surface)]',
        className,
      )}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{
          width: `${pct}%`,
          backgroundColor: TONE_BG[tone],
        }}
      />
    </div>
  );
}
