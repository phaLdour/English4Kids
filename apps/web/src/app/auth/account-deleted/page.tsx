'use client';

/**
 * Sprint 7 — Post-deletion landing page.
 *
 * Shown to the user immediately after they confirmed an account-deletion
 * request. The grace window (7 days) is active; signing back in within
 * that window cancels the deletion from the parent account page.
 */

import { PrimaryButton } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function AccountDeletedPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-[var(--space-6)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)] text-center">
      <h1
        className="text-3xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('auth.deleted.title')}
      </h1>
      <p className="text-[var(--color-mist)]">{t('auth.deleted.subtitle')}</p>
      <Link href="/" className="w-full max-w-[320px]">
        <PrimaryButton tone="primary" size="md" fullWidth>
          {t('auth.deleted.home')}
        </PrimaryButton>
      </Link>
    </main>
  );
}
