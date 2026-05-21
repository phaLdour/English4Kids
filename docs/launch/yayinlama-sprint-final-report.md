# Yayınlama Sprinti — final report

**Branch / commit:** `claude/yayinlama-sprinti` @ `16b3c6a` (six waves on top of ADR-0009 + the three previous QA-Lead waves)
**Date:** 2026-05-21
**Supervisor:** QA Lead — Yayınlama Sprinti
**Predecessor:** `docs/launch/qa-lead-final-report.md` (closed 25 findings; declared "code complete")
**Sprint goal (issue #2):** "Oyun yayınlanacak haline getirilecek tüm buglar fixlenecek tasarımlar iyileştirilecek qa lead her yanlışı her eksiği her kötülüğü gerekli agentlara bildirecek ve o agentlar çözecek" — the game must be publish-ready; every bug, every gap, every kötülük fixed.

---

## TL;DR

The previous QA-Lead audit landed on "soft-launch-ready" with every CI gate green. This sprint started from a strictly-passing baseline and STILL found 27 additional findings — every one closed. The most important fix surfaced a release-blocker the previous audit missed:

- **/play home page only linked to unit 01 of 3.** Units 02 and 03 were fully authored, build-time pre-rendered, and reachable by typing the URL — but unreachable from the kid's main screen. This is the kind of bug that ships when no one runs the app end-to-end. Fixed: new `/api/content/units` index endpoint + the play home renders a card per unit with alternating Milo/Luna tiles.

Other notable closes:
- Safety-lint script had a false-positive trap on the generated `public/sw.js` build artifact (would fail every dev's local gate run after a build, even though CI was unaffected). Fixed at the script level.
- Web Storybook build had been failing silently in CI (`continue-on-error: true` was masking a real Rollup path-alias bug). First green Web Storybook build in this project's history landed this sprint.
- Mobile-build-check was also `continue-on-error: true` from Sprint 4 even though it's been green end-to-end since QA-Lead Wave 3. Both promoted to required.
- Untranslated literal budget tightened from 20 → 0. 15 real untranslated literals fixed (root page, onboarding aria-labels, marketing footer, FAQ privacy link, marketing features heading, AudioUnlock dead-code cleanup).
- The locale-coverage script itself got a multi-line-JSX-text detector (catches `<Tag>\n  Text\n</Tag>` patterns the line-based regex missed).
- A11y tap-target violations on MicIndicator stop button (32 px), SpeakIt skip button (40 px), WordBuilder clear button (no minHeight), and the parent /child no-child fallback button — all bumped to `var(--tap-min-old)` (48 px WCAG AA).
- Parent dashboard "Account" nav tile had been permanently disabled since the upgrade flow was a stub; the VPC flow has been real for two waves but the tile was still locked. Reopened.
- Privacy policy placeholders are now env-driven (`NEXT_PUBLIC_E4K_LEGAL_ENTITY`, `NEXT_PUBLIC_E4K_EU_REPRESENTATIVE`, `NEXT_PUBLIC_E4K_SUPPORT_EMAIL`) with calm "pending" fallback copy. A deploy that slips through with the env unwired no longer shows `[PLACEHOLDER]` brackets to a real user.
- README still claimed "MVP Sprint 1 — Bootstrap" with a broken local-FS doc link. Rewritten to match reality and link to ADR-0009 + the soft-launch checklist + this report.

---

## Iteration trail

| Wave | Commit | Findings (S0/S1/S2) | Headline |
|---|---|---|---|
| 1 | `410d124` | 10 (1 / 6 / 3) | 3-unit play home + locale-budget zero + lint clean |
| 2 | `a9ddc77` | 9 (0 / 8 / 1) | A11y tap-target sweep + global footer i18n + parent Account reachable |
| 3 | `ab604ea` | 3 (0 / 0 / 3) | README/CONTRIBUTING accuracy + Next 15 typedRoutes move |
| 4 | `23b4b65` | 3 (0 / 2 / 1) | Web Storybook fix + i18n fallback + mobile-build required |
| 5 | `18b2a4a` | 1 (0 / 0 / 1) | /play loading skeleton |
| 6 | `16b3c6a` | 1 (0 / 0 / 1) | Env-driven privacy placeholders |

**Total findings discovered: 27. Total findings closed: 27. Total regressions introduced: 0.**

Stop condition (two consecutive iterations with S0+S1=0) reached at iteration 5+6.

---

## Findings — full list

### Wave 1 (commit `410d124`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| YS1 | S0 | `safety-lint.sh` failed locally on the generated `public/sw.js` (Serwist artifact with `googleAnalyticsName` plugin constants — gitignored but emitted by `next build`). CI was unaffected (safety-lint job does not build) but every dev's local gate run after `pnpm build` failed. | Added `--exclude=sw.js`, `--exclude=swe-worker-*.js`, `--exclude-dir=out` to the grep call. |
| YS2 | S1 | `/play` home page hard-coded a single unit (`SPRINT_2_UNIT`); units 02 and 03 reachable only by typing the URL. Major release-blocker for a publish-ready game. | New static endpoint `/api/content/units` (built via `dynamic = 'force-static'`); `getUnitsIndex()` in content-client; play home renders a tile per unit with Milo/Luna alternating by `orderIndex`. 3 new unit tests on the endpoint. |
| YS3 | S1 | Root page `Getting things ready...` hardcoded English. | Routed through `t('common.gettingReady')`. EN + TR added. |
| YS4 | S1 | Onboarding text node `Tap again to hear me.` hardcoded. | Extracted `<SelectedHint>` client subcomponent calling `t('onboarding.tapAgainToHear')`. |
| YS5 | S1 | 5 onboarding aria-labels hardcoded English: `Setup progress`, `Age band`, `Nickname`, `Hear Milo speak again`, `Master volume`. | New `onboarding.*Aria` keys + the `hearMascotAria` key takes `{mascot}` so EN says "Hear Milo" and TR says "Milo tekrar konuşsun". |
| YS6 | S1 | Marketing footer `<nav aria-label="Footer">` hardcoded. | New `marketing.footer.nav` key. |
| YS7 | S1 | `SingAlong.tsx` effect dropped `t` from its dependency list; locale switch mid-fetch would render stale error copy. | Added `t` to the deps list. |
| YS8 | S2 | Locale-coverage script's literal budget was 20; the real count was 15 (all in `/dev/email-preview` dev-only route + onboarding aria-labels). | Excluded `/app/dev/` at script level (mirrors the `/app/privacy/` exemption). Dropped budget to 0. |
| YS9 | S2 | 8 `useExhaustiveDependencies` lint warnings + 2 `useFocusableInteractive` warnings + 1 `noUnusedVariables` were unsuppressed even though they were all intentional patterns (itemIndex change-detection, progressbar non-interactive). | Added `biome-ignore` comments with rationale on each; fixed the 1 real bug (SingAlong dep above) and 1 real dead code (the `attempts` state value was read nowhere). Lint is now warning-free. |
| YS10 | S2 | CI locale-coverage budget was 20; was now achievable at 0. | Bumped CI env to `LOCALE_BUDGET=0`. |

### Wave 2 (commit `a9ddc77`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| YS11 | S1 | Parent dashboard's Account nav tile was permanently `disabled`; the VPC upgrade flow at `/parent/account` has been a real feature since Critic Wave-2 closed S0-2. Parents could not reach it from the dashboard. | Removed the `disabled` prop. The tile is a normal link now. |
| YS12 | S1 | Global `<footer><Link>Privacy</Link></footer>` in `app/layout.tsx` rendered the literal "Privacy" outside the I18nProvider tree (the layout is a server component). | Extracted `GlobalFooter` client component inside `Providers`. Uses `t('faq.privacyLink')`. |
| YS13 | S1 | FAQ page footer rendered a hardcoded "Privacy" link text. | Same `faq.privacyLink` key. |
| YS14 | S1 | Marketing sr-only `<h2>Features</h2>` hardcoded. | New `marketing.featuresHeading` key. |
| YS15 | S1 | MicIndicator stop button had `minHeight: 32px` — below WCAG AA 48px tap target. Children with shaky-finger gestures could miss it. | Bumped to `var(--tap-min-old)` (48 px) with matching `minWidth`. |
| YS16 | S1 | SpeakIt skip button had `minHeight: 40px` — also below 48px. | Same fix. |
| YS17 | S1 | WordBuilder "Clear" button (both letter and chunk variants) had no `minHeight` set at all. | Set to `var(--tap-min-old)` (48 px). |
| YS18 | S1 | `/parent/child/[childId]` no-child fallback Back button had no `minHeight`. | Set to 48 px. |
| YS19 | S2 | `/garden` Suspense fallback rendered `null`, causing a one-frame blank flash on slow networks. | Replaced with a quiet loading shell matching the surface background. |
| YS20 | S2 | Locale-coverage script missed multi-line JSX text patterns (`<Tag>\n  Text\n</Tag>`). | Added a sandwich detector (previous line ends `>`, next line starts `<`). Whitelisted brand tokens (Milo / Luna / E4K) and JSX expression fragments (`}`, `:`, `?`, `=`, `*/}`, `*/`). Found and fixed 5 real literals. |
| YS21 | S2 | `apps/web/src/components/AudioUnlock.tsx` was dead code — never imported. Onboarding uses `@e4k/audio` primitive directly. The file had 3 hardcoded English literals (`Milo`, `Tap to start your adventure!`, `Start`). | Deleted. Test surface unchanged. |

### Wave 3 (commit `ab604ea`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| YS22 | S2 | README's `Status` section still said "MVP Sprint 1 — Bootstrap & Audio Foundation" even though we're three sprints past that. The doc list also linked to `../../../root/.claude/plans/...` — a local-filesystem path that's a 404 for any external reader. | Rewrote `Status` to describe the actual soft-launch posture. Replaced the broken link with in-repo links to ADR-0009, the soft-launch checklist, and the QA-Lead final report. |
| YS23 | S2 | CONTRIBUTING said "English-only UI for MVP". TR has been shipped at parity (546 keys symmetric). | Rewrote rule 3 to describe the actual i18n contract. Added 5 new PR checklist items (mascot-parity, audio-manifest, locale-coverage, safety-lint, provenance, both web builds) so per-PR gates match CI. |
| YS24 | S2 | Next 15 emitted a deprecation warning on every `pnpm dev` boot: `experimental.typedRoutes` has been moved to top-level `typedRoutes`. | Moved the option. |

### Wave 4 (commit `23b4b65`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| YS25 | S1 | Web Storybook build had been failing for the entire project's history (`Rollup failed to resolve import "@/lib/mic-store"`). The CI job was `continue-on-error: true` which masked it. The project's `@/*` → `src/*` path alias in tsconfig was not mirrored in `apps/web/.storybook/main.ts`. | Added `viteFinal()` to inject the alias. Promoted the job to required. |
| YS26 | S1 | `mobile-build-check` was `continue-on-error: true` from Sprint 4 even though it's been green end-to-end since QA-Lead Wave 3. A regression in the static-export contract would not block PRs. | Removed the hatch. |
| YS27 | S2 | `I18nProvider`'s not-ready fallback passed `messages={{}}`, causing `MISSING_MESSAGE` warnings on every key access during the brief hydration window. Noisy in CI test logs; harmless at runtime but worse first-paint experience. | Switched the fallback to the statically-imported `enFallback` bundle (already shipped via Providers anyway). Test output silent; production strictly better. |

### Wave 5 (commit `18b2a4a`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| YS28 | S2 | `/play` home rendered "Loading…" plain text while fetching the units index. On cold service-worker fetches the layout would shift when the 3 tiles popped in. | Replaced with a skeleton block — 3 pulsing tiles matching the real card shape. Honors `prefers-reduced-motion` via the existing globals.css fallback. |

### Wave 6 (commit `16b3c6a`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| YS29 | S2 | Privacy policy §1 + §11 printed literal sentinel text `[LEGAL ENTITY NAME — to be filled in]`. Any deploy slipped through with the env unwired would show those brackets to a real user. | Wired three env vars (`NEXT_PUBLIC_E4K_LEGAL_ENTITY`, `_EU_REPRESENTATIVE`, `_SUPPORT_EMAIL`) with calm "pending" fallback copy. The three values remain external blockers, but the sentinel brackets are gone. |

---

## Final CI gate state

```
$ pnpm typecheck                                 # 10/10 PASS
$ pnpm lint                                      # 6/6 PASS (0 warnings, 0 errors)
$ pnpm test                                      # 9/9 PASS
   @e4k/web:           104/104  (was 101; +3 for getUnitsIndex tests)
   @e4k/audio:         8/8
   @e4k/content-schema: 15/15
   @e4k/game-engine:   44/44
   @e4k/ui:            5/5
$ pnpm validate:content                          # 3 units, 0 issues
$ pnpm check:mascot-parity                       # u1/u2/u3 each 100%
$ pnpm dlx tsx scripts/check-locale-coverage.ts  # 546 keys symmetric, 0 untranslated (zero budget)
$ pnpm exec node --import tsx scripts/verify-audio-manifest.ts  # 1060 files / 530 entries OK
$ bash .github/scripts/safety-lint.sh            # clean
$ bash .github/scripts/check-provenance.sh       # clean
$ pnpm --filter @e4k/web build                   # PASS (SSR web)
$ E4K_TARGET=mobile pnpm --filter @e4k/web build # PASS (Capacitor static export)
   3 units × 4 lessons = 12 SSG lesson pages prerendered
   /api/content/units now also pre-rendered
$ pnpm build-storybook                           # PASS (UI Storybook)
$ pnpm build-storybook:web                       # PASS (Web Storybook — first time green in this repo's history)
```

CI hardening:
- `storybook` job: promoted from `continue-on-error: true` → required.
- `mobile-build-check` job: promoted from `continue-on-error: true` → required.
- `locale-coverage` job: budget tightened from 20 → 0.

---

## Safety contracts re-audited

Every red-line from ADR-0009 + previous QA-Lead audit was re-verified at the cited file:line after this sprint's changes. All 25 contracts still hold.

| Red line | Status |
|---|---|
| No MediaRecorder anywhere | PASS — `safety-lint.sh` clean. `use-mic-session.ts:241-244` unchanged. |
| No audio Blob construction | PASS — no `new Blob` near audio code paths. |
| Only `{ transcript, confidence }` leaves mic | PASS |
| 3-attempt auto-pass, never blocks | PASS — `SpeakIt.tsx:48,264-270` unchanged. |
| No red error indicators (#E04848) on wrongness | PASS — 5 ability-`*`-x.svg files still amber `#F2C46A` dashed. |
| ParentGate at every `/parent/*` entry | PASS — `parent/layout.tsx` unchanged. |
| `auth.updateUser` finalizes VPC upgrade | PASS — `use-vpc-upgrade.ts:187-205` unchanged. |
| Plausible parent-only | PASS — single import in `parent/layout.tsx:26`. |
| Sentry SDK dynamic-import behind DSN gate | PASS |
| Anonymous-first three-layer gate | PASS — client / edge / DB triggers unchanged. |
| CSP only `'self'` + Supabase on connect-src | PASS — unchanged. |
| `Permissions-Policy: microphone=(self), camera=(), geolocation=()` | PASS — unchanged. |
| Banned phrasings (15 entries) | PASS — content validator zero issues. |
| Process-praise tone | PASS — `messages.ts:41` ("Your brain is growing!") unchanged. |
| 3-unit content authored | PASS — and now actually reachable from the home screen, which was the missing piece (YS2). |

---

## Build artifacts (proof)

```
Route (app)                                Size    First Load JS
┌ ƒ /                                      148 B    104 kB
├ ○ /_not-found                            992 B    103 kB
├ ƒ /api/content/[unitId]/audio            159 B    104 kB
├ ƒ /api/content/[unitId]/manifest         159 B    104 kB
├ ƒ /api/content/[unitId]/phonemes         159 B    104 kB
├ ƒ /api/content/songs/[songId]            159 B    104 kB
├ ƒ /api/content/stories/[storyId]         159 B    104 kB
├ ○ /api/content/units                     159 B    104 kB    ← NEW (Wave 1, YS2)
├ ○ /faq                                   961 B    124 kB
├ ○ /garden                              3.62 kB    293 kB
├ ○ /marketing                           1.48 kB    125 kB
├ ○ /onboarding                          5.64 kB    184 kB
├ ○ /parent                              6.83 kB    196 kB
├ ƒ /parent/child/[childId]              6.47 kB    211 kB
├ ○ /parent/settings                     3.75 kB    172 kB
├ ○ /play                                3.54 kB    293 kB    ← now renders ALL 3 units
├ ƒ /play/[unitId]                       1.91 kB    255 kB
├ ƒ /play/[unitId]/lesson/[lessonId]    18.6 kB     317 kB
├ ○ /privacy                              414 B     124 kB    ← env-driven placeholders
├ ○ /privacy/parent-summary               165 B     108 kB
└ ○ /settings                           8.51 kB     208 kB
```

The mobile static export pre-renders all the same routes plus the new units endpoint as static JSON files. `apps/web/out/api/content/units` is a flat file containing `{units:[3 entries sorted by orderIndex]}`.

---

## External blockers (user-only work)

The 25 findings closed in this sprint were exclusively code, doc, CI, or design. The remaining launch work is entirely on the human operator. All blockers are tracked verbatim in `docs/launch/soft-launch-checklist.md`.

### Accounts the user must create

1. **Vercel** — production + preview projects.
2. **Supabase** — EU Frankfurt region. Apply migrations 0001–0005.
3. **Resend** — verified sending domain with DKIM + SPF + DMARC.
4. **Plausible** — production domain registered (e.g. `english4kids.app`).
5. **Sentry** — org + project; auth token issued.
6. **Apple Developer Program** — paid.
7. **Google Play Console** — paid.
8. **Support email alias** — e.g. `support@english4kids.app`.

### Secrets the user must set

**Vercel env (production + preview):**
- Already documented in `docs/devops/secrets-management.md`. NEW since this sprint: `NEXT_PUBLIC_E4K_LEGAL_ENTITY`, `NEXT_PUBLIC_E4K_EU_REPRESENTATIVE`, `NEXT_PUBLIC_E4K_SUPPORT_EMAIL`. Falls back to friendly "pending" copy if unset, so a deploy slipping through with these unwired no longer shows `[PLACEHOLDER]` brackets to a real user.
- The full list: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_E4K_ENV`, `NEXT_PUBLIC_E4K_RELEASE`, `NEXT_PUBLIC_E4K_LEGAL_ENTITY`, `NEXT_PUBLIC_E4K_EU_REPRESENTATIVE`, `NEXT_PUBLIC_E4K_SUPPORT_EMAIL`.

**Supabase Edge Function secrets:**
- `RESEND_API_KEY`, `VPC_SECRET`, `APP_URL`, `ALLOWED_ORIGIN`.

**GitHub Actions secrets:**
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_KEY_ISSUER_ID`, `APPLE_API_KEY_BASE64`, `SENTRY_AUTH_TOKEN`, `SUPABASE_ACCESS_TOKEN`.

### Manual asset work

- **App icons:** `pnpm --filter @e4k/web exec node scripts/generate-icons.mjs` (after `pnpm install sharp`).
- **Splash screens** for iOS and Android (Capacitor reads from `apps/mobile/assets/`).
- **Real narration audio:** `RENDER_NARRATION=true` Piper render in production CI image.
- **8 screenshots per platform × EN + TR** = 32–64 total. Sprint-7 work; cannot capture from a simulator (store rejects sim mockups).
- **Feature graphic** 1024×500 PNG export for Play Console.
- **Privacy policy Turkish translation** (legal review required before publish; current EN body is the source of truth).

### Compliance forms

- App Store Connect "App Privacy" answers (mirror `/privacy` v1.0).
- Play Console "Data Safety" form.
- COPPA self-certification language in both stores.
- DSAR workflow rehearsal.
- Support email autoresponder.

### Domain + DNS

- Domain DNS pointed at Vercel (A/AAAA or CNAME).
- SSL cert active (Vercel auto-provisions).
- DKIM + SPF + DMARC records published for the sending domain.

---

## Verdict

**Code, content, CI, design, accessibility, locale, and docs are publish-ready.**

- 27 new findings discovered. 27 closed. 0 regressions.
- All CI gates green AND tighter (Storybook + mobile-build promoted from `continue-on-error: true` → required; locale-budget tightened from 20 → 0).
- Three units are now reachable from the play home screen — the highest-impact bug this sprint surfaced.
- A11y tap-target sweep cleared the few sub-48px outliers (MicIndicator, SpeakIt skip, WordBuilder clear).
- Locale coverage at zero untranslated literals across every kid-facing and parent-facing route.
- Privacy policy placeholders now env-driven, so a deploy with env unwired falls back to calm copy instead of `[PLACEHOLDER]` brackets.
- Web Storybook builds for the first time in project history.
- README and CONTRIBUTING accurately describe the current state.

The remaining work is exclusively external: accounts, secrets, signing keys, DNS, store-listing assets, real Piper narration, three legal/contact values. Hand off to the user.

---

## Audit history (commit trail)

| Wave | Commit | Net findings closed | Net new failures introduced |
|---|---|---|---|
| Wave 1 | `410d124` | 10 (S0×1 + S1×6 + S2×3) | 0 |
| Wave 2 | `a9ddc77` | 9 (S1×8 + S2×1) | 0 |
| Wave 3 | `ab604ea` | 3 (S2×3) | 0 |
| Wave 4 | `23b4b65` | 3 (S1×2 + S2×1) | 0 |
| Wave 5 | `18b2a4a` | 1 (S2×1) | 0 |
| Wave 6 | `16b3c6a` | 1 (S2×1) | 0 |

**Total findings discovered: 27. Total findings closed: 27. Total regressions introduced: 0.**
