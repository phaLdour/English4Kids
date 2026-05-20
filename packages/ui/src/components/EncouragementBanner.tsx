'use client';

import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface EncouragementBannerProps {
  message?: string;
  tone?: 'encouraging' | 'celebrating' | 'gentle';
  className?: string;
}

export const DEFAULT_ENCOURAGEMENTS = [
  'You got it!',
  'Awesome listening!',
  'Your brain is growing!',
] as const;

const FORBIDDEN_FRAGMENTS = ['wrong', 'no!', 'failed', 'bad job', 'incorrect'];

function assertSafeCopy(message: string): void {
  const lowered = message.toLowerCase();
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    if (lowered.includes(fragment)) {
      throw new Error(
        `EncouragementBanner copy must not include negative phrasing: "${fragment}"`,
      );
    }
  }
}

const TONE_BG: Record<NonNullable<EncouragementBannerProps['tone']>, string> = {
  encouraging: 'var(--color-primary)',
  celebrating: 'var(--color-sunflower)',
  gentle: 'var(--color-coral)',
};

export function EncouragementBanner({
  message,
  tone = 'encouraging',
  className,
}: EncouragementBannerProps) {
  const prefersReduced = usePrefersReducedMotion();
  const resolved = message ?? DEFAULT_ENCOURAGEMENTS[0];
  if (process.env.NODE_ENV !== 'production') {
    assertSafeCopy(resolved);
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { duration: 0.32, ease: [0.4, 0, 0.2, 1] }
      }
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-pill)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)]',
        className,
      )}
      style={{
        backgroundColor: TONE_BG[tone],
        fontFamily: 'var(--font-display)',
        fontSize: '1.25rem',
      }}
    >
      {resolved}
    </motion.div>
  );
}
