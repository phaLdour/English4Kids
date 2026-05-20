'use client';

/**
 * Account upgrade — Phase 2 email-plus Verifiable Parental Consent flow.
 *
 * Three-step UI:
 *   Step 1: parent enters an email -> we issue a pending token and (in
 *           prod) send a confirmation email. In dev the token is shown
 *           inline so the engineer can paste it back.
 *   Step 2: parent confirms via the email link, returns here, and pastes /
 *           clicks through. We mark `first_confirmed_at`.
 *   Step 3: at least 24h later, the parent returns and completes the
 *           second confirmation, which atomically flips
 *           `profiles.is_anonymous` to false and activates cloud sync.
 *
 * Cloud sync is OFF until step 3 completes. The pre-upgrade flow stays
 * fully local-first per Safety Officer policy.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useVpcUpgrade } from '@/lib/use-vpc-upgrade';

type Step = 'email' | 'first-confirm' | 'wait' | 'second-confirm' | 'done';

export default function AccountUpgradePage() {
  const vpc = useVpcUpgrade();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [secondAvailableAt, setSecondAvailableAt] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const onRequest = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const r = await vpc.requestUpgrade(email);
    if (r.status === 'pending') {
      setDevToken(r.devToken ?? null);
      setStep('first-confirm');
    }
  };

  const onConfirmFirst = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const r = await vpc.confirmFirst(token);
    if (r.status === 'awaiting-second-confirmation') {
      setSecondAvailableAt(r.secondConfirmAvailableAt ?? null);
      setStep('wait');
    }
  };

  const onConfirmSecond = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const r = await vpc.confirmSecond(token);
    if (r.status === 'upgraded') {
      setStep('done');
    } else if (r.status === 'too-early') {
      setSecondAvailableAt(r.tryAgainAt ?? null);
      setStep('wait');
    }
  };

  return (
    <main
      data-testid="parent-account"
      className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--space-6)] px-[var(--space-4)] py-[var(--space-6)] pb-[var(--space-16)]"
    >
      <section
        aria-label="Account upgrade"
        className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] bg-[var(--color-surface-high)] p-[var(--space-6)] shadow-[var(--shadow-card)]"
      >
        <h1
          className="text-2xl text-[var(--color-primary-dark)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Account upgrade
        </h1>
        <p className="text-base text-[var(--color-ink)]">
          Connect an email to back up your child&rsquo;s progress and sync across devices. We
          use a two-step confirmation — required by COPPA — so the upgrade takes at least 24
          hours to complete. Your child&rsquo;s data stays on this device until you finish
          step 3.
        </p>

        {step === 'email' && (
          <form onSubmit={onRequest} className="flex flex-col gap-[var(--space-3)]">
            <label htmlFor="vpc-email" className="text-sm text-[var(--color-ink)]">
              Your email
            </label>
            <input
              id="vpc-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-[var(--radius-md)] border border-[var(--color-mist)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ minHeight: '48px' }}
            />
            <button
              type="submit"
              disabled={vpc.busy}
              className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] py-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] disabled:opacity-60"
              style={{ minHeight: 'var(--tap-primary-old)', fontFamily: 'var(--font-display)' }}
            >
              {vpc.busy ? 'Sending...' : 'Send confirmation email'}
            </button>
          </form>
        )}

        {step === 'first-confirm' && (
          <form onSubmit={onConfirmFirst} className="flex flex-col gap-[var(--space-3)]">
            <p className="text-sm text-[var(--color-ink)]">
              Check your inbox for a confirmation link, then paste the token below.
            </p>
            {devToken && (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-xs text-[var(--color-mist)]">
                Dev mode token: <code>{devToken}</code>
              </p>
            )}
            <label htmlFor="vpc-token-1" className="text-sm text-[var(--color-ink)]">
              Confirmation token
            </label>
            <input
              id="vpc-token-1"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-mist)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ minHeight: '48px' }}
            />
            <button
              type="submit"
              disabled={vpc.busy}
              className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] py-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] disabled:opacity-60"
              style={{ minHeight: 'var(--tap-primary-old)', fontFamily: 'var(--font-display)' }}
            >
              {vpc.busy ? 'Confirming...' : 'Confirm first step'}
            </button>
          </form>
        )}

        {step === 'wait' && (
          <div className="flex flex-col gap-[var(--space-3)]">
            <p className="text-base text-[var(--color-ink)]">
              First confirmation received. Please come back in 24 hours to finish.
            </p>
            {secondAvailableAt && (
              <p className="text-sm text-[var(--color-mist)]">
                You can complete the upgrade after{' '}
                <strong>{new Date(secondAvailableAt).toLocaleString()}</strong>.
              </p>
            )}
            <button
              type="button"
              onClick={() => setStep('second-confirm')}
              className="self-start rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
            >
              I&rsquo;m back, try second confirmation
            </button>
          </div>
        )}

        {step === 'second-confirm' && (
          <form onSubmit={onConfirmSecond} className="flex flex-col gap-[var(--space-3)]">
            <label htmlFor="vpc-token-2" className="text-sm text-[var(--color-ink)]">
              Confirmation token (same as before)
            </label>
            <input
              id="vpc-token-2"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-mist)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ minHeight: '48px' }}
            />
            <button
              type="submit"
              disabled={vpc.busy}
              className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-10)] py-[var(--space-4)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] disabled:opacity-60"
              style={{ minHeight: 'var(--tap-primary-old)', fontFamily: 'var(--font-display)' }}
            >
              {vpc.busy ? 'Finalizing...' : 'Finish upgrade'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--color-ink)]"
          >
            Upgrade complete. Cloud sync is now active for this device.
          </p>
        )}

        {vpc.error && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--color-alert)]"
          >
            {vpc.error}
          </p>
        )}

        <Link
          href="/parent"
          className="self-start rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
          style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
        >
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
