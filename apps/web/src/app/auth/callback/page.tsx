'use client';

/**
 * Sprint 7 — OAuth callback page.
 *
 * Supabase OAuth + email-magic-link flows redirect here after the
 * provider exchange. The SDK consumes the fragment automatically; we
 * just wait for the auth state to settle and route to home.
 */

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/use-auth';

export default function AuthCallbackPage() {
  const t = useTranslations();
  const router = useRouter();
  const { loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    // Once auth state settles, route based on whether we have a user.
    router.replace(user ? '/' : '/auth/welcome');
  }, [loading, user, router]);

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-[var(--space-4)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]"
      aria-busy="true"
    >
      <span
        aria-hidden="true"
        className="block h-16 w-16 animate-pulse rounded-[var(--radius-pill)] bg-[var(--color-milo)]"
      />
      <span
        role="status"
        aria-live="polite"
        className="text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}
      >
        {t('auth.callback.wait')}
      </span>
    </main>
  );
}
