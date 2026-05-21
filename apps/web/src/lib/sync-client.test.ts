/**
 * Sprint 5 S5-3 unit coverage for `flushSyncOutbox` and the
 * anonymous-first 403 surfacing path.
 *
 * Three flows are pinned:
 *   1. 403 with `error: 'anonymous-first'` throws `CloudSyncBlockedError`,
 *      sets the `localStorage` marker, and records an audit-log entry per
 *      pending row.
 *   2. A successful 200 clears the `localStorage` marker so a post-upgrade
 *      sync re-enables the dashboard banner state.
 *   3. A generic non-anonymous-first 403 (e.g. RLS "child-not-owned")
 *      throws a plain `Error` so the dashboard does NOT show the
 *      "verify your email" banner.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const outboxState: Array<{
    id: string;
    child_id: string;
    client_op_id: string;
    op_type: string;
    op_payload: Record<string, unknown>;
    applied_at: string | null;
    created_at: string;
  }> = [];
  const auditState: Array<{
    actor_id: string | null;
    child_id: string | null;
    event_type: string;
    payload: Record<string, unknown>;
    occurred_at: string;
  }> = [];

  const syncOutbox = {
    where: (_field: string) => ({
      equals: (_value: string) => ({
        filter: (fn: (row: { applied_at: string | null }) => boolean) => ({
          limit: (n: number) => ({
            toArray: async () => outboxState.filter(fn).slice(0, n),
          }),
        }),
      }),
    }),
    update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const target = outboxState.find((r) => r.id === id);
      if (target) Object.assign(target, patch);
      return 1;
    }),
  };

  const auditLog = {
    add: vi.fn(async (row: Record<string, unknown>) => {
      auditState.push(row as never);
      return 1;
    }),
  };

  const getSessionMock = vi.fn(async () => ({
    data: { session: { access_token: 'fake-jwt' } },
    error: null,
  }));

  return { outboxState, auditState, syncOutbox, auditLog, getSessionMock };
});

vi.mock('@e4k/db', () => ({
  db: {
    syncOutbox: hoisted.syncOutbox,
    auditLog: hoisted.auditLog,
  },
  getSupabase: () => ({
    auth: { getSession: hoisted.getSessionMock },
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

import {
  CloudSyncBlockedError,
  E4K_SYNC_BLOCKED_KEY,
  flushSyncOutbox,
} from './sync-client';

function seedOutboxRow(childId: string, clientOpId = 'op-1'): void {
  hoisted.outboxState.push({
    id: clientOpId,
    child_id: childId,
    client_op_id: clientOpId,
    op_type: 'progress.upsert',
    op_payload: { lesson_id: 'u1.l1', stars: 3 },
    applied_at: null,
    created_at: new Date().toISOString(),
  });
}

describe('flushSyncOutbox — Sprint 5 S5-3 anonymous-first gate', () => {
  beforeEach(() => {
    hoisted.outboxState.length = 0;
    hoisted.auditState.length = 0;
    hoisted.syncOutbox.update.mockClear();
    hoisted.auditLog.add.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws CloudSyncBlockedError + sets localStorage marker on 403 anonymous-first', async () => {
    seedOutboxRow('child-1');
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: 'anonymous-first',
          message: "Cloud sync isn't active yet. Verify your email...",
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(flushSyncOutbox('child-1')).rejects.toBeInstanceOf(
      CloudSyncBlockedError,
    );

    expect(window.localStorage.getItem(E4K_SYNC_BLOCKED_KEY)).toBe('1');
    // Outbox row was NOT marked applied — must retry after upgrade.
    expect(hoisted.outboxState[0]).toBeDefined();
    expect(hoisted.outboxState[0]?.applied_at).toBeNull();
    // Audit log captures the block reason.
    expect(hoisted.auditLog.add).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'sync.blocked-anonymous',
        payload: expect.objectContaining({ reason: 'anonymous-first' }),
      }),
    );
  });

  it('successful 200 response clears the localStorage marker', async () => {
    seedOutboxRow('child-2', 'op-2');
    window.localStorage.setItem(E4K_SYNC_BLOCKED_KEY, '1');
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [{ clientOpId: 'op-2', status: 'applied' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const summary = await flushSyncOutbox('child-2');
    expect(summary.applied).toBe(1);
    expect(window.localStorage.getItem(E4K_SYNC_BLOCKED_KEY)).toBeNull();
  });

  it('non-anonymous-first 403 throws a generic Error (not CloudSyncBlockedError)', async () => {
    seedOutboxRow('child-3', 'op-3');
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: 'child-not-owned' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      await flushSyncOutbox('child-3');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(CloudSyncBlockedError);
    // The block marker must NOT be set for non-anonymous-first 403s.
    expect(window.localStorage.getItem(E4K_SYNC_BLOCKED_KEY)).toBeNull();
  });
});
