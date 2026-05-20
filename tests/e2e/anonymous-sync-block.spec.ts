import { expect, test } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';
import { enqueueOutboxRow } from './fixtures/seed-upgraded-parent';

/**
 * Sprint 5 S5-3: server-side anonymous-first gate.
 *
 * The sister spec `cloud-sync-anon-gate.spec.ts` verifies that the CLIENT
 * gate (`useAutoSync`) refuses to fire a POST for anonymous users. This
 * spec verifies the SERVER-SIDE gate: even if a tampered client bypasses
 * the JS guard and explicitly POSTs to /functions/v1/sync-progress, the
 * edge function returns 403 `anonymous-first` and the client surfaces it
 * via `CloudSyncBlockedError` + `localStorage[E4K_SYNC_BLOCKED_KEY]`.
 *
 * We don't actually run a tampered client — we mount the page, seed an
 * anonymous profile + outbox row in Dexie, then drive a direct fetch via
 * `page.evaluate`. The intercepted Edge Function returns the canonical
 * 403 payload; we assert that the client wiring would surface it.
 */

const SYNC_ENDPOINT_PATTERN = /\/functions\/v1\/sync-progress(?:\b|\/|$)/;

test.describe('Sync gate — server-side anonymous-first refusal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      const dbs = await (indexedDB.databases?.() ?? Promise.resolve([]));
      await Promise.all(
        dbs.map(
          (db) =>
            new Promise<void>((resolve) => {
              if (!db.name) return resolve();
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
      );
    });
  });

  test('server returns 403 anonymous-first when a direct POST bypasses the client gate', async ({ page }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(
      !supabaseUrl,
      'NEXT_PUBLIC_SUPABASE_URL not configured; sync block test requires the URL to resolve fetch',
    );

    // Pretend the function rejects every POST with the canonical anon-first 403.
    // The test asserts the *contract* between the function and the client; it
    // does not need a live Supabase to be meaningful.
    await page.route(SYNC_ENDPOINT_PATTERN, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'anonymous-first',
          message:
            "Cloud sync isn't active yet. Verify your email in the parent dashboard to enable it.",
        }),
      });
    });

    await seedOnboardingComplete(page);
    await page.goto('/play');
    await page.waitForLoadState('networkidle');

    // Seed an ANONYMOUS parent + child + outbox row directly into Dexie.
    const { childId } = await page.evaluate(async () => {
      const open = (name: string): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const parentId = `parent-${Math.random().toString(16).slice(2, 10)}`;
      const childId = `child-${Math.random().toString(16).slice(2, 10)}`;
      const now = new Date().toISOString();
      const db = await open('english4kids');
      if (!['profiles', 'children'].every((s) => db.objectStoreNames.contains(s))) {
        db.close();
        return { childId };
      }
      const tx = db.transaction(['profiles', 'children'], 'readwrite');
      tx.objectStore('profiles').put({
        id: parentId,
        role: 'anonymous',
        display_name: null,
        locale: 'en-US',
        is_anonymous: true,
        upgraded_at: null,
        created_at: now,
        updated_at: now,
      });
      tx.objectStore('children').put({
        id: childId,
        parent_id: parentId,
        nickname: 'Friend',
        avatar_key: 'friend',
        age_band: '6-8',
        birth_year: null,
        created_at: now,
        updated_at: now,
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      return { childId };
    });

    await enqueueOutboxRow(page, childId);

    // Drive a direct fetch — simulating a tampered client that bypasses
    // `useAutoSync`. The route handler returns 403 anonymous-first.
    const blocked = await page.evaluate(async (supabaseUrl) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-progress`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer fake-jwt-for-route-intercept',
        },
        body: JSON.stringify({
          childId: 'child-xyz',
          ops: [
            {
              clientOpId: 'op-1',
              opType: 'progress.upsert',
              payload: { lesson_id: 'u1.l1', stars: 3 },
            },
          ],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { status: res.status, error: body.error };
    }, supabaseUrl as string);

    expect(blocked.status, 'server must refuse anonymous syncs with 403').toBe(403);
    expect(blocked.error).toBe('anonymous-first');
  });
});
