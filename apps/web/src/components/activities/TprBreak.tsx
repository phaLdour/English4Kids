'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefers;
}

export interface TprBreakProps {
  promptText: string;
  durationSec: number;
  onComplete: () => void;
}

export function TprBreak({ promptText, durationSec, onComplete }: TprBreakProps) {
  const t = useTranslations();
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const prefersReduced = usePrefersReducedMotion();

  useEffect(() => {
    startedAt.current = Date.now();
    const interval = setInterval(() => {
      const next = (Date.now() - startedAt.current) / 1000;
      if (next >= durationSec) {
        setElapsed(durationSec);
        clearInterval(interval);
        onComplete();
      } else {
        setElapsed(next);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [durationSec, onComplete]);

  const progress = Math.min(1, elapsed / durationSec);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <section
      aria-label={t('activities.tprBreakTitle')}
      className="flex w-full max-w-2xl flex-col items-center gap-[var(--space-8)]"
    >
      <h2
        className="text-3xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('activities.tprBreakTitle')}
      </h2>
      <p
        aria-live="polite"
        className="max-w-xl text-center text-2xl text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {promptText}
      </p>
      <motion.div
        animate={
          prefersReduced
            ? { scale: 1 }
            : { scale: [1, 1.08, 1] }
        }
        transition={
          prefersReduced
            ? { duration: 0 }
            : { duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
        }
        className="flex h-32 w-32 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-milo)] text-[var(--color-surface-high)] shadow-[var(--shadow-milo)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}
        aria-hidden="true"
      >
        {t('activities.tprBreakMove')}
      </motion.div>
      <svg
        aria-hidden="true"
        width={140}
        height={140}
        viewBox="0 0 140 140"
      >
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={8}
        />
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 200ms linear' }}
        />
      </svg>
      <button
        type="button"
        onClick={onComplete}
        className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{
          minHeight: 'var(--tap-primary-young)',
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
        }}
      >
        {t('activities.tprBreakSkip')}
      </button>
    </section>
  );
}
