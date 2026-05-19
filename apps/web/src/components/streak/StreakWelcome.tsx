'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '@e4k/ui';

export interface StreakWelcomeProps {
  nickname: string;
  /** Optional callback for dismiss / start tapping. */
  onDismiss?: () => void;
}

/**
 * Returning-session welcome banner. Shown when the child opens the app on a
 * day later than their last active day. Never shames a missed day; instead
 * frames the plant as something they're nurturing together.
 */
export function StreakWelcome({ nickname, onDismiss }: StreakWelcomeProps) {
  const prefersReduced = usePrefersReducedMotion();
  return (
    <motion.section
      aria-live="polite"
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
      className="flex w-full max-w-xl flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-5)] shadow-[var(--shadow-pop)]"
    >
      <h2
        className="text-center text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Welcome back, {nickname}!
      </h2>
      <p
        className="text-center text-lg text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        Your plant missed you. Let&rsquo;s grow together.
      </p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
          style={{
            minHeight: 'var(--tap-min-young)',
            fontFamily: 'var(--font-display)',
            fontSize: '1.125rem',
          }}
        >
          Let&rsquo;s play
        </button>
      ) : null}
    </motion.section>
  );
}
