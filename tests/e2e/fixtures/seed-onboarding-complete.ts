import type { Page } from '@playwright/test';

/**
 * Seeds Dexie + localStorage with onboarding-complete state so lesson tests
 * can deep-link into /play without walking through onboarding each time.
 *
 * Strategy:
 *   1. Set a synchronous localStorage flag (used by middleware/route guards).
 *   2. Open the Dexie database the app uses (`e4k`) and write the canonical
 *      settings rows the onboarding flow would have produced.
 *
 * If the Dexie schema is not yet available in the page (e.g. dev server
 * compiling), the helper still sets the localStorage flag so the test can
 * proceed; the app will lazily reconcile settings on next mount.
 */
export interface SeedOnboardingOptions {
  mascot?: 'milo' | 'luna';
  ageBand?: '6-8' | '9-12';
  nickname?: string;
}

export async function seedOnboardingComplete(
  page: Page,
  options: SeedOnboardingOptions = {},
): Promise<void> {
  const seed = {
    mascot: options.mascot ?? 'milo',
    ageBand: options.ageBand ?? '6-8',
    nickname: options.nickname ?? 'Friend',
  };

  // Make sure we have a same-origin context before touching storage APIs.
  await page.goto('/');

  await page.evaluate(async (data) => {
    // localStorage flag — read synchronously by route guards.
    window.localStorage.setItem('e4k:onboarding-complete', 'true');
    window.localStorage.setItem('e4k:mascot', data.mascot);
    window.localStorage.setItem('e4k:age-band', data.ageBand);
    window.localStorage.setItem('e4k:nickname', data.nickname);

    // Dexie write — best-effort. Dexie may not be loaded on the landing page.
    const open = (name: string): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };
      });

    try {
      const db = await open('e4k');
      if (db.objectStoreNames.contains('settings')) {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        store.put({ key: 'mascot.choice', value: data.mascot });
        store.put({ key: 'age.band', value: data.ageBand });
        store.put({ key: 'child.nickname', value: data.nickname });
        store.put({ key: 'onboarding.complete', value: true });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      }
      db.close();
    } catch {
      // Swallow — localStorage flag is enough for route guards in Sprint 2.
    }
  }, seed);
}
