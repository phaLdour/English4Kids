import { expect, test, type Page } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';
import { clearLocalState } from './fixtures/seed-upgraded-parent';

/**
 * Mascot variant + voice routing.
 *
 * Phase 2 added Luna as a second mascot. The runtime contract:
 *   - User chooses `mascot.choice` = 'milo' | 'luna' | 'both'.
 *   - 'both' picks a deterministic mascot per activity id (FNV1a parity).
 *   - Narration assets follow the namespaced ids `vo.milo.<key>` and
 *     `vo.luna.<key>`; when the active mascot's variant is not in the
 *     audio map, `resolveNarrationAsset` falls back to the original id.
 *
 * This spec covers:
 *   1. Luna onboarding -> the `<MascotFrame>` renders with `data-mascot="luna"`.
 *   2. Audio asset ids requested by the activity carry a `vo.milo.` or
 *      `vo.luna.` prefix (or are non-vo, e.g. song/sfx).
 *   3. 'both' mode is DETERMINISTIC: the same activity always uses the
 *      same mascot.
 */

const VO_PREFIX = /vo\.(milo|luna)\./;

interface AudioRequest {
  url: string;
  method: string;
}

function watchAudioRequests(page: Page, bucket: AudioRequest[]): void {
  page.on('request', (req) => {
    const url = req.url();
    if (/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url)) {
      bucket.push({ url, method: req.method() });
    }
  });
}

test.describe('Mascot variant + voice routing', () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalState(page);
  });

  test('Luna onboarding renders Luna mascot frame', async ({ page }) => {
    await seedOnboardingComplete(page, { mascot: 'luna' });

    await page.goto('/play');
    await page.waitForLoadState('networkidle');

    // The MascotFrame is rendered globally on play surfaces. We assert that
    // at least one frame is data-mascot="luna" — the attribute lives on the
    // wrapper div (see packages/ui/src/components/MascotFrame.tsx).
    const lunaFrame = page.locator('[data-mascot="luna"]').first();
    await expect(lunaFrame, 'expected a Luna mascot frame on /play').toBeVisible();
    const miloFrame = page.locator('[data-mascot="milo"]');
    await expect(miloFrame, 'expected no Milo frame when the user chose Luna').toHaveCount(0);
  });

  test('audio asset ids respect mascot namespace or fall back gracefully', async ({ page }) => {
    await seedOnboardingComplete(page, { mascot: 'luna' });

    const audioRequests: AudioRequest[] = [];
    watchAudioRequests(page, audioRequests);

    await page.goto('/play/01-me-and-my-world');
    await page.waitForLoadState('networkidle');

    // Every audio asset URL that contains a `vo.*` token must be either
    // `vo.luna.*` (Luna variant) OR `vo.milo.*` (Milo fallback). The
    // alternative — a `vo.*` asset belonging to neither namespace — would
    // mean the runtime mascot routing leaked a non-namespaced asset id.
    const voRequests = audioRequests.filter((r) => /vo\.[a-z]+\./.test(r.url));
    for (const r of voRequests) {
      expect(r.url, `vo asset "${r.url}" should be vo.milo.* or vo.luna.*`).toMatch(VO_PREFIX);
    }
  });

  test("'both' mode is deterministic across reloads", async ({ page }) => {
    await seedOnboardingComplete(page);
    // Force 'both' into Dexie since the onboarding helper only persists milo/luna.
    await page.evaluate(async () => {
      const open = (name: string): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await open('english4kids');
      if (!db.objectStoreNames.contains('settings')) {
        db.close();
        return;
      }
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key: 'mascot.choice', value: 'both' });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    });

    // Visit the lesson twice and assert the same mascot renders both times.
    const path = '/play/01-me-and-my-world/lesson/u1.l1';
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const firstMascot = await page.locator('[data-mascot]').first().getAttribute('data-mascot');

    await page.reload();
    await page.waitForLoadState('networkidle');
    const secondMascot = await page.locator('[data-mascot]').first().getAttribute('data-mascot');

    expect(firstMascot, 'first visit should render a mascot').not.toBeNull();
    expect(
      secondMascot,
      `'both' mode should be deterministic; first=${firstMascot ?? 'null'}, second=${secondMascot ?? 'null'}`,
    ).toBe(firstMascot);
  });
});
