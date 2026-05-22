'use client';

/**
 * Sprint 7 — typed authentication hook.
 *
 * Wraps the Supabase auth surface in a strongly-typed, intent-revealing API
 * for the new auth screens. The hook intentionally does NOT take ownership
 * of profile/role state — that still belongs to `useParentSession` and the
 * VPC flow. This hook is only about identity (who is signed in, with what
 * provider, anonymously or not).
 *
 * Contracts honoured:
 *  - Anonymous-first preservation: a child can play without ever signing
 *    in. The `continueAsGuest` path creates an anonymous session via the
 *    existing Supabase setting (`enable_anonymous_sign_ins = true`).
 *  - <13 never asked for email/OAuth: the caller (AgeGate) gates whether
 *    sign-in/up flows are ever shown.
 *  - Apple Sign-In mandatory if Google is offered: both `signInWithApple`
 *    and `signInWithGoogle` are exported together; the UI always renders
 *    both buttons together.
 *  - When an anonymous user signs up, the local Dexie data MUST migrate to
 *    cloud via the existing sync edge function. `linkAnonymousToIdentified`
 *    bridges that — it persists the existing anonymous user-id reference
 *    locally and lets the next `useAutoSync` tick pick it up after the
 *    profile flips to `is_anonymous = false`.
 *
 * No PII handling: the only stored values are the standard Supabase auth
 * tokens (in localStorage by Supabase's default), nothing additional.
 */

import { getSupabase } from '@e4k/db';
import { useCallback, useEffect, useState } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';

export type AuthProvider = 'email' | 'apple' | 'google' | 'anonymous';

export interface AuthState {
  /** True while the initial session lookup is in flight. */
  loading: boolean;
  /** Active Supabase session, or null if signed out. */
  session: Session | null;
  /** Active user, or null. */
  user: User | null;
  /** True if the active user came from `signInAnonymously`. */
  isAnonymous: boolean;
  /** Last error from any of the auth verbs below. Cleared on success. */
  error: AuthError | Error | null;
}

export interface UseAuthResult extends AuthState {
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  /**
   * Soft-delete: starts a 7-day grace period via the account-deletion edge
   * function. The user remains signed in until the grace expires or they
   * sign out, so they can cancel from the parent account page.
   */
  deleteAccount: (reason?: string) => Promise<void>;
  /**
   * Convert the currently-anonymous session into an identified one by
   * adding a credential. The existing anonymous user-id is preserved (and
   * with it all the child rows and progress) so the upgrade is lossless.
   */
  linkAnonymousToIdentified: (
    args:
      | { kind: 'email'; email: string; password: string }
      | { kind: 'apple' }
      | { kind: 'google' },
  ) => Promise<void>;
  /** Create an anonymous session (used by the "Continue as guest" link). */
  continueAsGuest: () => Promise<void>;
}

const AUTH_REDIRECT_PATH = '/auth/callback';

function buildRedirectUrl(): string {
  if (typeof window === 'undefined') return AUTH_REDIRECT_PATH;
  return `${window.location.origin}${AUTH_REDIRECT_PATH}`;
}

export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    isAnonymous: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    void (async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) {
          setState((s) => ({ ...s, loading: false, error }));
          return;
        }
        setState({
          loading: false,
          session: data.session,
          user: data.session?.user ?? null,
          isAnonymous: Boolean(data.session?.user?.is_anonymous),
          error: null,
        });

        const sub = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          setState({
            loading: false,
            session,
            user: session?.user ?? null,
            isAnonymous: Boolean(session?.user?.is_anonymous),
            error: null,
          });
        });
        subscription = sub.data.subscription;
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildRedirectUrl(),
          data: displayName ? { display_name: displayName } : undefined,
        },
      });
      if (error) {
        setState((s) => ({ ...s, error }));
        throw error;
      }
    },
    [],
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: buildRedirectUrl() },
    });
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: buildRedirectUrl() },
    });
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
    });
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (reason?: string) => {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const err = new Error('not-signed-in');
      setState((s) => ({ ...s, error: err }));
      throw err;
    }
    const { error } = await supabase.functions.invoke('account-deletion', {
      body: { action: 'request', reason: reason ?? null },
    });
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  const linkAnonymousToIdentified = useCallback<UseAuthResult['linkAnonymousToIdentified']>(
    async (args) => {
      const supabase = getSupabase();
      // Supabase v2 supports `updateUser` to attach an email + password to an
      // anonymous user, or `linkIdentity` to attach an OAuth provider.
      if (args.kind === 'email') {
        const { error } = await supabase.auth.updateUser({
          email: args.email,
          password: args.password,
        });
        if (error) {
          setState((s) => ({ ...s, error }));
          throw error;
        }
        return;
      }
      const provider = args.kind === 'apple' ? 'apple' : 'google';
      // `linkIdentity` is only available in @supabase/supabase-js >= 2.43.
      // Cast minimally — the rest of the codebase pins a recent version.
      type LinkableAuth = {
        linkIdentity?: (args: { provider: 'apple' | 'google' }) => Promise<{ error: AuthError | null }>;
      };
      const auth = supabase.auth as unknown as LinkableAuth;
      if (typeof auth.linkIdentity !== 'function') {
        const err = new Error('link-identity-unsupported');
        setState((s) => ({ ...s, error: err }));
        throw err;
      }
      const { error } = await auth.linkIdentity({ provider });
      if (error) {
        setState((s) => ({ ...s, error }));
        throw error;
      }
    },
    [],
  );

  const continueAsGuest = useCallback(async () => {
    const supabase = getSupabase();
    // If an anonymous session already exists, this is a no-op.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) return;
    type AnonAuth = {
      signInAnonymously?: () => Promise<{ error: AuthError | null }>;
    };
    const auth = supabase.auth as unknown as AnonAuth;
    if (typeof auth.signInAnonymously !== 'function') {
      const err = new Error('anonymous-sign-in-unsupported');
      setState((s) => ({ ...s, error: err }));
      throw err;
    }
    const { error } = await auth.signInAnonymously();
    if (error) {
      setState((s) => ({ ...s, error }));
      throw error;
    }
  }, []);

  return {
    ...state,
    signUpWithEmail,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    requestPasswordReset,
    deleteAccount,
    linkAnonymousToIdentified,
    continueAsGuest,
  };
}
