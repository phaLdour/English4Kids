import { expect, test } from '@playwright/test';

/**
 * Coarse performance smoke test (Sprint 4 S4-4).
 *
 * The authoritative perf budget lives in `.github/workflows/lighthouse.yml`
 * (mobile-throttled Lighthouse CI). This spec is a fast, in-CI sanity check
 * that catches catastrophic regressions in the dev / local pipeline before
 * a PR even reaches the Lighthouse job:
 *
 *   - LCP must land within 4 seconds on the dev server (Lighthouse target
 *     is 2.5 s under mobile throttling; the loose 4 s threshold here is
 *     headroom for the unthrottled dev build + headless overhead).
 *   - Total initial JS transferred must be under 250 KB. Sprint 5 will
 *     tighten this to the 180 KB target after the Wave-B optimisations
 *     (Sentry dynamic-import, bundle-analyzer pruning) are merged.
 *   - `networkidle` should resolve under 8 s — a coarse TTI proxy that
 *     fails loudly if a new dependency starts a long-running fetch loop.
 */

const PERF_PAGE = '/play';

test.describe('Perf smoke', () => {
  test('LCP, network-idle, and initial JS payload are within Sprint 4 ceilings', async ({
    page,
  }) => {
    const jsBytes = { total: 0 };
    page.on('response', async (res) => {
      const type = res.request().resourceType();
      if (type !== 'script') return;
      const url = res.url();
      // Only count first-party origin resources (i.e. the app shell).
      if (!url.startsWith('http://localhost:3000')) return;
      try {
        const body = await res.body();
        jsBytes.total += body.byteLength;
      } catch {
        // Some responses may be cancelled or HEAD — skip silently.
      }
    });

    const navStart = Date.now();
    await page.goto(PERF_PAGE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    const networkIdleMs = Date.now() - navStart;

    // FCP / LCP via the Performance Paint Timing API. LCP is sourced from
    // the largest-contentful-paint observer; we record the latest entry.
    const paintMetrics = await page.evaluate(() => {
      const paints = performance.getEntriesByType('paint');
      const fcpEntry = paints.find((p) => p.name === 'first-contentful-paint');
      const fcp = fcpEntry ? fcpEntry.startTime : null;

      return new Promise<{ fcp: number | null; lcp: number | null }>((resolve) => {
        let lcp: number | null = null;
        try {
          const obs = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              lcp = entries[entries.length - 1]?.startTime ?? null;
            }
          });
          obs.observe({ type: 'largest-contentful-paint', buffered: true });
          // Give the observer a tick to flush buffered entries.
          setTimeout(() => {
            obs.disconnect();
            resolve({ fcp, lcp });
          }, 250);
        } catch {
          resolve({ fcp, lcp: null });
        }
      });
    });

    // Soft thresholds; Lighthouse CI is authoritative for hard budgets.
    if (paintMetrics.lcp !== null) {
      expect(paintMetrics.lcp).toBeLessThan(4000);
    }
    expect(networkIdleMs).toBeLessThan(8000);
    expect(jsBytes.total).toBeLessThan(250 * 1024);
  });
});
