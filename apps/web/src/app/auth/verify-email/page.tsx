'use client';

/**
 * Sprint 7 — Verify Email screen.
 *
 * Static informational screen shown after sign-up. The actual verification
 * happens when the user clicks the link in their email (Supabase handles
 * redirect to /auth/callback). This page exists so the post-signup state
 * is not a blank screen.
 */

import { PrimaryButton } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-[var(--space-6)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)] text-center">
      <h1
        className="text-3xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('auth.verifyEmail.title')}
      </h1>
      <p className="text-[var(--color-mist)]">{t('auth.verifyEmail.subtitle')}</p>
      <Link href="/auth/sign-in" className="w-full max-w-[320px]">
        <PrimaryButton tone="neutral" size="md" fullWidth>
          {t('auth.verifyEmail.back')}
        </PrimaryButton>
      </Link>
    </main>
  );
}
