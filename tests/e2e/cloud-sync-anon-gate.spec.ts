import { expect, test, type Request } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';
import { clearLocalState, enqueueOutboxRow } from './fixtures/seed-upgraded-parent';

/**
 * Cloud-sync anonymous-first gate.
 *
 * Safety contract (see `apps/web/src/lib/sync-client.ts`):
 *   Sync is OFF unless `profiles.is_anonymous === false`. The gate lives in
 *   `useAutoSync`, which short-circuits on every trigger.
 *
 * This spec verifies:
 *   1. Anonymous users NEVER POST to `/functions/v1/sync-progress`.
 *   2. After flipping `is_anonymous = false` via Dexie, the next sync
 *      trigger DOES post to `/functions/v1/sync-progress`.
 *
 * Why we set the flag via Dexie instead of running the VPC flow: the VPC
 * flow is covered exhaustively by `parent-vpc.spec.ts`. This spec is
 * targeted at the sync gate alone.
 */

const SYNC_ENDPOINT_PATTERN = /\/functions\/v1\/sync-progress(?:\b|\/|$)/;

interface SyncRequestSnapshot {
  url: string;
  method: string;
  postedAt: number;
}

function watchSyncRequests(
  page: import('@playwright/test').Page,
  bucket: SyncRequestSnapshot[],
): void {
  const handler = (req: Request): void => {
    if (req.method() !== 'POST') return;
    if (!SYNC_ENDPOINT_PATTERN.test(req.url())) return;
    bucket.push({ url: req.url(), method: req.method(), postedAt: Date.now() });
  };
  page.on('request', handler);
}

test.describe('Cloud sync — anonymous-first gate', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalState(page);
  });

  test('anonymous user never POSTs to /functions/v1/sync-progress', async ({ page }) => {
    const syncRequests: SyncRequestSnapshot[] = [];
    watchSyncRequests(page, syncRequests);

    await seedOnboardingComplete(page);

    // Walk a couple of routes that mount the sync hook.
    await page.goto('/play');
    await page.waitForLoadState('networkidle');
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Even with rows queued in the outbox the anonymous gate must NOT fire.
    // (We don't have a child id here; the hook still no-ops cleanly.)
    expect(
      syncRequests,
      `Anonymous profile leaked sync POSTs:\n${JSON.stringify(syncRequests, null, 2)}`,
    ).toEqual([]);
  });

  test('flipping is_anonymous=false enables sync on the next trigger', async ({ page }) => {
    // This test depends on a live Supabase URL to even resolve the POST URL
    // — without it the sync client throws before fetching. Skip cleanly so
    // CI without secrets stays green.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(
      !supabaseUrl,
      'NEXT_PUBLIC_SUPABASE_URL not configured; sync gate test requires a Supabase URL',
    );

    const syncRequests: SyncRequestSnapshot[] = [];
    watchSyncRequests(page, syncRequests);

    // Intercept the sync endpoint so we don't actually hit the live function
    // — the test only cares that the request fires.
    await page.route(SYNC_ENDPOINT_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      });
    });

    await seedOnboardingComplete(page);

    // Visit a page once to materialize Dexie + the app shell.
    await page.goto('/play');
    await page.waitForLoadState('networkidle');

    // Programmatically upgrade the profile + queue an outbox row.
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
        role: 'parent',
        display_name: 'Test Parent',
        locale: 'en-US',
        is_anonymous: false,
        upgraded_at: now,
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

    // Queue work for the outbox so the flush has something to send.
    await enqueueOutboxRow(page, childId);

    // Trigger a sync: re-fire the `online` event the hook listens to.
    const syncFiredPromise = page
      .waitForRequest((req) => req.method() === 'POST' && SYNC_ENDPOINT_PATTERN.test(req.url()), {
        timeout: 10_000,
      })
      .catch(() => null);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    const req = await syncFiredPromise;
    expect(
      req,
      `Expected a POST to /functions/v1/sync-progress after upgrading; saw ${syncRequests.length} sync request(s) before timeout`,
    ).not.toBeNull();
    if (req) {
      expect(req.url()).toMatch(SYNC_ENDPOINT_PATTERN);
    }
  });
});
