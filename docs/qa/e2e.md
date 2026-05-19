# End-to-end testing

Playwright drives all E2E tests for the English4Kids web app. Tests live in
`tests/e2e/` and run against a real `next dev` server started by Playwright's
`webServer` config.

## Running

```bash
# From the repo root:
pnpm test:e2e

# Or directly in the web app:
pnpm --filter @e4k/web test:e2e
```

The first run requires Playwright browsers:

```bash
pnpm --filter @e4k/web exec playwright install --with-deps chromium
```

CI mode (`CI=1`) enables retries, forbids `.only`, and disables the
`reuseExistingServer` shortcut so each run is hermetic.

## Test files

| File | Purpose |
| --- | --- |
| `onboarding.spec.ts` | Walks the entire onboarding flow from a fresh page; asserts URL + Dexie state. |
| `play-unit-1-lesson-1.spec.ts` | Happy-path smoke through Unit 1 Lesson 1.1. Uses seed fixtures to skip onboarding. |
| `settings.spec.ts` | Renders settings sections and asserts master-volume persistence across routes. |
| `safety-mic-policy.spec.ts` | **Critical guardrail.** No mic recorder is constructed by the shell; no audio leaves the device; the mic toggle gates on ParentGate. |

## Fixtures

### `fixtures/seed-onboarding-complete.ts`

`seedOnboardingComplete(page, opts?)` writes the canonical post-onboarding
state to localStorage **and** to the Dexie `e4k.settings` store. Lesson and
settings tests call it in `beforeEach` to skip the onboarding walk.

Options default to `{ mascot: 'milo', ageBand: '6-8', nickname: 'Friend' }`.

### `fixtures/audio-mocks.ts`

- `mockAudioAssets(page)` — intercepts every audio-shaped URL (`.opus`,
  `.ogg`, `.mp3`, `.wav`, `/audio/**`) and returns a 1-second silent WAV.
  Use this in any test that walks a lesson; Piper-generated assets are not
  present in Sprint 2 dev environments.
- `captureAudioLeaks(page, sink)` — records any **outbound** request whose
  body Content-Type matches `audio/*`. Used by the safety test to assert
  that audio never leaves the device.

## The safety mic-policy test is a hard gate

If `safety-mic-policy.spec.ts` fails on a PR, do not merge until the
underlying invariant is restored. The test enforces:

1. The page shell does not construct `MediaRecorder` or call
   `navigator.mediaDevices.getUserMedia` on any preloaded route.
2. No outbound request carries an audio body.
3. The "Enable Microphone" toggle opens a ParentGate dialog **before** the
   browser permission prompt can possibly fire — and `getUserMedia` stays
   uncalled until the gate passes.

These invariants are non-negotiable because they back the privacy promise
we make to parents. Fix the regression, do not weaken the test.

## Authoring guidance

- Group related tests with `test.describe`.
- Clear cookies + localStorage + IndexedDB in `beforeEach`. The onboarding
  test does this directly; the lesson/settings tests rely on
  `seedOnboardingComplete` instead.
- Assert visible text + role/name **before** clicking the button that
  advances. This makes flow re-orderings fail loud rather than time out.
- Prefer `getByRole` over CSS selectors. The few `data-state` / `data-correct`
  selectors in the lesson test are explicit contracts with the play routes —
  they are documented as part of the route's public surface.
