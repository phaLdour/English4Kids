'use client';

/**
 * Sprint 7 — Sign In screen.
 *
 * Apple + Google + Email — three provider buttons stacked. Apple Sign-In
 * is mandatory if Google is offered (App Store rule), so both buttons
 * always render together. Email + password form below the providers.
 *
 * Banned-phrasings rule: error messaging never says "Wrong password!" —
 * the locale uses "Let's check your email and password again" instead.
 */

import { PrimaryButton, ProviderButton } from '@e4k/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useAuth } from '@/lib/use-auth';

export default function SignInPage() {
  const t = useTranslations();
  const router = useRouter();
  const { signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrorVisible(false);
    try {
      await signInWithEmail(email, password);
      router.replace('/');
    } catch {
      setErrorVisible(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-[var(--space-6)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-10)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1
          className="text-3xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('auth.signIn.title')}
        </h1>
        <p className="text-[var(--color-mist)]">{t('auth.signIn.subtitle')}</p>
      </header>

      <div className="flex flex-col gap-[var(--space-3)]">
        <ProviderButton provider="apple" onClick={() => void signInWithApple()} />
        <ProviderButton provider="google" onClick={() => void signInWithGoogle()} />
      </div>

      <div
        aria-hidden="true"
        className="flex items-center gap-[var(--space-3)] text-xs text-[var(--color-mist)]"
      >
        <span className="h-px flex-1 bg-[var(--color-muted)]" />
        <span>or</span>
        <span className="h-px flex-1 bg-[var(--color-muted)]" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-[var(--space-4)]">
        <label className="flex flex-col gap-[var(--space-1)]">
          <span className="text-sm text-[var(--color-ink)]">{t('auth.signIn.emailLabel')}</span>
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
        <label className="flex flex-col gap-[var(--space-1)]">
          <span className="text-sm text-[var(--color-ink)]">
            {t('auth.signIn.passwordLabel')}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="rounded-[var(--radius-soft)] bg-[var(--color-surface-high)] px-[var(--space-4)] py-[var(--space-3)] text-base text-[var(--color-ink)]"
            style={{ minHeight: '56px', border: '1px solid var(--color-muted)' }}
          />
        </label>

        {errorVisible ? (
          <p
            role="alert"
            className="rounded-[var(--radius-soft)] bg-[var(--color-coral)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-ink)]"
          >
            {t('auth.signIn.errorGeneric')}
          </p>
        ) : null}

        <PrimaryButton type="submit" tone="primary" size="md" fullWidth loading={busy}>
          {t('auth.signIn.submit')}
        </PrimaryButton>
      </form>

      <div className="flex flex-col items-center gap-[var(--space-2)] text-sm">
        <Link href="/auth/forgot-password" className="text-[var(--color-primary)] underline">
          {t('auth.signIn.forgot')}
        </Link>
        <p className="text-[var(--color-mist)]">
          {t('auth.signIn.noAccount')}{' '}
          <Link href="/auth/sign-up" className="text-[var(--color-primary)] underline">
            {t('auth.signIn.createOne')}
          </Link>
        </p>
      </div>
    </main>
  );
}
