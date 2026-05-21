'use client';

/**
 * use-vpc-upgrade — React hook orchestrating the email-plus Verifiable
 * Parental Consent flow.
 *
 * Three steps, each backed by a sub-endpoint of the `vpc-upgrade` Edge
 * Function, followed by a final Supabase-side email-link step:
 *
 *   1. requestUpgrade(email)  -> POST /vpc-upgrade/start
 *      Server stores a pending row, logs a confirmation link, and (in prod)
 *      sends an email. In dev the link is logged to the function's console
 *      and returned as `devToken` for copy-paste.
 *
 *   2. confirmFirst(token)    -> POST /vpc-upgrade/confirm-first
 *      Marks first confirmation. Returns the ISO timestamp after which the
 *      second confirmation may be submitted.
 *
 *   3. confirmSecond(token)   -> POST /vpc-upgrade/confirm-second
 *      Verifies the 24h window has elapsed and atomically flips the
 *      profile to non-anonymous. Returns `{ status: 'upgraded' }` or
 *      `{ status: 'too-early', tryAgainAt }`.
 *
 *   4. linkSupabaseEmail(email) -> supabase.auth.updateUser({ email })
 *      Triggers Supabase's own email-verification round trip so the
 *      `auth.users.email` column is populated and the parent can recover
 *      the account via password reset later. This MUST run immediately
 *      after a successful `confirmSecond` — without it, the profile is
 *      flipped to non-anonymous but the auth row has no email and the
 *      account is unrecoverable. The Edge Function's job was to gate
 *      whether the client is allowed to do that (email-plus consent
 *      window). Here the hook completes the round trip so callers don't
 *      have to remember.
 */

import { getSupabase } from '@e4k/db';
import { useCallback, useState } from 'react';

export type UpgradeStatus =
  | 'idle'
  | 'pending'
  | 'awaiting-second-confirmation'
  | 'too-early'
  | 'upgraded'
  | 'awaiting-supabase-verify'
  | 'error';

export interface RequestUpgradeResult {
  status: 'pending' | 'error';
  devToken?: string;
  message?: string;
}

export interface ConfirmFirstResult {
  status: 'awaiting-second-confirmation' | 'error';
  secondConfirmAvailableAt?: string;
  message?: string;
}

export interface ConfirmSecondResult {
  status: 'upgraded' | 'too-early' | 'error';
  tryAgainAt?: string;
  message?: string;
}

export interface LinkSupabaseEmailResult {
  status: 'sent' | 'error';
  error?: string;
}

function resolveFunctionBase(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  return `${base.replace(/\/$/, '')}/functions/v1/vpc-upgrade`;
}

async function postWithAuth<T>(path: string, body: unknown): Promise<T> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('no-session');
  const res = await fetch(`${resolveFunctionBase()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 425) {
    // 425 (too-early) is a "soft" error we want to surface as data, not throw.
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      detail = `http-${res.status}`;
    }
    throw new Error(detail || `http-${res.status}`);
  }
  return (await res.json()) as T;
}

export interface UseVpcUpgradeResult {
  status: UpgradeStatus;
  error: string | null;
  busy: boolean;
  requestUpgrade: (email: string) => Promise<RequestUpgradeResult>;
  confirmFirst: (token: string) => Promise<ConfirmFirstResult>;
  confirmSecond: (token: string) => Promise<ConfirmSecondResult>;
  linkSupabaseEmail: (email: string) => Promise<LinkSupabaseEmailResult>;
}

export function useVpcUpgrade(): UseVpcUpgradeResult {
  const [status, setStatus] = useState<UpgradeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestUpgrade = useCallback<UseVpcUpgradeResult['requestUpgrade']>(
    async (email) => {
      setBusy(true);
      setError(null);
      try {
        const r = await postWithAuth<{ status: string; devToken?: string }>('/start', {
          email,
        });
        setStatus('pending');
        return { status: 'pending', devToken: r.devToken };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'request-failed';
        setError(msg);
        setStatus('error');
        return { status: 'error', message: msg };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const confirmFirst = useCallback<UseVpcUpgradeResult['confirmFirst']>(async (token) => {
    setBusy(true);
    setError(null);
    try {
      const r = await postWithAuth<{
        status: string;
        secondConfirmAvailableAt?: string;
      }>('/confirm-first', { token });
      setStatus('awaiting-second-confirmation');
      return {
        status: 'awaiting-second-confirmation',
        secondConfirmAvailableAt: r.secondConfirmAvailableAt,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'confirm-first-failed';
      setError(msg);
      setStatus('error');
      return { status: 'error', message: msg };
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmSecond = useCallback<UseVpcUpgradeResult['confirmSecond']>(async (token) => {
    setBusy(true);
    setError(null);
    try {
      const r = await postWithAuth<{
        status: string;
        tryAgainAt?: string;
      }>('/confirm-second', { token });
      if (r.status === 'too-early') {
        setStatus('too-early');
        return { status: 'too-early', tryAgainAt: r.tryAgainAt };
      }
      setStatus('upgraded');
      return { status: 'upgraded' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'confirm-second-failed';
      setError(msg);
      setStatus('error');
      return { status: 'error', message: msg };
    } finally {
      setBusy(false);
    }
  }, []);

  const linkSupabaseEmail = useCallback<UseVpcUpgradeResult['linkSupabaseEmail']>(
    async (email) => {
      setBusy(true);
      setError(null);
      try {
        const supabase = getSupabase();
        const { error: updateErr } = await supabase.auth.updateUser({ email });
        if (updateErr) {
          const msg = updateErr.message || 'auth-updateUser-failed';
          setError(msg);
          setStatus('error');
          return { status: 'error', error: msg };
        }
        setStatus('awaiting-supabase-verify');
        return { status: 'sent' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'auth-updateUser-failed';
        setError(msg);
        setStatus('error');
        return { status: 'error', error: msg };
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return {
    status,
    error,
    busy,
    requestUpgrade,
    confirmFirst,
    confirmSecond,
    linkSupabaseEmail,
  };
}
