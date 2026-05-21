import { expect, test, type Page } from '@playwright/test';
import { clearLocalState } from './fixtures/seed-upgraded-parent';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * Locale switching — Phase 2 i18n surface coverage.
 *
 * Walks the settings → language toggle from EN → TR → EN and asserts that:
 *   - At least 3 unique Turkish strings appear on screen after switching to TR.
 *   - The choice survives a hard reload (Dexie `ui.locale` persistence).
 *   - Switching back to EN restores English copy.
 *
 * Coverage is intentionally lenient: the TR translation pass is being
 * delivered by a sister subagent; some surfaces may still be EN-only. The
 * test asserts "any three of these Turkish strings appear" rather than
 * pinning a specific component.
 */

const TR_PROBES: ReadonlyArray<string> = [
  'Ses',
  'Konuş',
  'Mikrofon',
  'Ünite',
  'Yıldız',
  'Türkçe',
  'Uygulama dili',
];

const EN_PROBES: ReadonlyArray<string> = ['Sound', 'Talk', 'Microphone', 'Unit', 'English'];

async function countVisible(page: Page, terms: ReadonlyArray<string>): Promise<number> {
  let hits = 0;
  for (const term of terms) {
    // Use a case-sensitive substring match: TR strings have diacritics we
    // want to honor and EN/TR don't share these surface tokens.
    const located = page.locator(`text=${term}`).first();
    if ((await located.count()) > 0) {
      hits += 1;
    }
  }
  return hits;
}

async function chooseLocale(page: Page, locale: 'en' | 'tr'): Promise<void> {
  await page.goto('/settings');
  // The locale radio group's two cards are labelled with the localised name
  // ("English" / "Türkçe"). Both labels stay the same in either bundle so
  // the click works regardless of the active locale.
  const labelText = locale === 'tr' ? /Türkçe/ : /English/;
  const card = page.getByText(labelText).first();
  await expect(card).toBeVisible();
  await card.click();
  // Wait briefly for the I18nProvider to swap the bundle.
  await page.waitForTimeout(300);
}

test.describe('Locale switch — EN ↔ TR', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalState(page);
    await seedOnboardingComplete(page);
  });

  test('switching to TR translates at least 3 visible strings', async ({ page }) => {
    await chooseLocale(page, 'tr');

    // Land on a page that exercises localised chrome (settings is fine).
    await page.goto('/settings');
    const trHits = await countVisible(page, TR_PROBES);
    expect(
      trHits,
      `expected at least 3 Turkish strings on /settings, saw ${trHits}`,
    ).toBeGreaterThanOrEqual(3);
  });

  test('TR choice persists across a reload', async ({ page }) => {
    await chooseLocale(page, 'tr');

    // Hard reload — confirm Dexie persistence + provider rehydration.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.goto('/settings');

    const trHits = await countVisible(page, TR_PROBES);
    expect(
      trHits,
      `TR locale did not survive reload (only ${trHits} TR hits)`,
    ).toBeGreaterThanOrEqual(3);

    // Also assert the underlying setting in Dexie.
    const stored = await page.evaluate(async () => {
      const open = (name: string): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await open('english4kids');
      if (!db.objectStoreNames.contains('settings')) {
        db.close();
        return null;
      }
      const tx = db.transaction('settings', 'readonly');
      const value = await new Promise<unknown>((resolve, reject) => {
        const req = tx.objectStore('settings').get('ui.locale');
        req.onsuccess = () => resolve((req.result as { value?: unknown } | undefined)?.value);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return value;
    });
    expect(stored).toBe('tr');
  });

  test('switching back to EN restores English copy', async ({ page }) => {
    await chooseLocale(page, 'tr');
    await chooseLocale(page, 'en');

    await page.goto('/settings');
    const enHits = await countVisible(page, EN_PROBES);
    expect(
      enHits,
      `expected at least 3 English strings after switching back, saw ${enHits}`,
    ).toBeGreaterThanOrEqual(3);
  });
});
