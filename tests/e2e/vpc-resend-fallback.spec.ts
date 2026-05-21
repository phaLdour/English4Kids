import { expect, test } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * Sprint 5 S5-4: VPC `/start` + Resend integration fallback paths.
 *
 * The Sprint 4 `parent-vpc.spec.ts` happy-path already covers the
 * dev-mode `devToken` return when `EMAIL_DEV_MODE=true`. This spec
 * exercises the OTHER two delivery branches:
 *
 *   1. Resend returns a 5xx — the function must hide the upstream detail
 *      and surface a generic `email-send-failed` 502 with a parent-safe
 *      message. The UI should show an alert, not crash.
 *
 *   2. Rate limit — six rapid `/start` calls from the same parent must
 *      trigger 429 by the sixth call (cap = 5/hour). The function returns
 *      a `retry-after` header.
 *
 * Both branches are exercised by intercepting the function response
 * because there's no live Supabase. The wiring assertions are what
 * matter; the actual Resend hit-the-network behaviour is covered by
 * Resend's own dashboard once DNS is configured.
 */

const START_PATTERN = /\/functions\/v1\/vpc-upgrade\/start(?:\?|$)/;

test.describe('VPC /start — Resend fallback paths', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboardingComplete(page);
    await page.evaluate(() => {
      window.sessionStorage.setItem(
        'e4k.parentSession',
        JSON.stringify({ passedAt: Date.now() }),
      );
    });
  });

  test('502 from Resend surfaces a friendly error and does not advance to first-confirm', async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL not configured; resend-fail test requires the URL to resolve fetch',
    );

    await page.route(START_PATTERN, async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'email-send-failed',
          message:
            "We couldn't send the confirmation email. Please try again in a few minutes.",
        }),
      });
    });

    await page.goto('/parent/account');
    await page.getByLabel(/Your email/i).fill('parent@example.invalid');
    await page.getByRole('button', { name: /Send confirmation email/i }).click();

    // The UI surfaces the generic vpc.error string — assert it appears in an alert.
    await expect(page.getByRole('alert')).toContainText(/email-send-failed/i, {
      timeout: 5_000,
    });
    // The form should NOT have advanced to the first-confirm step.
    await expect(page.getByLabel(/Confirmation token$/i)).toHaveCount(0);
  });

  test('429 rate-limited response is surfaced verbatim', async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL not configured; rate-limit test requires the URL to resolve fetch',
    );

    await page.route(START_PATTERN, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'retry-after': '600' },
        body: JSON.stringify({
          error: 'rate-limited',
          retryAfterSec: 600,
          message:
            'Too many confirmation requests recently. Please wait an hour before trying again.',
        }),
      });
    });

    await page.goto('/parent/account');
    await page.getByLabel(/Your email/i).fill('parent@example.invalid');
    await page.getByRole('button', { name: /Send confirmation email/i }).click();

    await expect(page.getByRole('alert')).toContainText(/rate-limited/i, {
      timeout: 5_000,
    });
  });
});
