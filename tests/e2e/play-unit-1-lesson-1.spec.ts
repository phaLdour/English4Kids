import { expect, test } from '@playwright/test';
import { mockAudioAssets } from './fixtures/audio-mocks';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * Unit 1 · Lesson 1.1 smoke E2E.
 *
 * Pre-seeds onboarding so we drop straight into the lesson, mocks audio assets
 * so missing Piper TTS doesn't stall activity timers, then walks the four
 * activities end-to-end:
 *
 *   a1 Listen & Tap   — six rounds, always tap the correct card.
 *   TPR break         — skip via "Skip" button.
 *   a2 Story Time     — Next×4 through panels, then answer comprehension.
 *   a3 Speak It!      — stubbed in Sprint 2 (mic ships Sprint 3); auto-pass.
 *   a4 Sing Along     — stub, press Done.
 *   StarReveal        — assert ≥2 stars, then Home → /play/01-me-and-my-world.
 */

const UNIT_ID = '01-me-and-my-world';
const LESSON_ID = 'u1.l1';
const LESSON_URL = `/play/${UNIT_ID}/lesson/${LESSON_ID}`;

test.describe('Play · Unit 1 Lesson 1.1', () => {
  test.beforeEach(async ({ page }) => {
    await mockAudioAssets(page);
    await seedOnboardingComplete(page, {
      mascot: 'milo',
      ageBand: '6-8',
      nickname: 'TestKid',
    });
  });

  test('completes Lesson 1.1 happy path and reveals stars', async ({ page }) => {
    await page.goto(LESSON_URL);

    // -- a1 Listen & Tap ----------------------------------------------------
    await expect(
      page.getByRole('heading', { name: /listen.*tap|tap the/i }),
    ).toBeVisible({ timeout: 15_000 });

    for (let round = 0; round < 6; round += 1) {
      // Wait for the audio fadeIn to settle and cards to be tappable.
      const cards = page.getByRole('button', { name: /.+/ }).and(
        page.locator('[data-state="idle"]'),
      );
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });

      // Tap the card flagged as correct via data attribute.
      const correctCard = page.locator('[data-correct="true"][data-state="idle"]').first();
      await correctCard.click();

      // Mascot should transition to a positive reaction.
      await expect(page.locator('[data-mascot]')).toHaveAttribute(
        'data-reaction',
        /encouraging|celebrating|listening/,
        { timeout: 5_000 },
      );
    }

    // -- TPR break (skippable) ---------------------------------------------
    const skipTpr = page.getByRole('button', { name: /skip/i });
    if (await skipTpr.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skipTpr.click();
    }

    // -- a2 Story Time ------------------------------------------------------
    await expect(
      page.getByRole('heading', { name: /story|read along/i }),
    ).toBeVisible({ timeout: 10_000 });

    for (let panel = 0; panel < 4; panel += 1) {
      await page.getByRole('button', { name: /next|turn page/i }).click();
    }

    // Comprehension question: pick the answer flagged correct.
    const correctAnswer = page
      .locator('[data-correct="true"]')
      .filter({ has: page.locator(':scope') })
      .first();
    await correctAnswer.click();

    // -- a3 Speak It! (stub in Sprint 2) -----------------------------------
    const speakStub = page.getByText(/coming in next update|speak it/i);
    if (await speakStub.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const continueBtn = page.getByRole('button', { name: /continue|skip|next/i });
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
      }
    }

    // -- a4 Sing Along (stub) ----------------------------------------------
    const sing = page.getByRole('heading', { name: /sing|song/i });
    if (await sing.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('button', { name: /done|finish|continue/i }).click();
    }

    // -- StarReveal --------------------------------------------------------
    await expect(
      page.getByRole('status', { name: /stars earned|great work|made it shine/i }),
    ).toBeVisible({ timeout: 15_000 });

    const starsLabel = await page
      .getByRole('status', { name: /stars earned/i })
      .getAttribute('aria-label');
    expect(starsLabel).toMatch(/[23] of 3 stars earned/);

    // -- Home → unit page or play hub --------------------------------------
    await page.getByRole('button', { name: /home|done|back to/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/play(/${UNIT_ID})?$`),
      { timeout: 5_000 },
    );
  });
});
