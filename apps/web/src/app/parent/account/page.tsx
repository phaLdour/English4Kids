'use client';

/**
 * Account upgrade — Phase 2 email-plus Verifiable Parental Consent flow.
 *
 * Four-step UI:
 *   Step 1 (email):              parent enters an email -> we issue a pending
 *                                token and (in prod) send a confirmation
 *                                email. In dev the token is shown inline so
 *                                the engineer can paste it back.
 *   Step 2 (first-confirm):      parent confirms via the email link, returns
 *                                here, and pastes / clicks through. We mark
 *                                `first_confirmed_at`.
 *   Step 3 (wait + second-       at least 24h later, the parent returns and
 *           confirm):            completes the second confirmation, which
 *                                atomically flips `profiles.is_anonymous` to
 *                                false.
 *   Step 4 (verify-supabase-     immediately after step 3 succeeds we call
 *           email):              `supabase.auth.updateUser({ email })` so
 *                                Supabase sends its own verification email
 *                                to the same address. The parent clicks that
 *                                link to finalize `auth.users.email`.
 *
 * Why step 4? The Edge Function flips `profiles.is_anonymous = false` but
 * cannot touch `auth.users` (no service-role key in scope). Without the
 * client-side `auth.updateUser` call the account is "half-baked":
 * non-anonymous in profile-land, but no recoverable email, no password
 * reset path. Critic Wave-2 S0-2 closed this gap.
 *
 * If `auth.updateUser` fails we route to an explicit `error` step with a
 * retry button — we MUST NOT advance to 'done', because half-baked upgrades
 * are exactly what we're trying to prevent.
 *
 * Cloud sync is OFF until step 3 completes. The pre-upgrade flow stays
 * fully local-first per Safety Officer policy.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useVpcUpgrade } from '@/lib/use-vpc-upgrade';

type Step =
  | 'email'
  | 'first-confirm'
  | 'wait'
  | 'second-confirm'
  | 'awaiting-supabase-verify'
  | 'error'
  | 'done';

export default function AccountUpgradePage() {
  const vpc = useVpcUpgrade();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [secondAvailableAt, setSecondAvailableAt] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

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

  /**
   * Step 3 -> Step 4 bridge.
   *
   * On 'upgraded': call `supabase.auth.updateUser({ email })` so Supabase
   * sends its own verification round trip. Only on its success do we
   * surface the "check your inbox one last time" UI. On its failure we
   * route to an explicit error step — the upgrade is incomplete and the
   * parent must retry.
   *
   * If for some reason `email` is empty (e.g. the user reloaded mid-flow
   * and state was lost), we bounce back to step 1 instead of attempting
   * `updateUser({ email: '' })`.
   */
  const onConfirmSecond = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const r = await vpc.confirmSecond(token);
    if (r.status === 'upgraded') {
      if (!email) {
        setLinkError('email-state-lost');
        setStep('email');
        return;
      }
      const linkRes = await vpc.linkSupabaseEmail(email);
      if (linkRes.status === 'sent') {
        setLinkError(null);
        setStep('awaiting-supabase-verify');
      } else {
        setLinkError(linkRes.error ?? 'auth-updateUser-failed');
        setStep('error');
      }
    } else if (r.status === 'too-early') {
      setSecondAvailableAt(r.tryAgainAt ?? null);
      setStep('wait');
    }
  };

  /**
   * Retry handler for the error step. Re-attempts only the
   * `auth.updateUser` leg — the profile is already flipped, the Edge
   * Function part is done. We do NOT re-call `confirmSecond`; the
   * `alreadyUpgraded` branch in the Edge Function would short-circuit
   * but spending another network round trip on it is pointless.
   */
  const onRetryLink = async (): Promise<void> => {
    if (!email) {
      setStep('email');
      return;
    }
    const linkRes = await vpc.linkSupabaseEmail(email);
    if (linkRes.status === 'sent') {
      setLinkError(null);
      setStep('awaiting-supabase-verify');
    } else {
      setLinkError(linkRes.error ?? 'auth-updateUser-failed');
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
          step 3, then we send one final email to verify the address.
        </p>

        <ol
          aria-label="Upgrade steps"
          data-testid="upgrade-steps"
          className="flex flex-col gap-[var(--space-2)] text-sm text-[var(--color-ink)]"
        >
          <li data-active={step === 'email' || undefined}>1. Enter your email</li>
          <li data-active={step === 'first-confirm' || undefined}>2. Check your inbox</li>
          <li
            data-active={
              step === 'wait' || step === 'second-confirm' || undefined
            }
          >
            3. Wait 24 hours and confirm again
          </li>
          <li
            data-active={
              step === 'awaiting-supabase-verify' || step === 'done' || undefined
            }
          >
            4. Verify your email with Supabase
          </li>
        </ol>

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

        {step === 'awaiting-supabase-verify' && (
          <div
            role="status"
            aria-live="polite"
            data-testid="awaiting-supabase-verify"
            className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--color-ink)]"
          >
            <p className="text-base">
              We&rsquo;ve sent a final confirmation to <strong>{email}</strong>. Click the
              link in that email to finish linking your account. Cloud sync will activate
              once verification completes.
            </p>
            <button
              type="button"
              onClick={() => setStep('done')}
              className="self-start rounded-[var(--radius-pill)] bg-[var(--color-surface-high)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-ink)]"
              style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
            >
              I&rsquo;ve clicked the link
            </button>
          </div>
        )}

        {step === 'error' && (
          <div
            role="alert"
            data-testid="link-error"
            className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface)] p-[var(--space-3)] text-[var(--color-alert)]"
          >
            <p className="text-base">
              We couldn&rsquo;t send the final verification email
              {linkError ? ` (${linkError})` : ''}. Your consent is recorded but the
              account isn&rsquo;t fully linked yet — please retry.
            </p>
            <button
              type="button"
              onClick={onRetryLink}
              disabled={vpc.busy}
              className="self-start rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-6)] py-[var(--space-3)] text-[var(--color-surface-high)] disabled:opacity-60"
              style={{ minHeight: '48px', fontFamily: 'var(--font-display)' }}
            >
              {vpc.busy ? 'Retrying...' : 'Retry verification email'}
            </button>
          </div>
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

        {vpc.error && step !== 'error' && (
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
