'use client';

/**
 * use-vpc-upgrade — React hook orchestrating the email-plus Verifiable
 * Parental Consent flow.
 *
 * Three steps, each backed by a sub-endpoint of the `vpc-upgrade` Edge
 * Function:
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
 * After a successful second confirmation, the CLIENT is responsible for
 * invoking `supabase.auth.updateUser({ email })` to trigger Supabase's
 * own email verification round trip. The Edge Function's job is to gate
 * whether the client is allowed to do that — it does NOT itself touch
 * `auth.users` (no service-role key is in scope).
 */

import { getSupabase } from '@e4k/db';
import { useCallback, useState } from 'react';

export type UpgradeStatus =
  | 'idle'
  | 'pending'
  | 'awaiting-second-confirmation'
  | 'too-early'
  | 'upgraded'
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

  return { status, error, busy, requestUpgrade, confirmFirst, confirmSecond };
}
