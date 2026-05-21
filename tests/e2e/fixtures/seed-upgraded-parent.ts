import type { Page } from '@playwright/test';
import { seedOnboardingComplete, type SeedOnboardingOptions } from './seed-onboarding-complete';

/**
 * Seeds Dexie with onboarding-complete state AND a non-anonymous parent
 * profile + child row so cloud-sync tests can flush the `sync_outbox`
 * without driving the VPC math gate or the email confirmation flow.
 *
 * Why bypass VPC: the VPC flow is itself E2E-covered by
 * `parent-vpc.spec.ts`. Sync tests that depend on `is_anonymous=false`
 * become noisy if they run the entire VPC sequence per test — instead we
 * stamp the post-VPC state directly into Dexie.
 *
 * Returns the child id so the test can use it to call `useAutoSync(childId)`
 * or to queue rows into the outbox.
 */
export interface SeedUpgradedParentResult {
  childId: string;
  parentId: string;
}

export async function seedUpgradedParent(
  page: Page,
  options: SeedOnboardingOptions = {},
): Promise<SeedUpgradedParentResult> {
  await seedOnboardingComplete(page, options);

  const ids = await page.evaluate(async () => {
    const parentId = `parent-${Math.random().toString(16).slice(2, 10)}`;
    const childId = `child-${Math.random().toString(16).slice(2, 10)}`;
    const now = new Date().toISOString();

    // Dexie database name (see packages/db/src/dexie.ts).
    const open = (name: string): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

    try {
      const db = await open('english4kids');
      const stores = ['profiles', 'children'];
      if (!stores.every((s) => db.objectStoreNames.contains(s))) {
        // Schema not yet materialized — let the app create it on first use.
        // The localStorage + settings rows from seedOnboardingComplete are
        // still enough for the test to make progress.
        db.close();
        return { parentId, childId };
      }
      const tx = db.transaction(stores, 'readwrite');
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
    } catch {
      // Best-effort: tests should still be able to assert against
      // localStorage-only state.
    }

    return { parentId, childId };
  });

  return ids;
}

/**
 * Queues a synthetic row into the local `sync_outbox` so a flush has work to
 * do. Returns the `client_op_id` for later assertions.
 */
export async function enqueueOutboxRow(
  page: Page,
  childId: string,
  opType = 'progress.completed',
): Promise<string> {
  return page.evaluate(
    async ({ childId, opType }) => {
      const open = (name: string): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await open('english4kids');
      const clientOpId = `op-${Math.random().toString(16).slice(2, 10)}`;
      if (!db.objectStoreNames.contains('syncOutbox')) {
        db.close();
        return clientOpId;
      }
      const tx = db.transaction('syncOutbox', 'readwrite');
      tx.objectStore('syncOutbox').put({
        id: clientOpId,
        child_id: childId,
        client_op_id: clientOpId,
        op_type: opType,
        op_payload: { lesson_id: 'u1.l1', stars: 3 },
        applied_at: null,
        created_at: new Date().toISOString(),
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      return clientOpId;
    },
    { childId, opType },
  );
}

/**
 * Clears every Dexie database and storage bucket — call from `test.beforeEach`
 * to guarantee no cross-test contamination.
 */
export async function clearLocalState(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const dbs = await (indexedDB.databases?.() ?? Promise.resolve([]));
    await Promise.all(
      dbs.map(
        (db) =>
          new Promise<void>((resolve) => {
            if (!db.name) {
              resolve();
              return;
            }
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          }),
      ),
    );
  });
}
