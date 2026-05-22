'use client';

import { getSetting, getSupabase } from '@e4k/db';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Sprint 7 — Auth + onboarding gate.
 *
 * Routing precedence:
 *   1. If `auth.skipped` is true in Dexie (user picked "Continue as guest"
 *      previously), preserve the legacy anonymous-first path — go to
 *      /onboarding or /play depending on onboarding.complete.
 *   2. Otherwise check Supabase session:
 *      - No session  -> /auth/welcome (first impression)
 *      - Has session -> onboarding.complete ? /play : /onboarding
 *
 * The legacy behaviour (no auth at all) is preserved when Supabase is not
 * configured or the call throws — falls through to /onboarding or /play.
 */
export default function HomePage() {
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const onbComplete = await getSetting<boolean>('onboarding.complete', false);
      const guestAck = await getSetting<boolean>('auth.skipped', false);
      if (cancelled) return;

      if (guestAck) {
        router.replace(onbComplete ? '/play' : '/onboarding');
        return;
      }

      // Probe Supabase session — if no session and Supabase is configured,
      // start the user at the welcome screen.
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!data.session) {
          router.replace('/auth/welcome');
          return;
        }
        router.replace(onbComplete ? '/play' : '/onboarding');
      } catch {
        // Supabase env not configured — preserve legacy onboarding-first flow.
        router.replace(onbComplete ? '/play' : '/onboarding');
      }
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
          {t('common.gettingReady')}
        </span>
      </div>
    </main>
  );
}
