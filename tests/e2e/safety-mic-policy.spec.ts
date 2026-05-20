import { expect, test } from '@playwright/test';
import { captureAudioLeaks, type AudioLeakRecord } from './fixtures/audio-mocks';
import { seedOnboardingComplete } from './fixtures/seed-onboarding-complete';

/**
 * SAFETY GUARDRAIL — Microphone policy.
 *
 * Even though the mic isn't wired in Sprint 2, this test enforces the
 * architectural invariants we promised parents:
 *
 *   1. No `MediaRecorder` or `getUserMedia` is ever instantiated by the page
 *      shell or any preloaded route. (Sprint 3 will instantiate ONLY behind
 *      a ParentGate user gesture; the shell stays clean.)
 *   2. No outbound network request carries an audio payload — STT/TTS never
 *      leaves the device. We watch every request body's Content-Type.
 *   3. Toggling "Enable Microphone" in Settings opens a ParentGate dialog
 *      BEFORE the browser permission prompt can possibly fire.
 *
 * If any of these break, fail with a clear message — this is the kind of
 * regression that erodes parent trust and we will not ship it.
 */

interface InstrumentedWindow extends Window {
  __e4kMediaRecorderConstructed?: number;
  __e4kGetUserMediaCalled?: number;
}

test.describe('Safety · microphone policy', () => {
  test.beforeEach(async ({ page }) => {
    // Instrument BEFORE any page script runs.
    await page.addInitScript(() => {
      const w = window as InstrumentedWindow;
      w.__e4kMediaRecorderConstructed = 0;
      w.__e4kGetUserMediaCalled = 0;

      // Wrap MediaRecorder constructor.
      const OriginalRecorder = window.MediaRecorder;
      if (OriginalRecorder) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Wrapped = function (this: unknown, ...args: unknown[]) {
          w.__e4kMediaRecorderConstructed =
            (w.__e4kMediaRecorderConstructed ?? 0) + 1;
          // @ts-expect-error — preserve original constructor behavior
          return new OriginalRecorder(...args);
        } as unknown as typeof MediaRecorder;
        Wrapped.prototype = OriginalRecorder.prototype;
        Wrapped.isTypeSupported = OriginalRecorder.isTypeSupported.bind(OriginalRecorder);
        window.MediaRecorder = Wrapped;
      }

      // Wrap navigator.mediaDevices.getUserMedia.
      const md = navigator.mediaDevices;
      if (md && typeof md.getUserMedia === 'function') {
        const original = md.getUserMedia.bind(md);
        md.getUserMedia = async (constraints: MediaStreamConstraints) => {
          w.__e4kGetUserMediaCalled = (w.__e4kGetUserMediaCalled ?? 0) + 1;
          return original(constraints);
        };
      }
    });
  });

  test('no MediaRecorder / getUserMedia is constructed by the shell', async ({
    page,
  }) => {
    await seedOnboardingComplete(page);

    const routes = ['/play', `/play/01-me-and-my-world`, '/settings', '/onboarding'];
    for (const route of routes) {
      await page.goto(route);
      // Let any post-mount effects run.
      await page.waitForLoadState('networkidle');

      const counts = await page.evaluate(() => {
        const w = window as InstrumentedWindow;
        return {
          recorder: w.__e4kMediaRecorderConstructed ?? 0,
          gum: w.__e4kGetUserMediaCalled ?? 0,
        };
      });

      expect(counts.recorder, `MediaRecorder constructed on ${route}`).toBe(0);
      expect(counts.gum, `getUserMedia called on ${route}`).toBe(0);
    }
  });

  test('no outbound request carries an audio Content-Type', async ({ page }) => {
    const leaks: AudioLeakRecord[] = [];
    await captureAudioLeaks(page, leaks);
    await seedOnboardingComplete(page);

    // Touch every Sprint-2 route.
    for (const route of [
      '/',
      '/play',
      '/play/01-me-and-my-world',
      '/settings',
      '/onboarding',
    ]) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }

    // Filter out inbound asset fetches we *initiated* (audio mocks return
    // audio mime types but those are responses, not request bodies). The
    // captureAudioLeaks recorder only logs requests whose Content-Type
    // header (i.e. the body) is audio — i.e. genuine uploads.
    expect(
      leaks,
      `Outbound audio leak detected:\n${JSON.stringify(leaks, null, 2)}`,
    ).toEqual([]);
  });

  test('Enable Microphone toggle requires ParentGate first', async ({ page }) => {
    await seedOnboardingComplete(page);
    await page.goto('/settings');

    const micToggle = page
      .getByRole('switch', { name: /microphone|enable mic/i })
      .first();
    await expect(micToggle).toBeVisible();
    await expect(micToggle).toHaveAttribute('aria-checked', 'false');

    await micToggle.click();

    // ParentGate dialog must appear synchronously. Browser permission prompt
    // would manifest as a Playwright "missing permission" error or as the
    // toggle flipping to true with no dialog.
    await expect(
      page.getByRole('dialog', { name: /grown-ups only|parent/i }),
    ).toBeVisible({ timeout: 3_000 });

    // Mic stays off until grown-up passes the gate.
    await expect(micToggle).toHaveAttribute('aria-checked', 'false');

    // getUserMedia must NOT have been called.
    const gumCount = await page.evaluate(() => {
      const w = window as InstrumentedWindow;
      return w.__e4kGetUserMediaCalled ?? 0;
    });
    expect(gumCount, 'getUserMedia was called before ParentGate passed').toBe(0);
  });
});
