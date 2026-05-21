import { expect, test } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * Sprint 5 S5-6 — privacy policy v1.0 production readiness.
 *
 * Asserts the structural invariants of the policy page so an accidental
 * regression (missing section, wrong effective date, missing footer link
 * on a child route) trips CI before launch.
 */

const REQUIRED_SECTIONS: ReadonlyArray<{ id: string; heading: RegExp }> = [
  { id: 'kid-summary', heading: /a note for kids/i },
  { id: 'controller', heading: /data controller/i },
  { id: 'data', heading: /what we collect/i },
  { id: 'mic', heading: /microphone policy/i },
  { id: 'cloud-sync', heading: /cloud sync/i },
  { id: 'email', heading: /^email/i },
  { id: 'sentry', heading: /error logging/i },
  { id: 'plausible', heading: /parent dashboard analytics/i },
  { id: 'cookies', heading: /cookies/i },
  { id: 'rights', heading: /your rights/i },
  { id: 'retention', heading: /data retention/i },
  { id: 'contact', heading: /^contact/i },
];

const FOOTER_LINK_ROUTES = ['/play', '/parent', '/onboarding'] as const;

test.describe('Privacy policy v1.0', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboardingComplete(page);
  });

  test('renders v1.0 banner and effective date 2026-05-20', async ({ page }) => {
    await page.goto('/privacy');
    const versionLine = page.getByTestId('privacy-version-line');
    await expect(versionLine).toBeVisible();
    await expect(versionLine).toContainText('1.0');
    await expect(versionLine).toContainText('2026-05-20');
  });

  test('renders all 11 numbered sections plus kid summary and change log', async ({ page }) => {
    await page.goto('/privacy');
    for (const { id, heading } of REQUIRED_SECTIONS) {
      const section = page.locator(`section[aria-labelledby="${id}"]`);
      await expect(section, `section ${id} should exist`).toHaveCount(1);
      await expect(
        section.locator(`#${id}`),
        `section ${id} should have a heading matching ${heading}`,
      ).toContainText(heading);
    }
    // Change log lives in its own section.
    await expect(page.getByTestId('privacy-change-log')).toBeVisible();
    await expect(page.getByTestId('privacy-change-log')).toContainText(/v1\.0/);
  });

  test('Privacy footer link is reachable from /play, /parent, /onboarding', async ({ page }) => {
    for (const route of FOOTER_LINK_ROUTES) {
      await page.goto(route).catch(() => undefined);
      const link = page.getByRole('link', { name: /privacy/i }).first();
      await expect(link, `Privacy footer link missing on ${route}`).toBeVisible();
    }
  });

  test('kid summary stays under 50 words and is in plain language', async ({ page }) => {
    await page.goto('/privacy');
    const section = page.locator('section[aria-labelledby="kid-summary"] p');
    const text = (await section.innerText()).trim();
    const wordCount = text.split(/\s+/).length;
    expect(wordCount, `kid summary is ${wordCount} words: ${text}`).toBeLessThanOrEqual(50);
    // Must mention voice / device / grown-up — the three load-bearing
    // promises in the kid summary.
    expect(text).toMatch(/voice/i);
    expect(text).toMatch(/device/i);
    expect(text).toMatch(/grown[- ]?up/i);
  });
});
