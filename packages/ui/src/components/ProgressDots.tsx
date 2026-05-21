'use client';

import { cn } from '../utils/cn';

export interface ProgressDotsProps {
  total: number;
  current: number;
  label?: string;
  className?: string;
}

export function ProgressDots({
  total,
  current,
  label = 'Activity progress',
  className,
}: ProgressDotsProps) {
  const safeTotal = Math.max(1, Math.floor(total));
  const safeCurrent = Math.min(Math.max(0, Math.floor(current)), safeTotal);

  return (
    // biome-ignore lint/a11y/useFocusableInteractive: progressbar is a non-interactive status indicator (per WAI-ARIA 1.2); making it focusable would mislead AT users into thinking it accepts input
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={safeCurrent}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      className={cn('flex items-center gap-[var(--space-2)]', className)}
    >
      {Array.from({ length: safeTotal }).map((_, index) => {
        const isCompleted = index < safeCurrent;
        const isCurrent = index === safeCurrent;
        return (
          <span
            key={`dot-${index}-${safeTotal}`}
            aria-hidden="true"
            className="block h-3 w-3 rounded-[var(--radius-pill)] transition-colors duration-[var(--motion-base)]"
            style={{
              backgroundColor: isCompleted
                ? 'var(--color-success)'
                : isCurrent
                  ? 'var(--color-primary)'
                  : 'transparent',
              border: isCurrent
                ? '2px solid var(--color-primary)'
                : isCompleted
                  ? 'none'
                  : '2px solid var(--color-muted)',
            }}
          />
        );
      })}
    </div>
  );
}
