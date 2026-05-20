'use client';

import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export type StarCount = 1 | 2 | 3;

export interface StarRevealProps {
  count: StarCount;
  wasReplay?: boolean;
  className?: string;
}

export function StarReveal({ count, wasReplay = false, className }: StarRevealProps) {
  const prefersReduced = usePrefersReducedMotion();
  const stars: Array<0 | 1 | 2> = [0, 1, 2];
  const headline = wasReplay ? 'Made it Shine!' : 'Great work!';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${headline} ${count} of 3 stars earned`}
      className={cn('flex flex-col items-center gap-[var(--space-4)]', className)}
    >
      <h2
        className="text-3xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {headline}
      </h2>
      <div className="flex items-center gap-[var(--space-3)]">
        {stars.map((index) => {
          const earned = index < count;
          const initial = prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 };
          const animate = prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 };
          return (
            <motion.span
              key={`star-${index}`}
              aria-hidden="true"
              initial={initial}
              animate={animate}
              transition={
                prefersReduced
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 260,
                      damping: 14,
                      delay: index * 0.15,
                    }
              }
              className="inline-flex h-16 w-16 items-center justify-center"
              style={{
                color: earned ? 'var(--color-sunflower)' : 'var(--color-muted)',
                fontSize: '3.5rem',
                lineHeight: 1,
              }}
            >
              {'★'}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}
