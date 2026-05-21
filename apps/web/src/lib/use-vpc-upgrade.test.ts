import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit coverage for the `linkSupabaseEmail` leg of the VPC hook.
 *
 * Happy path: `supabase.auth.updateUser({ email })` resolves with no error
 *   -> hook returns `{ status: 'sent' }` and transitions the public
 *      `status` field to `'awaiting-supabase-verify'`.
 *
 * Error paths:
 *   - Supabase returns an AuthError -> hook returns `{ status: 'error', error: <msg> }`.
 *   - `updateUser` itself rejects   -> hook returns `{ status: 'error', error: <msg> }`.
 */

const hoisted = vi.hoisted(() => {
  const updateUserMock = vi.fn();
  const getSessionMock = vi.fn(async () => ({
    data: { session: { access_token: 'fake-jwt' } },
    error: null,
  }));
  return { updateUserMock, getSessionMock };
});

vi.mock('@e4k/db', () => ({
  getSupabase: () => ({
    auth: {
      getSession: hoisted.getSessionMock,
      updateUser: hoisted.updateUserMock,
    },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

import { useVpcUpgrade } from './use-vpc-upgrade';

describe('useVpcUpgrade.linkSupabaseEmail', () => {
  beforeEach(() => {
    hoisted.updateUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { status: "sent" } and flips status on success', async () => {
    hoisted.updateUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const { result } = renderHook(() => useVpcUpgrade());
    let res: Awaited<ReturnType<typeof result.current.linkSupabaseEmail>> | undefined;
    await act(async () => {
      res = await result.current.linkSupabaseEmail('parent@example.com');
    });

    expect(res).toEqual({ status: 'sent' });
    expect(hoisted.updateUserMock).toHaveBeenCalledWith({ email: 'parent@example.com' });
    expect(result.current.status).toBe('awaiting-supabase-verify');
    expect(result.current.error).toBeNull();
  });

  it('returns { status: "error" } when Supabase returns an AuthError', async () => {
    hoisted.updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'rate-limited' },
    });

    const { result } = renderHook(() => useVpcUpgrade());
    let res: Awaited<ReturnType<typeof result.current.linkSupabaseEmail>> | undefined;
    await act(async () => {
      res = await result.current.linkSupabaseEmail('parent@example.com');
    });

    expect(res).toEqual({ status: 'error', error: 'rate-limited' });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('rate-limited');
  });

  it('returns { status: "error" } when updateUser itself rejects', async () => {
    hoisted.updateUserMock.mockRejectedValue(new Error('network-down'));

    const { result } = renderHook(() => useVpcUpgrade());
    let res: Awaited<ReturnType<typeof result.current.linkSupabaseEmail>> | undefined;
    await act(async () => {
      res = await result.current.linkSupabaseEmail('parent@example.com');
    });

    expect(res).toEqual({ status: 'error', error: 'network-down' });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('network-down');
  });

  it('clears busy after the call (success or failure)', async () => {
    hoisted.updateUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const { result } = renderHook(() => useVpcUpgrade());
    await act(async () => {
      await result.current.linkSupabaseEmail('parent@example.com');
    });
    expect(result.current.busy).toBe(false);
  });
});
