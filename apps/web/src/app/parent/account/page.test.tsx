import '@/test-utils/mock-next-intl';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests the email-plus VPC flow end-to-end at the component layer:
 *   1. Enter email          (step 'email'              -> 'first-confirm')
 *   2. Confirm first token  (step 'first-confirm'      -> 'wait')
 *   3. Try second confirm   (step 'wait'               -> 'second-confirm')
 *   4. Submit second token  (step 'second-confirm'     -> 'awaiting-supabase-verify')
 *      AND `auth.updateUser({ email })` MUST be called exactly once.
 *   5. Failure case: `auth.updateUser` rejects -> step 'error', NOT 'done'.
 *
 * The `fetch` global is stubbed so the Edge Function round trips resolve
 * with the expected JSON. `getSupabase` is mocked so we can introspect the
 * `auth.updateUser` call count.
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
      // Sprint 7 — useAuth() reads these. Stubs keep the hook's initial
      // effect quiet during the VPC tests.
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: vi.fn(),
    },
    functions: { invoke: vi.fn() },
  }),
}));

// Sprint 7: parent/account uses useRouter() for the post-deletion redirect.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

(globalThis as { React?: typeof React }).React = React;

import AccountUpgradePage from './page';

// Stable env for the hook's URL builder.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

interface FetchCall {
  url: string;
  body: unknown;
}

function installFetchStub(handler: (call: FetchCall) => Response): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = init?.body ? JSON.parse(init.body as string) : null;
    const call: FetchCall = { url, body };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return calls;
}

function jsonResp(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AccountUpgradePage', () => {
  beforeEach(() => {
    hoisted.updateUserMock.mockReset();
    hoisted.getSessionMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('walks the 4-step happy path and calls auth.updateUser exactly once', async () => {
    hoisted.updateUserMock.mockResolvedValue({ data: { user: null }, error: null });

    installFetchStub((call) => {
      if (call.url.endsWith('/vpc-upgrade/start')) {
        return jsonResp({ status: 'pending', devToken: 'devtok-123' });
      }
      if (call.url.endsWith('/vpc-upgrade/confirm-first')) {
        return jsonResp({
          status: 'awaiting-second-confirmation',
          secondConfirmAvailableAt: '2026-05-21T10:00:00.000Z',
        });
      }
      if (call.url.endsWith('/vpc-upgrade/confirm-second')) {
        return jsonResp({ status: 'upgraded' });
      }
      return jsonResp({ error: 'unknown' }, 500);
    });

    render(<AccountUpgradePage />);

    // Step 1: enter email.
    const emailInput = screen.getByLabelText(/Your email/i);
    fireEvent.change(emailInput, { target: { value: 'parent@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send confirmation email/i }));

    // Step 2: first-confirm form appears.
    const firstTokenInput = await screen.findByLabelText(/Confirmation token$/i);
    expect(screen.getByText(/Dev mode token/i)).toBeInTheDocument();
    fireEvent.change(firstTokenInput, { target: { value: 'devtok-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm first step/i }));

    // Step 3: wait screen. Click the "I'm back" button to advance.
    await screen.findByText(/come back in 24 hours/i);
    fireEvent.click(screen.getByRole('button', { name: /try second confirmation/i }));

    // Step 4: submit second confirm token.
    const secondTokenInput = await screen.findByLabelText(/Confirmation token \(same as before\)/i);
    fireEvent.change(secondTokenInput, { target: { value: 'devtok-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Finish upgrade/i }));

    // Assert UI transitioned to awaiting-supabase-verify.
    await waitFor(() => {
      expect(screen.getByTestId('awaiting-supabase-verify')).toBeInTheDocument();
    });

    // Critical assertion: auth.updateUser was called exactly once with the email.
    expect(hoisted.updateUserMock).toHaveBeenCalledTimes(1);
    expect(hoisted.updateUserMock).toHaveBeenCalledWith({ email: 'parent@example.com' });

    // The 'done' step is NOT shown until the parent clicks "I've clicked the link".
    expect(screen.queryByText(/Cloud sync is now active/i)).toBeNull();
  });

  it('routes to the error step when auth.updateUser fails (does NOT advance to done)', async () => {
    hoisted.updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'rate-limited' },
    });

    installFetchStub((call) => {
      if (call.url.endsWith('/vpc-upgrade/start')) {
        return jsonResp({ status: 'pending', devToken: 'devtok-err' });
      }
      if (call.url.endsWith('/vpc-upgrade/confirm-first')) {
        return jsonResp({
          status: 'awaiting-second-confirmation',
          secondConfirmAvailableAt: '2026-05-21T10:00:00.000Z',
        });
      }
      if (call.url.endsWith('/vpc-upgrade/confirm-second')) {
        return jsonResp({ status: 'upgraded' });
      }
      return jsonResp({ error: 'unknown' }, 500);
    });

    render(<AccountUpgradePage />);

    fireEvent.change(screen.getByLabelText(/Your email/i), {
      target: { value: 'parent@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send confirmation email/i }));

    const firstTokenInput = await screen.findByLabelText(/Confirmation token$/i);
    fireEvent.change(firstTokenInput, { target: { value: 'devtok-err' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm first step/i }));

    await screen.findByText(/come back in 24 hours/i);
    fireEvent.click(screen.getByRole('button', { name: /try second confirmation/i }));

    const secondTokenInput = await screen.findByLabelText(/Confirmation token \(same as before\)/i);
    fireEvent.change(secondTokenInput, { target: { value: 'devtok-err' } });
    fireEvent.click(screen.getByRole('button', { name: /Finish upgrade/i }));

    // Error UI is shown, NOT done.
    await waitFor(() => {
      expect(screen.getByTestId('link-error')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Cloud sync is now active/i)).toBeNull();
    expect(screen.queryByTestId('awaiting-supabase-verify')).toBeNull();
    expect(screen.getByText(/rate-limited/i)).toBeInTheDocument();

    // Retry button is present.
    expect(
      screen.getByRole('button', { name: /Retry verification email/i }),
    ).toBeInTheDocument();
  });

  it('retry from the error step calls auth.updateUser again and can succeed', async () => {
    // First call fails, second call succeeds.
    hoisted.updateUserMock
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'transient' } })
      .mockResolvedValueOnce({ data: { user: null }, error: null });

    installFetchStub((call) => {
      if (call.url.endsWith('/vpc-upgrade/start')) {
        return jsonResp({ status: 'pending', devToken: 'devtok-retry' });
      }
      if (call.url.endsWith('/vpc-upgrade/confirm-first')) {
        return jsonResp({
          status: 'awaiting-second-confirmation',
          secondConfirmAvailableAt: '2026-05-21T10:00:00.000Z',
        });
      }
      if (call.url.endsWith('/vpc-upgrade/confirm-second')) {
        return jsonResp({ status: 'upgraded' });
      }
      return jsonResp({ error: 'unknown' }, 500);
    });

    render(<AccountUpgradePage />);

    fireEvent.change(screen.getByLabelText(/Your email/i), {
      target: { value: 'parent@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send confirmation email/i }));

    const firstTokenInput = await screen.findByLabelText(/Confirmation token$/i);
    fireEvent.change(firstTokenInput, { target: { value: 'devtok-retry' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm first step/i }));

    await screen.findByText(/come back in 24 hours/i);
    fireEvent.click(screen.getByRole('button', { name: /try second confirmation/i }));

    const secondTokenInput = await screen.findByLabelText(/Confirmation token \(same as before\)/i);
    fireEvent.change(secondTokenInput, { target: { value: 'devtok-retry' } });
    fireEvent.click(screen.getByRole('button', { name: /Finish upgrade/i }));

    // First attempt fails.
    await waitFor(() => {
      expect(screen.getByTestId('link-error')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Retry verification email/i }));

    // Second attempt succeeds.
    await waitFor(() => {
      expect(screen.getByTestId('awaiting-supabase-verify')).toBeInTheDocument();
    });

    expect(hoisted.updateUserMock).toHaveBeenCalledTimes(2);
  });

  it('renders the 4-step indicator with the correct active step', async () => {
    hoisted.updateUserMock.mockResolvedValue({ data: { user: null }, error: null });
    installFetchStub(() => jsonResp({ status: 'pending', devToken: 'devtok-x' }));

    render(<AccountUpgradePage />);

    const list = screen.getByTestId('upgrade-steps');
    const items = list.querySelectorAll('li');
    expect(items.length).toBe(4);
    expect(items[0]?.textContent).toMatch(/Enter your email/i);
    expect(items[1]?.textContent).toMatch(/Check your inbox/i);
    expect(items[2]?.textContent).toMatch(/Wait 24 hours/i);
    expect(items[3]?.textContent).toMatch(/Verify your email with Supabase/i);

    // Step 1 starts active.
    expect(items[0]?.getAttribute('data-active')).toBe('true');
  });
});
