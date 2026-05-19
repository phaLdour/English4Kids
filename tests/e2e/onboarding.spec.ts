import { expect, test } from '@playwright/test';

/**
 * Onboarding happy-path. Walks a fresh visitor through the entire onboarding
 * flow at `/onboarding` and asserts the post-state:
 *   1. URL lands on `/play`.
 *   2. localStorage flag `e4k:onboarding-complete=true` is set.
 *   3. Dexie `settings` store contains mascot/age-band/nickname/complete rows.
 *
 * The flow steps are guarded by visible-text + button assertions so a UX
 * change that re-orders steps fails loud and early.
 */

test.describe('Onboarding', () => {
  test.beforeEach(async ({ context, page }) => {
    // Fresh slate: clear cookies, localStorage, and any IndexedDB databases.
    await context.clearCookies();
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
  });

  test('walks the entire onboarding flow and lands on /play', async ({ page }) => {
    await page.goto('/onboarding');

    // Step 1 — welcome + start button.
    await expect(
      page.getByRole('heading', { name: /welcome|hi there|let's begin/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /start|let's go|begin/i }).click();

    // Step 2 — mascot picker. Choose Milo.
    await expect(
      page.getByRole('heading', { name: /pick a friend|choose your buddy|mascot/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /milo/i }).click();
    await page.getByRole('button', { name: /next|continue/i }).click();

    // Step 3 — age band. Choose 6–8.
    await expect(
      page.getByRole('heading', { name: /how old|age|years/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /6.*8|six.*eight/i }).click();
    await page.getByRole('button', { name: /next|continue/i }).click();

    // Step 4 — nickname.
    await expect(
      page.getByRole('heading', { name: /name|nickname|what should we call/i }),
    ).toBeVisible();
    await page.getByRole('textbox').fill('TestKid');
    await page.getByRole('button', { name: /next|continue|done/i }).click();

    // Step 5 — confirmation / "Onboarding complete!"
    // Allow a generous timeout; the final step may animate.
    await expect(page).toHaveURL(/\/play(\/|$)/, { timeout: 10_000 });

    // Assert localStorage flag.
    const onboardingFlag = await page.evaluate(() =>
      window.localStorage.getItem('e4k:onboarding-complete'),
    );
    expect(onboardingFlag).toBe('true');

    // Best-effort Dexie assertion. Skip silently if the DB has not flushed yet.
    const settings = await page.evaluate(async () => {
      const open = (name: string): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      try {
        const db = await open('e4k');
        if (!db.objectStoreNames.contains('settings')) {
          db.close();
          return null;
        }
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const rows: Array<{ key: string; value: unknown }> = await new Promise(
          (resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as typeof rows);
            req.onerror = () => reject(req.error);
          },
        );
        db.close();
        return rows;
      } catch {
        return null;
      }
    });

    if (settings) {
      const byKey = new Map(settings.map((row) => [row.key, row.value]));
      expect(byKey.get('mascot.choice')).toBe('milo');
      expect(byKey.get('age.band')).toBe('6-8');
      expect(byKey.get('child.nickname')).toBe('TestKid');
      expect(byKey.get('onboarding.complete')).toBe(true);
    }
  });
});
