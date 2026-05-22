import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit coverage for the Sprint 7 `useAuth` hook.
 *
 * The hook surface is intentionally thin — each verb is a near-direct
 * pass-through to the underlying Supabase client. Tests assert:
 *   - the verb is called with the right arguments
 *   - errors are surfaced via state.error and re-thrown
 *   - the initial getSession() result hydrates state
 */

const hoisted = vi.hoisted(() => {
  const signUpMock = vi.fn();
  const signInPasswordMock = vi.fn();
  const signInOAuthMock = vi.fn();
  const signOutMock = vi.fn();
  const resetPasswordMock = vi.fn();
  const updateUserMock = vi.fn();
  const linkIdentityMock = vi.fn();
  const signInAnonymouslyMock = vi.fn();
  const getSessionMock = vi.fn(async () => ({ data: { session: null }, error: null }));
  const getUserMock = vi.fn(async () => ({ data: { user: null }, error: null }));
  const onAuthStateChangeMock = vi.fn(() => ({
    data: { subscription: { unsubscribe: () => {} } },
  }));
  const functionsInvokeMock = vi.fn(async () => ({ data: { ok: true }, error: null }));
  return {
    signUpMock,
    signInPasswordMock,
    signInOAuthMock,
    signOutMock,
    resetPasswordMock,
    updateUserMock,
    linkIdentityMock,
    signInAnonymouslyMock,
    getSessionMock,
    getUserMock,
    onAuthStateChangeMock,
    functionsInvokeMock,
  };
});

vi.mock('@e4k/db', () => ({
  getSupabase: () => ({
    auth: {
      signUp: hoisted.signUpMock,
      signInWithPassword: hoisted.signInPasswordMock,
      signInWithOAuth: hoisted.signInOAuthMock,
      signOut: hoisted.signOutMock,
      resetPasswordForEmail: hoisted.resetPasswordMock,
      updateUser: hoisted.updateUserMock,
      linkIdentity: hoisted.linkIdentityMock,
      signInAnonymously: hoisted.signInAnonymouslyMock,
      getSession: hoisted.getSessionMock,
      getUser: hoisted.getUserMock,
      onAuthStateChange: hoisted.onAuthStateChangeMock,
    },
    functions: { invoke: hoisted.functionsInvokeMock },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

import { useAuth } from './use-auth';

describe('useAuth', () => {
  beforeEach(() => {
    for (const m of Object.values(hoisted)) {
      if (typeof m === 'function' && 'mockReset' in m) (m as { mockReset: () => void }).mockReset();
    }
    hoisted.getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    hoisted.onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: () => {} } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates initial state from getSession', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAnonymous).toBe(false);
  });

  it('calls signUp on signUpWithEmail', async () => {
    hoisted.signUpMock.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signUpWithEmail('a@b.com', 'pw', 'Sam');
    });
    expect(hoisted.signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', password: 'pw' }),
    );
  });

  it('calls signInWithPassword on signInWithEmail and throws on error', async () => {
    hoisted.signInPasswordMock.mockResolvedValue({ data: null, error: { message: 'bad' } });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => {
        await result.current.signInWithEmail('a@b.com', 'pw');
      }),
    ).rejects.toBeTruthy();
    expect(hoisted.signInPasswordMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
  });

  it('calls signInWithOAuth provider apple', async () => {
    hoisted.signInOAuthMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signInWithApple();
    });
    expect(hoisted.signInOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'apple' }),
    );
  });

  it('calls signInWithOAuth provider google', async () => {
    hoisted.signInOAuthMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(hoisted.signInOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
  });

  it('calls signOut', async () => {
    hoisted.signOutMock.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signOut();
    });
    expect(hoisted.signOutMock).toHaveBeenCalled();
  });

  it('calls resetPasswordForEmail on requestPasswordReset', async () => {
    hoisted.resetPasswordMock.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.requestPasswordReset('a@b.com');
    });
    expect(hoisted.resetPasswordMock).toHaveBeenCalledWith(
      'a@b.com',
      expect.objectContaining({ redirectTo: expect.any(String) }),
    );
  });

  it('invokes account-deletion function on deleteAccount', async () => {
    // Cast to unknown to bypass strict mock typing — the runtime shape is
    // a valid Supabase session-like object for this test.
    hoisted.getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'jwt' } as unknown as null },
      error: null,
    });
    hoisted.functionsInvokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deleteAccount('changed my mind');
    });
    expect(hoisted.functionsInvokeMock).toHaveBeenCalledWith(
      'account-deletion',
      expect.objectContaining({ body: { action: 'request', reason: 'changed my mind' } }),
    );
  });

  it('links anonymous to identified via updateUser (email kind)', async () => {
    hoisted.updateUserMock.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.linkAnonymousToIdentified({
        kind: 'email',
        email: 'a@b.com',
        password: 'pw',
      });
    });
    expect(hoisted.updateUserMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
    });
  });

  it('links anonymous via linkIdentity for apple', async () => {
    hoisted.linkIdentityMock.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.linkAnonymousToIdentified({ kind: 'apple' });
    });
    expect(hoisted.linkIdentityMock).toHaveBeenCalledWith({ provider: 'apple' });
  });

  it('continueAsGuest calls signInAnonymously when no session', async () => {
    hoisted.signInAnonymouslyMock.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.continueAsGuest();
    });
    expect(hoisted.signInAnonymouslyMock).toHaveBeenCalled();
  });
});
