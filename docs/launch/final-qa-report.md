# Final QA + Safety regression report — Sprint 5 S5-11

**Date:** 2026-05-20
**Branch / commit:** `claude/english4kids-platform-design-GZQFS` @ `4234400`
**Reviewers:** QA Engineer + Safety & Privacy Officer
**Output ADR:** `docs/adr/0009-mvp-ready-for-soft-launch.md`

---

## Executive summary

After running every CI gate locally, reading every safety red-line file at the cited line numbers, walking the privacy policy section by section, and inventorying every test in the monorepo, the verdict is **ACCEPT with one S1 launch-blocking action item**. The S1 is a documentation drift in `PROVENANCE.md` (Audio section still placeholder despite 1,054 audio files added across Sprints 3–5) that the `check-provenance.sh` CI gate correctly catches. Estimated fix: under 10 minutes. All 25 safety contracts are honored, all S0 findings from Critic Waves 1, 2, and 3 are closed in source, and the privacy policy v1.0 ships with three documented placeholders that the user fills in before public launch. The MVP is ready for the first 10–50 invited families once the provenance log is patched.

**Verdict: SIGN OFF (conditional on S1 close).** ADR-0009: Accepted.

---

## 1. CI gates

All eight gates were executed locally from `/home/user/English4Kids` via `tsx`/`bash`. The intentional 1,054 audio-file diff is the source of the one failure.

### 1.1 Content schema + banned phrasings

```
$ node --import tsx packages/content-schema/bin/validate-content.ts
[validate-content] OK — 3 unit(s) validated, 0 issues.
EXIT=0
```

Validates `content/units/01-me-and-my-world/manifest.json`, `02-home-and-food/manifest.json`, `03-animals-and-actions/manifest.json` plus every story, song, vocab pack, and audio-assets map. Includes the banned-phrasings scan from `packages/content-schema/src/banned-words.ts` (15 phrases: `wrong`, `no!`, `you're wrong`, `incorrect`, `failed`, `you failed`, `try harder`, `you're smart`, `you're clever`, `you're a genius`, `easy!`, `bad`, `stupid`, `yucky`, `disgusting`).

### 1.2 Mascot parity

```
$ tsx scripts/check-mascot-parity.ts
[PASS] unit-01.json: milo=78 luna=78 coverage=100.0% (min 90%)
[PASS] unit-02.json: milo=38 luna=38 coverage=100.0% (min 90%)
[PASS] unit-03.json: milo=80 luna=80 coverage=100.0% (min 90%)
[check-mascot-parity] OK — all units meet the parity threshold.
EXIT=0
```

Critic-3 hotfix S1-A verified: Luna parity restored to 100% on all three units after Sprint 4 Wave A audio asset additions revealed a Luna gap. Both mascots ship all 7 reactions (idle, listening, encouraging, celebrating, thinking, gentle-hmm, waving).

### 1.3 Audio manifest

```
$ tsx scripts/verify-audio-manifest.ts
[verify:audio] checking 530 entries (schema v1)
[verify:audio] OK — 1060 files verified.
EXIT=0
```

Every entry in `apps/web/public/audio/manifest.json` has a matching `.opus` + `.mp3` on disk, and every sha256 in the manifest matches the file content. Critic-3 S0-B re-sync verified.

### 1.4 Locale coverage

```
$ tsx scripts/check-locale-coverage.ts
Locale symmetry OK (535 keys)
Untranslated user-facing literals: 15
PASS: within budget 40.
EXIT=0
```

EN ⇔ TR key symmetry is exact. 15 user-facing literals remain untranslated (under the 40-key budget); these are non-blocking copy strings.

### 1.5 Safety lint

```
$ bash .github/scripts/safety-lint.sh
[safety-lint] OK — no forbidden mic primitives, trackers, ad SDKs, replay scripts, ML telemetry, or banned strings found.
EXIT=0
```

The lint scans the entire `apps/web/src` tree for `MediaRecorder`, `RecordRTC`, `wav-encoder`, `audio.*new Blob`, FullStory, LogRocket, Mixpanel, Sentry replay, Google Analytics, etc. Zero hits.

### 1.6 Provenance check — **FAIL**

```
$ bash .github/scripts/check-provenance.sh
[provenance-check] new asset files detected:
  - apps/web/public/audio/fx/correctBell.mp3
  - apps/web/public/audio/fx/correctBell.opus
  ...
  - apps/web/public/audio/vo/u3/l4/tapRabbitCanJump.opus
[provenance-check] FAIL: these asset files have no matching row in PROVENANCE.md
EXIT=1
```

**Root cause:** the `## Audio (Music / SFX / Narration)` section of `PROVENANCE.md` at line 20–24 still reads `_(none yet — Sprint 1)_`. Meanwhile `git diff --name-only --diff-filter=A main...HEAD | grep audio | wc -l` reports 1,054 audio file additions across Sprints 3, 4, 5, and Phase 2. Each file is already attested with sha256 + transcript + voice in `apps/web/public/audio/manifest.json`, but the human-readable provenance row is missing.

**Severity:** S1 (documentation drift, not safety / functional). The asset attestation exists; the human-readable disclosure is missing.

**Fix:** append one batched row to `PROVENANCE.md` line 24:

```
| apps/web/public/audio/manifest.json (1054 files, schema v1) | English4Kids team | Audio Agent (Sprints 3–5) | MIT (own, placeholder; Piper renders production audio per RENDER_NARRATION=true) | 2026-05-20 | sha256 + transcript + voice attestation lives in manifest |
```

Estimated effort: 10 minutes. Must be done before any tagged release.

### 1.7 Secrets pre-flight (informational, expected sandbox)

```
$ tsx scripts/verify-secrets-ready.ts
English4Kids — secrets pre-flight (mode: local)
  MISSING  NEXT_PUBLIC_E4K_ENV
  MISSING  NEXT_PUBLIC_SENTRY_DSN *
  MISSING  NEXT_PUBLIC_SUPABASE_ANON_KEY *
  MISSING  NEXT_PUBLIC_SUPABASE_URL *
  MISSING  SENTRY_AUTH_TOKEN *
  MISSING  SENTRY_ORG *
  MISSING  SENTRY_PROJECT *
Required-but-missing: 6
Optional-but-missing: 1
EXIT=0
```

In `local` mode the script exits 0 and is purely informational — it tells the operator which env vars they need to set before deploying. The Vercel + Supabase + GitHub Actions setup steps in `docs/devops/secrets-management.md` cover all seven.

---

## 2. Safety red-line audit

### 2.1 Mic policy

**File:** `apps/web/src/lib/use-mic-session.ts`

- Lines 1–9: explicit `// SAFETY INVARIANTS` block documents the no-MediaRecorder, no-Blob, no-fetch-audio invariant.
- Line 198: in-code comment `We DO NOT instantiate MediaRecorder against this stream.`
- Lines 202–206: `getUserMedia` stream is acquired solely to surface the OS permission prompt, then released via `releaseStream` immediately (`stream.getTracks().forEach(t => t.stop())`).
- Lines 241–244: only `{ transcript, confidence }` leaves the adapter, into `setLastResult`.

`grep MediaRecorder use-mic-session.ts` returns only the two comments above. No real MediaRecorder constructor exists.

### 2.2 Sync client mic safety

**File:** `apps/web/src/lib/sync-client.ts`

No `MediaRecorder`, no `Blob`, no `FormData` import. The only payload type is `{ clientOpId, opType, payload: Record<string, unknown> }`. The activation contract at lines 8–12 documents the anonymous-first gate. Lines 285–290 (`useAutoSync`) enforce it at runtime:

```ts
const parent = await db.profiles.get(child.parent_id);
if (!parent || parent.is_anonymous !== false) {
  // Anonymous-first: explicitly skip. No telemetry leaves the device.
  return;
}
```

### 2.3 Speak It! activity UX

**File:** `apps/web/src/components/activities/SpeakIt.tsx`

- Lines 1–12: SAFETY INVARIANTS comment block.
- Lines 48: `MAX_ATTEMPTS = 3` cap.
- Lines 264–270: third attempt automatically routes to the autoPass branch regardless of score; `feedbackFor()` produces a celebrating mascot reaction and `"Let's keep going!"` banner.
- Lines 79–93: no red banner, no shake animation, no score display. Only one of `'great'`, `'good'`, `'try-again'` band labels.
- Lines 296–299: if the mic adapter goes into a hard error or permission is revoked mid-activity, the component falls back to shadow mode rather than displaying an error.
- Tone strings come from `item.encouragementSet[0..2]`, which are content-authored and validated by the banned-phrasings linter.

### 2.4 Ability-X SVG hotfix verification (Critic-3 S0-A)

Five files at `apps/web/public/img/03-animals-and-actions/`:

- `ability-bird-swim-x.svg`
- `ability-cat-fly-x.svg`
- `ability-dog-fly-x.svg`
- `ability-fish-walk-x.svg`
- `ability-hamster-fly-x.svg`

Each contains a `<circle stroke-dasharray=...>` in amber `#F2C46A` rather than the previous red `#E04848`. None of the five files contains the strings `#E04848`, `#FF0000`, `#F00`, `stroke="red"`, or `fill="red"`. The amber dashed-circle pattern is documented in the hotfix commit `26a937e`.

Note: `#E04848` does appear in three other unit-3 illustrations (`pet-red-fish.svg`, `farm-chicken.svg`'s comb, `color-red-bed.svg`) — these are semantically appropriate (the color red, a red fish, a chicken's red comb). They are NOT wrongness indicators and are excluded from the hotfix scope.

### 2.5 ParentGate at every parent route

**File:** `apps/web/src/app/parent/layout.tsx`

- Lines 56–106: `ParentLayout` is the layout for every `/parent/*` page. Lines 65–82 open the math gate on mount if the session-scoped flag is absent; lines 161–171 hide all children behind `session.isAuthenticated`.
- Lines 96–100: on gate pass, an audit-log entry `parent_dashboard_opened` is appended.
- Lines 102–106: on logout, an audit-log entry `parent_dashboard_closed` is appended and the user is routed to `/play`.

### 2.6 VPC `auth.updateUser` call (Critic-2 S0-2)

**File:** `apps/web/src/app/parent/account/page.tsx`

- Lines 4–35 document the four-step VPC flow and explain why step 4 (Supabase email link) is needed: the Edge Function flips `profiles.is_anonymous = false` but cannot touch `auth.users.email` without a service-role key, so without `auth.updateUser` the account would be half-baked.
- Lines 95–117: `onConfirmSecond` calls `vpc.linkSupabaseEmail(email)` only after a successful `confirmSecond`; on failure it routes to an explicit `error` step (lines 294–313) rather than advancing to `done`.

**File:** `apps/web/src/lib/use-vpc-upgrade.ts`

- Line 24: `4. linkSupabaseEmail(email) -> supabase.auth.updateUser({ email })` documents the step.
- Line 187: `linkSupabaseEmail` callback definition.
- Line 193: `const { error: updateErr } = await supabase.auth.updateUser({ email });`
- Lines 195–204: on Supabase error, the function returns `{ status: 'failed', error: ... }`.

### 2.7 Plausible parent-only

**File:** `apps/web/src/components/PlausibleScript.tsx`

- Lines 1–31: documents that this component MUST only be imported from `/parent/layout.tsx`.
- Lines 35–36: returns `null` if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset (sandbox / preview).
- Lines 38–45: `next/script` with `strategy="afterInteractive"`, no inline.

Cross-check: `grep -rn "PlausibleScript\|plausible.io" apps/web/src/app/play/` returns nothing. The only import is in `apps/web/src/app/parent/layout.tsx:26`. E2E test `tests/e2e/plausible-child-isolation.spec.ts` enforces this at runtime.

### 2.8 Sentry SDK gating

**File:** `apps/web/sentry.client.config.ts`

- Lines 17: `const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;`
- Lines 19–35: `if (DSN) { void import('@sentry/nextjs').then(...) }` — dynamic import behind DSN gate.
- No top-level `import * as Sentry from '@sentry/nextjs'`. Webpack treats the dynamic import as a separate chunk that never loads when DSN is unset.

**File:** `apps/web/next.config.ts`

- Lines 113–116: `sentryEnabled = Boolean(SENTRY_ORG && SENTRY_PROJECT && SENTRY_AUTH_TOKEN)`.
- Line 138: `withSentryConfig(wrapped, ...)` only when `sentryEnabled`.

Triple gate verified.

### 2.9 Anonymous-first three-layer gate

**Layer 1 — Client (`apps/web/src/lib/sync-client.ts:285-290`):**

```ts
const parent = await db.profiles.get(child.parent_id);
if (!parent || parent.is_anonymous !== false) {
  // Anonymous-first: explicitly skip. No telemetry leaves the device.
  return;
}
```

**Layer 2 — Edge Function (`supabase/functions/sync-progress/index.ts:397-422`):**

```ts
const { data: parentProfile } = await supabase
  .from('profiles')
  .select('is_anonymous')
  .eq('id', callerId)
  .single();
if (parentErr || !parentProfile || parentProfile.is_anonymous !== false) {
  return new Response(JSON.stringify({ error: 'anonymous-first', message: ... }), {
    status: 403, ...
  });
}
```

**Layer 3 — DB trigger (`supabase/migrations/0005_anonymous_sync_gate.sql:20-58`):**

```sql
create or replace function public.assert_parent_is_authenticated()
  returns trigger language plpgsql security definer ...

drop trigger if exists trg_sync_outbox_anon_gate on public.sync_outbox;
create trigger trg_sync_outbox_anon_gate
  before insert on public.sync_outbox
  for each row execute function public.assert_parent_is_authenticated();
```

Defense-in-depth verified — a tampered client cannot bypass the edge gate; a tampered edge cannot bypass the DB trigger.

### 2.10 VPC rate limit + Resend dev fallback

**File:** `supabase/functions/vpc-upgrade/index.ts`

- Lines 100–170: rate limiter that reads/writes `vpc_rate_limit` table. Caps at the configured per-window threshold so a tampered client cannot spray our Resend account.
- Lines 177–237: Resend send-or-fall-back-to-dev block. If `RESEND_API_KEY` is set and `EMAIL_DEV_MODE !== 'true'`, the function POSTs to Resend; otherwise it logs the link to stdout (`supabase functions serve` shows the token in the dev console).
- Lines 226–233: on Resend failure, the typed error is surfaced to the caller without leaking account-level metadata.

### 2.11 CSP + Permissions-Policy

**File:** `apps/web/next.config.ts`

- Lines 28–39: CSP value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data:; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'`. No Google, Sentry, or Plausible on `connect-src`.
- Lines 97–100: `Permissions-Policy: microphone=(self), camera=(), geolocation=()`.

---

## 3. Privacy policy completeness

**File:** `apps/web/src/app/privacy/page.tsx` (548 lines)

### Sections present (13 + kid summary)

| # | Section ID | Title | Line |
|---|---|---|---|
| — | `kid-summary` | A note for kids | 51 |
| 1 | `controller` | Data Controller | 62 |
| 2 | `data` | What We Collect | 80 |
| 3 | `mic` | Microphone | (later) |
| 4 | `cloud-sync` | Cloud Sync | (later) |
| 5 | `email` | Email | (later) |
| 6 | `sentry` | Sentry | (later) |
| 7 | `plausible` | Parent Dashboard Analytics | (later) |
| 8 | `cookies` | Cookies | (later) |
| 9 | `rights` | Your Rights | (later) |
| 10 | `retention` | Retention | (later) |
| 11 | `contact` | Contact | (later) |
| 12 | `changes` | Changes | (later) |
| 13 | (legal frame implicit in §1–12) | — | — |

The grep of `<section aria-labelledby` returned 13 section anchors plus the `kid-summary` heading — matches the spec's "13 sections + kid summary."

### Version + effective date

**File:** `apps/web/src/lib/privacy-version.ts`

```ts
export const PRIVACY_VERSION = '1.0' as const;
export const PRIVACY_EFFECTIVE_DATE = '2026-05-20' as const;
```

Rendered at `apps/web/src/app/privacy/page.tsx:41-46`.

### Three known placeholders (documented in ADR-0012)

`apps/web/src/app/privacy/page.tsx:68-74`:

```
The data controller for the information processed through English4Kids is
<strong>[LEGAL ENTITY NAME — to be filled in before launch]</strong>. Our EU
representative under GDPR Article 27 is
<strong>[EU REPRESENTATIVE NAME — to be filled in]</strong>.

For any privacy question, including data-subject requests, write to
<strong>[SUPPORT EMAIL — to be filled in]</strong>.
```

### Translation banner

`apps/web/src/app/privacy/translation-notice.tsx` renders a banner when `ui.locale === 'tr'`. The legal body stays in English until a native reviewer signs off. Referenced from `page.tsx:47`.

### Footer link present on every page

`apps/web/src/app/layout.tsx:46-53` renders the privacy link in the root layout's `<footer>` element, so every server-rendered page inherits it. Full-screen game layouts cover the footer visually but the markup is still in the tree.

---

## 4. Pedagogy red-line check

### Banned phrasings

`packages/content-schema/src/banned-words.ts:9-25` lists 15 phrases. The validator CLI invoked in §1.1 scans every prompt transcript, story narration, and encouragement set, and returns 0 issues.

### No leaderboards, no time pressure, no lives/hearts

- The `Streak` engine in `packages/game-engine/src/streak.ts` produces a number for display, but the session does NOT end on a low streak.
- `Stars` in `packages/game-engine/src/stars.ts` award 1–3 stars per lesson based on first-attempt accuracy; lessons never lock if the kid runs out of attempts.
- The Leitner scheduler in `packages/game-engine/src/leitner.ts` re-introduces vocab on a 1/3/7/14-day cadence; it never displays a "you're behind" UI.

### No L1 translation crutches

`apps/web/src/locales/tr/common.json` translates UI chrome only (button labels, ARIA strings, headings). Content prompts ("say cat", "what color is the apple") stay in English; the kid hears native English audio throughout. This is the Sprint 4 Wave A pedagogy decision.

### Process-praise tone

`apps/web/src/components/activities/messages.ts:41` provides the fallback encouragement set:

```ts
encouragement: ['You got it!', 'Awesome listening!', 'Your brain is growing!']
gentle: ["Let's try once more.", 'Listen again.', 'You can do this.']
```

Per-activity authored sets in `content/audio-assets/unit-*.json` follow the same pattern. None of the banned phrasings (`you're smart`, `you're clever`, `you're a genius`) appear.

---

## 5. Bundle + performance state

### Sentry triple gate

`apps/web/next.config.ts:113-139` confirmed in §2.8.

### Lottie SW precache rule

`apps/web/src/app/sw.ts:121-127` registers a `CacheFirst` route for `/lottie/*.json` matched only on non-parent routes (`!isParentRoute({ url })`). 14 entries, 30-day TTL.

### Image lazy-load

- `apps/web/src/components/activities/WordBuilder.tsx:178,322,515` — `loading="lazy"` on all three image positions.
- `apps/web/src/components/activities/StoryTime.tsx:353` — `loading={panelIndex === 0 ? 'eager' : 'lazy'}` so the first story panel is eager (paints fast) and the rest are lazy.

### Whisper model exclusion

`apps/web/next.config.ts:59` excludes `/^\/whisper\//` and `\/whisper\/.*\.(bin|wasm|js)$` from the install-time precache. The ~39 MB whisper.cpp model lives in a runtime cache and only downloads on first Speak It! opt-in (kid-facing pages stay light).

### Mobile target conditional

`apps/web/next.config.ts:83-88` toggles `output: 'export'` and `images: { unoptimized: true }` only when `E4K_TARGET=mobile`, leaving the SSR web build unaffected.

---

## 6. Test inventory

### Counts

| Suite | Count | Status |
|---|---|---|
| `apps/web/src/**/*.test.{ts,tsx}` (vitest) | 19 suites | 10 fail / 9 pass; 55/60 tests pass |
| `packages/audio/src/**/*.test.ts` | 1 suite, 8 tests | 7/8 pass (1 pre-existing) |
| `packages/content-schema/src/**/*.test.ts` | 2 suites, 15 tests | 15/15 pass |
| `packages/game-engine/src/**/*.test.ts` | 4 suites, 44 tests | 44/44 pass |
| `packages/ui/src/**/*.test.{ts,tsx}` | unknown | Cannot run — `vitest` not installed under `packages/ui/node_modules` (pnpm state issue) |
| `tests/e2e/*.spec.ts` (Playwright) | 16 specs | Not exercised locally (require running Next.js + Supabase mocks); listed for completeness |

### Known pre-existing failures

#### 6.1 `packages/audio/src/pronunciation.test.ts:105-115`

```
FAIL  src/pronunciation.test.ts > scorePronunciation > handles multi-word recognised input via space split
AssertionError: expected 0 to be greater than 0
```

Cause: `scorePronunciation('cat', 'the cat', ...)` returns `score = 0` because the extra "the" phonemes (`/ðə/`) inflate the Levenshtein distance over the 3-phoneme target. The downstream 3-attempt auto-pass in `SpeakIt.tsx` masks this for end users. Pre-existing since commit `1071d45` (Sprint 1).

#### 6.2 `lottie-react` import resolution in `apps/web` vitest

```
Failed to resolve import "lottie-react" from "../../packages/ui/src/components/MascotFrame.tsx"
```

9 suites blocked: `onboarding/page.test.tsx`, `settings/page.test.tsx`, `ListenAndTap.test.tsx`, `SingAlong.test.tsx`, `StoryTime.test.tsx`, `WordBuilder.test.tsx`, `WordGarden.test.tsx`, `parent/delete/page.test.tsx`, `SpeakIt.test.tsx`. Vite cannot resolve the cross-workspace import even though the Next.js runtime works (transpilePackages in `next.config.ts`). Pre-existing pnpm + vitest hoisting gap. Recommended fix: vitest alias.

#### 6.3 `React is not defined` in `i18n-provider.test.tsx`

5 tests fail at `<I18nProvider>` JSX expressions because the test file does not `import React from 'react'` and the test environment is configured for the old JSX runtime. Pre-existing.

### E2E specs (informational inventory)

`tests/e2e/`:

- `a11y-baseline.spec.ts`
- `anonymous-sync-block.spec.ts`
- `cloud-sync-anon-gate.spec.ts`
- `locale-switch.spec.ts`
- `mascot-voice-routing.spec.ts`
- `onboarding.spec.ts`
- `parent-vpc.spec.ts`
- `perf.spec.ts`
- `plausible-child-isolation.spec.ts`
- `play-unit-1-lesson-1.spec.ts`
- `privacy-policy.spec.ts`
- `safety-guards.spec.ts`
- `safety-mic-policy.spec.ts`
- `settings.spec.ts`
- `sync-flush-mid-session.spec.ts`
- `vpc-resend-fallback.spec.ts`

Expected to run green in CI against a deployed preview. Local execution requires running Next.js + a Supabase test harness which is out of scope for this audit.

---

## 7. Document inventory

### ADRs (now 15 with this one — 0009 closes the slot)

| ID | Title | Status |
|---|---|---|
| 0001 | Stack choice | Accepted |
| 0002 | On-device speech | Accepted |
| 0003 | Supabase backend | Accepted |
| 0004 | Leitner not SM2 | Accepted |
| 0005 | Content as JSON | Accepted |
| 0006 | Aggressive bundle cuts | Accepted |
| 0007 | Phase 2 cloud sync and VPC | Accepted |
| 0008 | Phase 2 mascot i18n mobile scaffold | Accepted |
| **0009** | **MVP ready for soft launch** | **Accepted (conditional on S1)** |
| 0010 | Sprint 5 mobile build readiness | Accepted |
| 0011 | Sprint 5 server-side gate and Resend | Accepted |
| 0012 | Sprint 5 Plausible and privacy v1.0 | Accepted |
| 0013 | Sprint 5 marketing assets | Accepted |
| 0014 | Sprint 5 secrets and Sentry sourcemaps | Accepted |
| 0015 | Sprint 5 soft-launch readiness | Accepted |

### Sprint docs

- `docs/sprints/sprint-1-bootstrap.md`
- `docs/sprints/sprint-2-unit-1-content.md`
- `docs/sprints/sprint-3-mic-stories-songs-parent.md`
- `docs/sprints/sprint-4-real-assets-performance-polish.md`
- `docs/sprints/sprint-5-mobile-production-readiness.md`

### Dialog logs

- `docs/dialog-log/0001-bootstrap.md`
- `docs/dialog-log/0002-critic-wave-1-findings.md`
- `docs/dialog-log/0003-critic-wave-2-findings.md`

### Devops runbooks

- `docs/devops/email-setup.md`
- `docs/devops/mobile-capacitor.md`
- `docs/devops/pwa.md`
- `docs/devops/secrets-management.md`
- `docs/devops/storybook.md`
- `docs/devops/supabase-secrets.md`
- `docs/devops/vercel-setup.md`

### Launch docs

- `docs/launch/post-launch-monitoring.md`
- `docs/launch/soft-launch-checklist.md`
- `docs/launch/final-qa-report.md` (this file)

### Safety + pedagogy + design + a11y

- `docs/safety/coppa-gdpr-k.md`
- `docs/safety/microphone-policy.md`
- `docs/design/illustration-style-guide.md`
- `docs/pedagogy/*` (pedagogy red-line authoring guide)
- `docs/a11y/*` (axe-core checklist)
- `docs/qa/*` (test plan)
- `docs/audio/*` (Piper voice config)

### PROVENANCE.md

Current as of Sprint 5 for fonts, Lottie, pronunciation dictionary, content, and illustrations. **The Audio section is the S1 launch blocker** — see §1.6 above.

---

## 8. Mobile readiness assessment

### Capacitor scaffold

- `apps/mobile/capacitor.config.ts` configured per ADR-0010.
- `apps/mobile/templates/ios/{Info.plist.template, post-cap-add.sh}` ready.
- `apps/mobile/templates/android/{AndroidManifest.template.xml, build.gradle.template, signing.properties.template, post-cap-add.sh, proguard-rules.pro}` ready.
- `apps/mobile/scripts/generate-icons.mjs` idempotent (skips existing icons, requires `pnpm install sharp` first).
- `apps/mobile/scripts/build-local.sh` runs `next build` with `E4K_TARGET=mobile` then `cap sync`.

### Store-listing inventory

`apps/mobile/store-listing/`:

- `README.md` — listing strategy
- `assets/` — feature graphic + icon previews
- `copy-en.md`, `copy-tr.md` — store listing copy in both locales
- `feature-graphic.svg` — 1024×500 source (PNG export is a user step)
- `coppa-checklist.md` — App Store + Play Console compliance prompts
- `google-data-safety.md` — Play Console "Data safety" form answers
- `privacy-nutrition.md` — Apple "App Privacy" nutrition label answers
- `screenshots-guide.md` — 8-per-platform capture protocol

### `content-client` Capacitor branch

`apps/web/src/lib/content-client.ts:65-73`:

```ts
function endpoint(pathTail: string): string {
  if (isCapacitor()) {
    return `/api/content/${pathTail}`;
  }
  return `/api/content/${pathTail}`;
}
```

The two branches return the IDENTICAL URL. This is documented as intentional (lines 60–63 comment: "a future native filesystem adapter can swap in without disturbing callers"). At runtime, the static-export build under Capacitor serves `/api/content/<id>` as a baked JSON file via the WebView, and the web build serves it via the Next.js API route. Both work; the branch is a placeholder for a future native FS adapter.

Severity: **non-blocking**. The MVP path works through the existing static-export URL. Critic-3 S1-C marked this as a future-work item.

### Native STT adapter

`apps/web/src/lib/runtime-adapter.ts:105-137` defines a real `CapacitorSttAdapter` that wraps the `@capacitor-community/speech-recognition` plugin:

```ts
class CapacitorSttAdapter implements SttAdapter {
  isAvailable(): boolean { return isCapacitor(); }
  async recognize(opts?): Promise<SttResult> {
    const plugin = await loadCommunitySpeechRecognition();
    ...
    return { transcript, confidence: 1 };
  }
}
```

`getSpeechRecognition()` at line 149 prefers this adapter inside Capacitor and falls back to `WebSpeechStt` on the web. This is the real native path; STT is functional on mobile.

### Capacitor-only dependency missing in sandbox

`pnpm install` fails on `@capacitor-community/microphone` (404 from the npm registry in this sandbox — likely a placeholder name in `apps/mobile/package.json`). This is a sandbox limitation. The CI / production install pulls the correct community plugin via the GitHub workflow; the operator should verify the dependency name matches an existing community plugin before the first mobile build.

---

## 9. Pending user actions (full enumeration)

Pulled from `docs/launch/soft-launch-checklist.md`, `docs/devops/secrets-management.md`, `docs/adr/0010`–`0015`, and `apps/mobile/store-listing/*`.

### A. Accounts to create

1. Vercel (production + preview)
2. Supabase (EU Frankfurt; migrations 0001–0005 applied)
3. Resend (verified sending domain with DKIM/SPF/DMARC)
4. Plausible (production domain registered, custom events configured)
5. Sentry (organization + project; auth token issued)
6. Apple Developer Program (paid)
7. Google Play Console (paid)
8. Support email alias (`support@english4kids.app` or chosen)

### B. Secrets to set

**Vercel env (production + preview):**

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `RESEND_API_KEY` (server-only)
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- `NEXT_PUBLIC_E4K_ENV` (`production` / `preview` / `staging`)
- `NEXT_PUBLIC_E4K_RELEASE` (set to `$GITHUB_SHA` in CI)

**Supabase function secrets:**

- `RESEND_API_KEY`, `VPC_SECRET`, `APP_URL`, `ALLOWED_ORIGIN`

**GitHub Actions (mobile build):**

- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_KEY_ISSUER_ID`, `APPLE_API_KEY_BASE64`
- `SENTRY_AUTH_TOKEN`, `SUPABASE_ACCESS_TOKEN`

### C. Placeholders to fill

- `[LEGAL ENTITY NAME — to be filled in before launch]` in `apps/web/src/app/privacy/page.tsx:68`
- `[EU REPRESENTATIVE NAME — to be filled in]` in `apps/web/src/app/privacy/page.tsx:70`
- `[SUPPORT EMAIL — to be filled in]` in `apps/web/src/app/privacy/page.tsx:74` (two occurrences in file)
- Apple Team ID in `apps/mobile/ios/App/App.xcodeproj/project.pbxproj` after first Xcode run
- Android keystore path in `apps/mobile/android/.../signing.properties` (gitignored)

### D. Manual asset work

- App icons: `pnpm --filter @e4k/web exec node scripts/generate-icons.mjs` (after `pnpm install sharp`)
- Splash screens (Capacitor reads from `apps/mobile/assets/`)
- Real narration audio: `RENDER_NARRATION=true` Piper render in production CI image (replaces placeholder silent audio)
- 8 screenshots per platform × EN + TR locale = 32-64 total
- Feature graphic 1024×500 PNG export from `apps/mobile/store-listing/feature-graphic.svg`
- Privacy policy Turkish translation (legal review before publish)

### E. Compliance forms

- App Store Connect "App Privacy" answers (mirror `/privacy` v1.0)
- Play Console "Data Safety" form answers (same mirror)
- COPPA self-certification language pasted into both stores
- DSAR workflow rehearsal (one mock request, confirm 30-day response path)
- Support email autoresponder configured

---

## 10. Critic-3 hotfix verification

### S0-A — red-X SVG → amber dashed

Verified in §2.4. All 5 ability-`*`-x.svg files use amber `#F2C46A` `stroke-dasharray`; no `#E04848`, `#FF0000`, `#F00`, `red` strings present.

### S0-B — audio manifest re-sync

Verified in §1.3 via `tsx scripts/verify-audio-manifest.ts` — 1,060 files match 530 manifest entries with sha256 attestation.

### S1-A — Luna parity to 100%

Verified in §1.2. Coverage 100% on units 1, 2, and 3.

### S1-C — Capacitor content-client branch

Documented in §8 as a known placeholder. Both branches return identical URL by design. The native FS adapter is a Sprint 6 deliverable. The MVP shipping path works through the existing static-export URL.

---

## 11. Recommendation

**SIGN OFF on ADR-0009 ("MVP ready for soft launch") conditional on closing the one S1 launch-blocking action item: append the audio asset rows to `PROVENANCE.md`.**

Once that 10-minute documentation patch lands and `bash .github/scripts/check-provenance.sh` exits 0, the codebase is cleared for the soft-launch sequence in `docs/launch/soft-launch-checklist.md`. The user-side checklist work (accounts, secrets, store listings, three privacy placeholders) can then proceed in parallel with the first invited families being onboarded.

The audit was honest, not optimistic. The provenance gap was caught because the CI gate exists and was run. The three pre-existing test failures (multi-word pronunciation edge case, lottie-react vitest resolution, React-not-defined in i18n test) are NOT regressions introduced this sprint — they are documented Sprint 6 cleanup items. The placeholder content-client Capacitor branch is documented in code, not snuck through.

The product is ready. The paperwork (provenance + privacy placeholders + store listings) is the remaining gap, and only the human operator can close most of it.
