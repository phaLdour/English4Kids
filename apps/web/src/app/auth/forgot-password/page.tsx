'use client';

/**
 * Sprint 7 — Forgot Password screen.
 *
 * Single form: email -> Supabase resetPasswordForEmail. On success we show
 * a "check your inbox" confirmation; never disclose whether the email
 * exists in the system (standard enumeration-resistance).
 */

import { PrimaryButton } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useAuth } from '@/lib/use-auth';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Intentionally swallow: the confirmation message is the same either way.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-[var(--space-6)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1
          className="text-3xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('auth.forgot.title')}
        </h1>
        <p className="text-[var(--color-mist)]">{t('auth.forgot.subtitle')}</p>
      </header>

      {sent ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-soft)] bg-[var(--color-success)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-surface-high)]"
        >
          {t('auth.forgot.sent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--space-4)]">
          <label className="flex flex-col gap-[var(--space-1)]">
            <span className="text-sm text-[var(--color-ink)]">{t('auth.forgot.emailLabel')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded-[var(--radius-soft)] bg-[var(--color-surface-high)] px-[var(--space-4)] py-[var(--space-3)] text-base text-[var(--color-ink)]"
              style={{ minHeight: '56px', border: '1px solid var(--color-muted)' }}
            />
          </label>
          <PrimaryButton type="submit" tone="primary" size="md" fullWidth loading={busy}>
            {t('auth.forgot.submit')}
          </PrimaryButton>
        </form>
      )}

      <Link
        href="/auth/sign-in"
        className="text-center text-sm text-[var(--color-primary)] underline"
      >
        {t('auth.forgot.back')}
      </Link>
    </main>
  );
}
