'use client';

import { getSetting } from '@e4k/db';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Onboarding gate.
 *
 * Reads `onboarding.complete` from Dexie. First-time visitors are routed to
 * `/onboarding`; returning learners go straight to `/play`. A short loading
 * spinner is shown while the check is in flight (typically a single Dexie
 * round-trip, well under a frame on warm storage).
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const complete = await getSetting<boolean>('onboarding.complete', false);
      if (cancelled) return;
      router.replace(complete ? '/play' : '/onboarding');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-6)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]"
      aria-busy="true"
    >
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-[var(--space-4)] text-[var(--color-ink)]"
      >
        <span
          aria-hidden="true"
          className="block h-16 w-16 animate-pulse rounded-[var(--radius-pill)] bg-[var(--color-milo)] shadow-[var(--shadow-milo)]"
        />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
          Getting things ready...
        </span>
      </div>
    </main>
  );
}
