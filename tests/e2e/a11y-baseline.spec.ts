/**
 * Accessibility baseline.
 *
 * Runs axe-core across the major routes and fails on any
 * `critical` or `serious` violation that maps to a WCAG 2.0 A / AA rule.
 * Lower-severity issues (moderate, minor) and best-practice flags are not
 * gated here — they get tracked by Design Review, not CI.
 *
 * Why this list of routes:
 *   - the marketing/onboarding/parent surfaces — accessibility is a legal
 *     baseline.
 *   - the player routes — a child using AT (switch input, screen magnifier,
 *     reduced-motion) MUST be able to complete a lesson. We seed onboarding
 *     so the player isn't gated behind the questionnaire.
 *   - the privacy pages — accessibility for parents is non-negotiable.
 *
 * NOTE: This test imports `@axe-core/playwright` at top level. That package
 * is added by Sprint 3. If it is not yet installed, run
 * `pnpm add -D @axe-core/playwright` in `apps/web`.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

const SEVERITY_GATE = new Set(['critical', 'serious']);
const TAGS = ['wcag2a', 'wcag2aa'];

async function scan(page: import('@playwright/test').Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter((v) =>
    v.impact ? SEVERITY_GATE.has(v.impact) : false,
  );
  if (blocking.length > 0) {
    // Surface a readable diagnostic so a CI log is actionable.
    const summary = blocking
      .map(
        (v) =>
          `[${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node${
            v.nodes.length === 1 ? '' : 's'
          })`,
      )
      .join('\n');
    throw new Error(`a11y(${label}) found ${blocking.length} violation(s):\n${summary}`);
  }
  expect(blocking, `axe blocking violations on ${label}`).toEqual([]);
}

test.describe('a11y baseline — critical + serious WCAG 2.0 A/AA', () => {
  test('home', async ({ page }) => {
    await page.goto('/');
    await scan(page, '/');
  });

  test('onboarding', async ({ page }) => {
    await page.goto('/onboarding');
    await scan(page, '/onboarding');
  });

  test('play home', async ({ page }) => {
    await seedOnboardingComplete(page);
    await page.goto('/play');
    await scan(page, '/play');
  });

  test('unit screen', async ({ page }) => {
    await seedOnboardingComplete(page);
    await page.goto('/play/01-me-and-my-world');
    await scan(page, '/play/01-me-and-my-world');
  });

  test('lesson player', async ({ page }) => {
    await seedOnboardingComplete(page);
    await page.goto('/play/01-me-and-my-world/lesson/u1.l1');
    await scan(page, '/play/01-me-and-my-world/lesson/u1.l1');
  });

  test('settings', async ({ page }) => {
    await page.goto('/settings');
    await scan(page, '/settings');
  });

  test('parent (post-gate)', async ({ page }) => {
    await seedOnboardingComplete(page);
    // Seed gate-passed flag if the parent route reads one; otherwise this
    // test scans the gate UI itself, which is still meaningful coverage.
    await page.goto('/parent');
    await scan(page, '/parent');
  });

  test('privacy', async ({ page }) => {
    await page.goto('/privacy');
    await scan(page, '/privacy');
  });

  test('privacy parent summary', async ({ page }) => {
    await page.goto('/privacy/parent-summary');
    await scan(page, '/privacy/parent-summary');
  });
});
