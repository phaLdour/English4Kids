import { expect, test } from '@playwright/test';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * Settings page coverage.
 *   - All sections are present (Audio, Profile, Privacy).
 *   - Master volume change persists across a route change + return.
 */

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboardingComplete(page);
  });

  test('renders all sections', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/audio|sound|volume/i).first()).toBeVisible();
    await expect(page.getByText(/profile|child|nickname/i).first()).toBeVisible();
    await expect(page.getByText(/privacy|safety|grown-up/i).first()).toBeVisible();
  });

  test('Master volume change persists after route change', async ({ page }) => {
    await page.goto('/settings');

    const masterSlider = page
      .getByRole('slider', { name: /master/i })
      .first();
    await expect(masterSlider).toBeVisible();

    // Focus the slider and step the value down a few times so the change is
    // deterministic (Radix Slider responds to ArrowLeft/ArrowRight).
    await masterSlider.focus();
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    const newValue = await masterSlider.getAttribute('aria-valuenow');
    expect(newValue).not.toBeNull();

    // Navigate away and back.
    await page.goto('/play');
    await page.goto('/settings');

    const reread = page.getByRole('slider', { name: /master/i }).first();
    await expect(reread).toHaveAttribute('aria-valuenow', newValue ?? '');
  });
});
