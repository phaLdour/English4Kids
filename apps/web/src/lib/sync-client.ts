'use client';

/**
 * Cloud sync client — flushes the local Dexie `sync_outbox` to the
 * `sync-progress` Supabase Edge Function.
 *
 * Activation contract (Safety Officer red line):
 *   Sync is OFF unless `profiles.is_anonymous === false` — i.e. the parent
 *   has completed the Phase 2 email-plus VPC upgrade. Anonymous-first
 *   means a guest user NEVER syncs to cloud. The guard lives in
 *   `useAutoSync`, which short-circuits on every trigger if the active
 *   profile is still anonymous.
 *
 * Idempotency: every op carries a `client_op_id` (created when the row was
 * appended to Dexie). The Edge Function dedupes against the server-side
 * `sync_outbox` table. Duplicates are reported and locally marked as
 * applied so we don't keep retrying.
 *
 * Batch size cap: 50 ops/request. The Edge Function will accept up to 100;
 * we leave headroom for the response payload.
 */

import { db, getSupabase } from '@e4k/db';
import { useCallback, useEffect, useRef, useState } from 'react';

const BATCH_SIZE = 50;

export interface SyncSummary {
  applied: number;
  duplicates: number;
  rejected: number;
}

interface OpResult {
  clientOpId: string;
  status: 'applied' | 'duplicate' | 'rejected';
  reason?: string;
}

interface SyncResponse {
  results: OpResult[];
}

/**
 * Sprint 5 S5-3: typed error thrown when the server returns 403 with
 * `error: 'anonymous-first'`. Catchers can branch on this and surface a
 * "verify your email" banner instead of treating it as a generic failure.
 *
 * The mirror state lives in `localStorage[E4K_SYNC_BLOCKED_KEY]` so the
 * parent dashboard can render the banner without re-issuing a sync to
 * discover the block. Cleared as soon as a sync succeeds.
 */
export const E4K_SYNC_BLOCKED_KEY = 'e4k.cloudSyncBlocked';

export class CloudSyncBlockedError extends Error {
  readonly kind = 'anonymous-first' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CloudSyncBlockedError';
  }
}

function resolveFunctionUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  return `${base.replace(/\/$/, '')}/functions/v1/sync-progress`;
}

async function postBatch(
  childId: string,
  ops: Array<{ clientOpId: string; opType: string; payload: Record<string, unknown> }>,
  accessToken: string,
): Promise<SyncResponse> {
  const res = await fetch(resolveFunctionUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ childId, ops }),
  });
  if (res.status === 403) {
    // Sprint 5 S5-3: the server gate refused because the parent profile is
    // still anonymous. Parse the body for the typed error code so we don't
    // confuse this with an RLS-level "child-not-owned" 403.
    let parsed: { error?: string; message?: string } | null = null;
    try {
      parsed = (await res.json()) as { error?: string; message?: string };
    } catch {
      parsed = null;
    }
    if (parsed?.error === 'anonymous-first') {
      throw new CloudSyncBlockedError(parsed.message ?? 'anonymous-first');
    }
    throw new Error(`sync-progress responded 403 ${parsed?.error ?? ''}`.trim());
  }
  if (!res.ok) {
    throw new Error(`sync-progress responded ${res.status}`);
  }
  return (await res.json()) as SyncResponse;
}

/**
 * Flush all pending sync_outbox rows for a child. Returns counts of each
 * result status. Pending rows are read in batches of `BATCH_SIZE`.
 *
 * On a successful response, each per-op result is reflected back into the
 * local Dexie row's `applied_at` so we don't re-send. Rejected ops are
 * left as pending — they will retry on the next flush. (We could add a
 * dead-letter table later; for MVP the developer console + the audit-log
 * 'sync.rejected' event is enough.)
 */
export async function flushSyncOutbox(childId: string): Promise<SyncSummary> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) {
    throw new Error('no-session');
  }

  const summary: SyncSummary = { applied: 0, duplicates: 0, rejected: 0 };

  // Walk the outbox in batches until empty.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pending = await db.syncOutbox
      .where('child_id')
      .equals(childId)
      .filter((row) => row.applied_at == null)
      .limit(BATCH_SIZE)
      .toArray();

    if (pending.length === 0) break;

    const ops = pending.map((row) => ({
      clientOpId: row.client_op_id,
      opType: row.op_type,
      payload: row.op_payload,
    }));

    let resp: SyncResponse;
    try {
      resp = await postBatch(childId, ops, accessToken);
    } catch (err) {
      if (err instanceof CloudSyncBlockedError) {
        // Sprint 5 S5-3: persist a marker so the parent dashboard can render
        // a "verify your email to enable sync" banner without re-firing the
        // sync. Also stamp every pending outbox row with an audit-log entry
        // so the rejection is visible — we deliberately leave `applied_at`
        // null so the row retries after the upgrade.
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(E4K_SYNC_BLOCKED_KEY, '1');
          }
        } catch {
          // localStorage may be disabled (Safari private mode). Ignore.
        }
        const nowIso = new Date().toISOString();
        for (const row of pending) {
          try {
            await db.auditLog.add({
              id: 0 as unknown as number,
              actor_id: null,
              child_id: row.child_id,
              event_type: 'sync.blocked-anonymous',
              payload: {
                client_op_id: row.client_op_id,
                op_type: row.op_type,
                reason: 'anonymous-first',
              },
              occurred_at: nowIso,
            });
          } catch {
            // audit-log add is best-effort.
          }
        }
      }
      // Network or server error — abort the loop and let the caller retry.
      throw err;
    }

    // Sprint 5 S5-3: any successful batch clears the blocked marker. An
    // upgrade-then-resync sequence is now observable to the dashboard
    // without a manual refresh.
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(E4K_SYNC_BLOCKED_KEY);
      }
    } catch {
      // ignore
    }

    const nowIso = new Date().toISOString();
    const byClientOpId = new Map(resp.results.map((r) => [r.clientOpId, r]));

    for (const row of pending) {
      const result = byClientOpId.get(row.client_op_id);
      if (!result) continue;
      if (result.status === 'applied' || result.status === 'duplicate') {
        await db.syncOutbox.update(row.id, { applied_at: nowIso });
        if (result.status === 'applied') summary.applied += 1;
        else summary.duplicates += 1;
      } else {
        summary.rejected += 1;
        // Leave applied_at null; will retry. Drop in a one-time audit log
        // entry so the parent dashboard can surface 'something didn't sync'.
        try {
          await db.auditLog.add({
            id: 0 as unknown as number, // Dexie auto-increments; placeholder.
            actor_id: null,
            child_id: row.child_id,
            event_type: 'sync.rejected',
            payload: {
              client_op_id: row.client_op_id,
              op_type: row.op_type,
              reason: result.reason ?? 'unknown',
            },
            occurred_at: nowIso,
          });
        } catch {
          // audit-log add is best-effort.
        }
      }
    }

    // Defensive break: if the server returned fewer results than we sent,
    // something is off — don't loop forever.
    if (resp.results.length < ops.length) break;
  }

  return summary;
}

// ----------------------------------------------------------------------------
// React hook
// ----------------------------------------------------------------------------

export interface UseAutoSyncResult {
  syncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  /**
   * Sprint 5 S5-3: true iff the server most recently refused a flush with
   * `anonymous-first`. The Parent Dashboard reads this to surface a banner.
   * Distinct from generic `error` because the UX response is different:
   * users are sent to `/parent/account`, not asked to retry.
   */
  blockedAnonymous: boolean;
}

/**
 * Auto-sync hook. Runs on mount, on `online`, and on tab-visibility-change
 * to visible.
 *
 * Sync is GATED on `profiles.is_anonymous === false` — pre-VPC profiles
 * never sync. The check is repeated on every trigger so an upgrade
 * activates sync without a page reload.
 */
export function useAutoSync(childId: string | null): UseAutoSyncResult {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockedAnonymous, setBlockedAnonymous] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(E4K_SYNC_BLOCKED_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Prevent overlapping flushes from the three triggers all firing at once.
  const inFlight = useRef(false);

  const runSync = useCallback(async () => {
    if (!childId) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    setError(null);
    try {
      // Gate 1: caller's child must exist locally.
      const child = await db.children.get(childId);
      if (!child) return;

      // Gate 2: only sync once the parent profile is non-anonymous.
      const parent = await db.profiles.get(child.parent_id);
      if (!parent || parent.is_anonymous !== false) {
        // Anonymous-first: explicitly skip. No telemetry leaves the device.
        return;
      }

      await flushSyncOutbox(childId);
      setLastSyncAt(new Date().toISOString());
      setBlockedAnonymous(false);
    } catch (err) {
      if (err instanceof CloudSyncBlockedError) {
        // Sprint 5 S5-3: server refused. Surface as the dedicated flag so the
        // UI can route the parent to the upgrade page rather than showing a
        // generic retry banner.
        setBlockedAnonymous(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'sync-failed');
      }
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [childId]);

  useEffect(() => {
    if (!childId) return;
    void runSync();

    const onOnline = (): void => {
      void runSync();
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void runSync();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [childId, runSync]);

  return { syncing, lastSyncAt, error, blockedAnonymous };
}
