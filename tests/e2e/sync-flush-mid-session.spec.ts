import { expect, test } from '@playwright/test';
import {
  clearLocalState,
  enqueueOutboxRow,
  seedUpgradedParent,
} from './fixtures/seed-upgraded-parent';

/**
 * Sync flush during route transitions.
 *
 * Verifies the offline→online resilience of the sync hook:
 *   1. Seed an upgraded parent + queue rows into `sync_outbox`.
 *   2. Take the context offline mid-session.
 *   3. Navigate to a new route (no sync should fire).
 *   4. Take the context back online.
 *   5. Assert the queued rows' `applied_at` becomes non-null within a
 *      generous timeout.
 *
 * Like the other live-sync specs, this requires a Supabase URL to be set; we
 * still intercept the request and return a synthetic "applied" payload so
 * CI can run without real credentials.
 */

const SYNC_ENDPOINT_PATTERN = /\/functions\/v1\/sync-progress(?:\b|\/|$)/;

test.describe('Sync flush — offline → online during a session', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalState(page);
  });

  test('queued outbox rows flush when connectivity returns', async ({ page, context }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(
      !supabaseUrl,
      'NEXT_PUBLIC_SUPABASE_URL not configured; sync flush test requires a Supabase URL',
    );

    const { childId } = await seedUpgradedParent(page);

    // Intercept the sync endpoint with a deterministic "applied" response.
    await page.route(SYNC_ENDPOINT_PATTERN, async (route) => {
      const req = route.request();
      const body = req.postDataJSON() as { ops?: Array<{ clientOpId: string }> } | undefined;
      const results = (body?.ops ?? []).map((op) => ({
        clientOpId: op.clientOpId,
        status: 'applied' as const,
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results }),
      });
    });

    // Visit /play once so the app shell + sync hook mount.
    await page.goto('/play');
    await page.waitForLoadState('networkidle');

    // Go offline and queue a row — the sync hook should NOT post.
    await context.setOffline(true);
    const opId = await enqueueOutboxRow(page, childId);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Back online — the `online` event should re-trigger the flush.
    const flushed = page
      .waitForRequest((req) => req.method() === 'POST' && SYNC_ENDPOINT_PATTERN.test(req.url()), {
        timeout: 15_000,
      })
      .catch(() => null);
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    const flushReq = await flushed;
    expect(flushReq, 'sync flush should fire on `online` event').not.toBeNull();

    // Confirm the row's `applied_at` becomes non-null.
    await page.waitForFunction(
      async (opId) => {
        const open = (name: string): Promise<IDBDatabase> =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open(name);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        const db = await open('english4kids');
        if (!db.objectStoreNames.contains('syncOutbox')) {
          db.close();
          return false;
        }
        const tx = db.transaction('syncOutbox', 'readonly');
        const row = await new Promise<{ applied_at: string | null } | undefined>(
          (resolve, reject) => {
            const req = tx.objectStore('syncOutbox').get(opId);
            req.onsuccess = () => resolve(req.result as { applied_at: string | null } | undefined);
            req.onerror = () => reject(req.error);
          },
        );
        db.close();
        return !!row && row.applied_at !== null;
      },
      opId,
      { timeout: 10_000 },
    );
  });
});
