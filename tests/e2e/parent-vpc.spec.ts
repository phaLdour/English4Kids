import { expect, test } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * Full happy-path E2E for the email-plus VPC upgrade flow.
 *
 * Steps walked:
 *   1. Anonymous user opens `/parent/account` (math gate passed via test helper).
 *   2. Enters a test email.
 *   3. Reads the devToken from the network response (SMTP isn't wired
 *      in dev — see ADR-0007 and `docs/devops/email-setup.md`).
 *   4. Submits the first confirmation token via the UI.
 *   5. Submits the second confirmation token via the UI with the
 *      `?devSkipDelay=1` query parameter so the 24h gate is bypassed for
 *      the test only. This is the dev-mode escape hatch added in Critic
 *      Wave-2 S0-2 — gated by `EMAIL_DEV_MODE === 'true'` AND the explicit
 *      query param.
 *   6. Asserts that a PATCH request hit Supabase's `/auth/v1/user`
 *      endpoint, proving `supabase.auth.updateUser({ email })` ran.
 *
 * Limitation: this spec requires a real Supabase backend at
 * `NEXT_PUBLIC_SUPABASE_URL`. In CI without one, the test will be
 * skipped at runtime — the unit test in `apps/web/src/app/parent/account/page.test.tsx`
 * still asserts the `auth.updateUser` contract.
 */

const TEST_EMAIL = `e2e-parent-${Date.now()}@example.invalid`;

test.describe('Parent VPC upgrade — email-plus happy path', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboardingComplete(page);
    // Pre-pass the math gate by setting the session flag directly. The
    // ParentGate is a UI concern; we trust its unit tests for math-gate
    // coverage.
    await page.evaluate(() => {
      window.sessionStorage.setItem(
        'e4k.parentSession',
        JSON.stringify({ passedAt: Date.now() }),
      );
    });
  });

  test('walks all 4 steps and triggers supabase.auth.updateUser', async ({ page }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(!supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL not configured; skipping live VPC E2E');

    // Intercept the vpc-upgrade Edge Function calls so we can:
    //   - capture the devToken from /start
    //   - rewrite the /confirm-second URL to add ?devSkipDelay=1
    let capturedDevToken: string | null = null;

    await page.route('**/functions/v1/vpc-upgrade/start', async (route) => {
      const response = await route.fetch();
      const text = await response.text();
      try {
        const parsed = JSON.parse(text) as { devToken?: string };
        capturedDevToken = parsed.devToken ?? null;
      } catch {
        // Non-JSON response — leave capturedDevToken null; the page-level
        // <code> read is the primary source of truth.
      }
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: text,
      });
    });

    await page.route('**/functions/v1/vpc-upgrade/confirm-second*', async (route) => {
      // Rewrite to include the dev-skip-delay query param. The Edge Function
      // gates this on EMAIL_DEV_MODE === 'true' so it cannot bypass in prod.
      const req = route.request();
      const original = req.url();
      const rewritten = original.includes('?')
        ? `${original}&devSkipDelay=1`
        : `${original}?devSkipDelay=1`;
      const response = await route.fetch({ url: rewritten });
      const body = await response.body();
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body,
      });
    });

    // Set up the auth.updateUser assertion BEFORE submitting the second
    // confirmation form so the listener is armed when the request fires.
    const updateUserPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/auth/v1/user') && req.method() === 'PUT',
      { timeout: 15_000 },
    );

    await page.goto('/parent/account');

    // Step 1: enter email + submit.
    await expect(
      page.getByRole('heading', { name: /Account upgrade/i }),
    ).toBeVisible();
    await page.getByLabel(/Your email/i).fill(TEST_EMAIL);
    await page.getByRole('button', { name: /Send confirmation email/i }).click();

    // Step 2: first-confirm form. The devToken is rendered inline by the
    // page (in NEXT_PUBLIC_E4K_ENV=dev). Read it from the page instead of
    // the network capture so we don't race the route handler.
    await expect(page.getByText(/Check your inbox/i)).toBeVisible();
    const tokenCode = page.locator('code').first();
    await expect(tokenCode).toBeVisible({ timeout: 10_000 });
    const devToken = (await tokenCode.textContent())?.trim() ?? capturedDevToken;
    expect(devToken, 'devToken should be present in dev mode').toBeTruthy();

    await page.getByLabel(/Confirmation token$/i).fill(devToken ?? '');
    await page.getByRole('button', { name: /Confirm first step/i }).click();

    // Step 3: wait screen -> click through.
    await expect(page.getByText(/come back in 24 hours/i)).toBeVisible();
    await page.getByRole('button', { name: /try second confirmation/i }).click();

    // Step 4: second confirm.
    await page.getByLabel(/Confirmation token \(same as before\)/i).fill(devToken ?? '');
    await page.getByRole('button', { name: /Finish upgrade/i }).click();

    // ASSERT: Supabase auth.updateUser was called.
    const req = await updateUserPromise;
    expect(req.url()).toMatch(/\/auth\/v1\/user/);

    // ASSERT: UI transitioned to the awaiting-supabase-verify step.
    await expect(page.getByTestId('awaiting-supabase-verify')).toBeVisible({
      timeout: 10_000,
    });
  });
});
