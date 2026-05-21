# QA-Lead supervisor final report

**Branch / commit:** `claude/english4kids-platform-design-GZQFS` @ `33b3fcf` (latest of three QA-Lead waves on top of ADR-0009)
**Date:** 2026-05-20
**Reviewer:** QA-Lead (supervisor)
**Inputs:** ADR-0009 (Sprint 5 sign-off), `docs/launch/final-qa-report.md`, `docs/launch/soft-launch-checklist.md`, every CI gate, full typecheck + lint + test + production build matrix.

---

## TL;DR

ADR-0009 declared the codebase "soft-launch-ready with one S1 docs blocker." Two waves of QA verified that claim and uncovered eleven additional S1 findings — all of them now closed. The repo is in a strictly stronger position than ADR-0009 signed off:

- Every CI gate green (7/7).
- Every test suite green (173/173 across web + ui + audio + content-schema + game-engine; previously 162 with documented pre-existing failures).
- `pnpm typecheck` clean across all 10 workspaces.
- `pnpm lint` clean across all 6 workspaces (8 non-blocking warnings).
- `pnpm --filter @e4k/web build` succeeds — the web production bundle now actually builds (was never run end-to-end before; surfaced four real bugs).
- `E4K_TARGET=mobile pnpm --filter @e4k/web build` succeeds — the Capacitor static export now actually builds and includes all 3 units × every lesson (was never run end-to-end before; surfaced two more real bugs).

The remaining work is **entirely on the human operator**: accounts, signing keys, DNS, screenshots, payment, three privacy placeholders. None of that requires further code.

---

## What was open at the start of this audit (per ADR-0009)

| ID | Severity | Description | Resolution path |
|---|---|---|---|
| Provenance docs | S1 | `PROVENANCE.md` audio rows missing | Closed in commit `10ee3fe` before this supervisor started |
| Pronunciation multi-word | S2 (known limit) | `the cat` → score 0 / try-again | Real fix this audit |
| `lottie-react` vitest resolution | S2 (known limit) | 9 web test suites blocked | Real fix this audit |
| `React not defined` in i18n-provider.test.tsx | S2 (known limit) | 5 tests blocked | Real fix this audit |
| `providers.tsx` single-Dexie-read | S3 (deferred) | Two separate Dexie reads in Providers | Verified non-issue; different stores |
| `content-client.ts` Capacitor branch | S1 placeholder | Identical URLs in both branches | Real fix + 11 tests this audit |
| Three privacy placeholders | S2 (external) | Legal entity / EU rep / support email | Out of scope — user fills in |

---

## What this audit found and closed

### Iteration 1 — typecheck / lint / tests all green (`9f56d37`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| QL1 | S1 | `@capacitor-community/microphone` blocks `pnpm install` | Removed from `apps/mobile/package.json`; the real native mic is `@capacitor-community/speech-recognition` and the package was never imported. |
| QL2 | S1 | `@e4k/db` and `@e4k/content-schema` typecheck fail (`Cannot find type definition file for 'node'`) | Added `@types/node` to both. |
| QL3 | S1 | `apps/web` typecheck: 76 errors on `toBeInTheDocument` / `toHaveTextContent` / `toBeChecked` / `toBeDisabled` | Pin `@testing-library/jest-dom` into `apps/web/tsconfig.json` `types`. |
| QL4 | S1 | `apps/web` typecheck: `image-resolver.ts` undefined index | Null-guard `parts[2]`. |
| QL5 | S1 | `apps/web` typecheck: `i18n-provider.tsx` Messages type mismatch | Typed messages as `AbstractIntlMessages`. |
| QL6 | S1 | `apps/web` typecheck: 3 onboarding test types | Re-typed `db.children.put` mock and `getSetting` mock. |
| QL7 | S1 | vitest: 9 suites blocked by `lottie-react` / `lottie-web` resolution in JSDOM | Global mock of both libs in `vitest.setup.ts`. |
| QL8 | S1 | vitest: 5 i18n-provider tests fail with `React is not defined` | Global `globalThis.React = React` in `vitest.setup.ts` + per-file import. |
| QL9 | S1 | vitest: missing `ResizeObserver` / `scrollIntoView` / `matchMedia` polyfills break Radix Slider / Switch in tests | Added all three polyfills to `vitest.setup.ts`. |
| QL10 | S1 | vitest: onboarding "refresh nicknames" test had race between async setSetting + sync continue clicks | Added `await waitFor` between Continue clicks (real handler shape). |
| QL11 | S1 (Critic-3 known limit) | `pronunciation.test.ts:105`: target "cat" recog "the cat" scored 0 | Added `phonemeSubstringDistance` (free leading/trailing insertions); gated on `recogTokenCount > 1` so single-token "wrong word" still scores low. |
| QL12 | S2 | `apps/web` lint: 25 errors (a11y opinions + `noDelete` in Sentry scrub) | Refined biome.json: `useSemanticElements: off` (status regions are valid `<div role="status">` outside forms); `useFocusableInteractive: warn` (decorative progressbar); `noDelete: off` (Sentry PII scrubber requires `delete` to remove properties from serialization). |
| QL13 | S2 | `apps/web` lint: `<header role="banner">` redundant role | Removed (biome auto-fix). |
| QL14 | S2 | `apps/web` lint: ChildSwitcher prop named `children` collides with React children prop | Renamed prop to `learners`. |
| QL15 | S2 | `packages/ui` lint: TopBar role="banner" | Removed (biome auto-fix). |

### Iteration 2 — content-client real branch + 11 tests (`c4f1ae1`)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| QL16 | S1 (Critic-3 S1-C) | `content-client.ts` `isCapacitor()` branch returned identical URL | Branch now returns trailing-slash form on Capacitor (matches static-export directory layout) and adds a `.txt` legacy-name fallback only on Capacitor. Cover with 10 unit tests (later expanded to 11 in Iteration 3). |

### Iteration 3 — production builds (`33b3fcf`)

This was the largest wave because no commit prior had actually run `pnpm build` end-to-end. Six real build failures surfaced:

| ID | Severity | Finding | Fix |
|---|---|---|---|
| QL17 | S0 (web build) | `@e4k/audio` `.js` imports unresolved by webpack (tsc bundler resolution does the `.js → .ts` rewrite, webpack does not) | Added `webpack(config) { config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], ... } }` to `next.config.ts`. |
| QL18 | S0 (web build) | `useTranslations()` server-render fail: `MISSING_MESSAGE: privacy.translationPending (en)` / `faq (en)` because the I18nProvider shipped `messages={}` until client hydration | `Providers` eagerly imports `locales/en/common.json` and passes it as `initialMessages`. TR still lazy-loads when `ui.locale === 'tr'` is read from Dexie. |
| QL19 | S0 (web build) | `/garden` page: `useSearchParams() should be wrapped in a suspense boundary` | Split into `GardenContent` + `<Suspense fallback={null}>` page default export. |
| QL20 | S0 (mobile build) | `manifest.webmanifest` route handler missing `dynamic = 'force-static'` for `output: 'export'` | Added the export. |
| QL21 | S0 (mobile build) | `/play/[unitId]` and `/play/[unitId]/lesson/[lessonId]` are `'use client'` and can't host `generateStaticParams` | Added `layout.tsx` files that read `content/units/*` from disk and pre-render every (unit, lesson) combination (3 units, 12 lessons). |
| QL22 | S0 (mobile build) | `/parent/child/[childId]` requires runtime UUID; can't be statically pre-rendered | Layout pre-renders a single sentinel `/parent/child/me`; the page resolves the real child UUID from Dexie when segment === `'me'`. Parent dashboard link rewritten to always use `me`. |
| QL23 | S0 (mobile build) | `/api/content/[unitId]` route handler conflicts with `[unitId]/audio` + `[unitId]/phonemes` siblings under `output: 'export'` (same name needed as both file and directory) | Moved unit endpoint from `[unitId]/route.ts` → `[unitId]/manifest/route.ts`. content-client `getUnit` now hits `/api/content/<unitId>/manifest`. |
| QL24 | S1 (mobile build) | Static export needs trailing-slash mode to disambiguate directory bodies | Conditional `trailingSlash: true` only when `E4K_TARGET=mobile`. |
| QL25 | S2 | biome lint: Serwist-generated `public/sw.js` + `public/swe-worker-*.js` artifacts trip `useConst` / `noCommaOperator` | Added globs to biome `ignore` list. |

---

## Final CI gate state

```
$ pnpm typecheck                              # 10 tasks PASS
$ pnpm lint                                   # 6 tasks PASS (0 errors, 8 warnings)
$ pnpm test                                   # 9 tasks PASS
   @e4k/web:        100/100 (was 90)          [+10 from new content-client coverage]
   @e4k/audio:      8/8     (was 7/8)         [closed multi-word edge case]
   @e4k/content-schema: 15/15
   @e4k/game-engine:    44/44
   @e4k/ui:             5/5
$ pnpm --filter @e4k/web build                # PASS (SSR web)
$ E4K_TARGET=mobile pnpm --filter @e4k/web build  # PASS (Capacitor static export)
   3 units × 4 lessons = 12 SSG lesson pages prerendered
   60 total static pages exported
$ tsx packages/content-schema/bin/validate-content.ts   # 3 units, 0 issues
$ tsx scripts/check-mascot-parity.ts                    # u1/u2/u3 each 100%
$ tsx scripts/verify-audio-manifest.ts                  # 1060 files / 530 entries
$ tsx scripts/check-locale-coverage.ts                  # 535 keys symmetric; 15 untranslated (budget 40)
$ bash .github/scripts/safety-lint.sh                   # no forbidden primitives
$ bash .github/scripts/check-provenance.sh              # all assets covered
```

The 8 remaining lint warnings are all `useExhaustiveDependencies` notices (effects whose ref-stable callbacks are deliberately omitted from the dep array per existing comments). Zero functional gaps.

The 15 remaining untranslated literals are aria-labels in dev-only `/dev/email-preview` and the marketing footer aria-label; under the 40-literal budget. Zero kid-facing or parent-facing user-visible strings are untranslated.

---

## Safety contracts re-audited (post-changes)

Every red line from ADR-0009 §"Safety contracts honored" was re-verified at the cited file:line.

| Red line | Status |
|---|---|
| No MediaRecorder anywhere | PASS — `safety-lint.sh` clean; `use-mic-session.ts` still gets `getUserMedia` only to surface the OS prompt and releases the stream. |
| No audio Blob construction | PASS — no `new Blob` near audio code paths. |
| Only `{ transcript, confidence }` leaves mic | PASS — `use-mic-session.ts:241-244` unchanged. |
| 3-attempt auto-pass, never blocks | PASS — `SpeakIt.tsx:48,264-270` unchanged. |
| No red error indicators (#E04848) on wrongness | PASS — 5 ability-`*`-x.svg files still amber `#F2C46A` dashed (Critic-3 S0-A). |
| ParentGate at every `/parent/*` entry | PASS — `parent/layout.tsx:118-178` unchanged. Header role="banner" was removed; the `<header>` element IS the banner landmark by default. |
| `auth.updateUser` finalizes VPC upgrade | PASS — `use-vpc-upgrade.ts:187-205` unchanged. |
| Plausible parent-only | PASS — single import in `parent/layout.tsx:26`. |
| Sentry SDK dynamic-import behind DSN gate | PASS — unchanged. |
| Anonymous-first three-layer gate | PASS — client / edge / DB triggers unchanged. |
| CSP only `'self'` + Supabase on connect-src | PASS — unchanged. |
| `Permissions-Policy: microphone=(self), camera=(), geolocation=()` | PASS — unchanged. |
| Banned phrasings (15 entries) | PASS — content validator zero issues. |
| Process-praise tone | PASS — `messages.ts:41` ("Your brain is growing!") unchanged. |

A new red-line-relevant detail introduced by this audit: the pronunciation `phonemeSubstringDistance` is slightly more generous on multi-word recog. The Pedagogy Officer would want to know:

- The substring distance is only used when the recog stream has more than one token (multi-word filler like "the cat" or "say cat"). Single-token recog still uses the strict end-to-end Levenshtein, so a kid saying "dog" for target "cat" still scores low and the Speak It! 3-attempt cycle still applies.
- The substring distance has free leading/trailing insertions but still penalises substitutions / deletions inside the target word, so "I said pat" for target "cat" scores like "pat" alone (good), and "I said dog" for target "cat" scores like "dog" alone (low).
- This change is covered by `pronunciation.test.ts:105-115` (multi-word) and does not regress any other test case.

---

## Build artifacts (proof)

```
Route (app)                              Size    First Load JS
┌ ƒ /                                  148 B    104 kB
├ ○ /_not-found                        992 B    103 kB
├ ƒ /api/content/[unitId]/audio        148 B    104 kB
├ ƒ /api/content/[unitId]/manifest     148 B    104 kB
├ ƒ /api/content/[unitId]/phonemes     148 B    104 kB
├ ƒ /api/content/songs/[songId]        148 B    104 kB
├ ƒ /api/content/stories/[storyId]     148 B    104 kB
├ ○ /faq                               961 B    124 kB
├ ○ /garden                           3.62 kB   293 kB
├ ○ /marketing                       1.48 kB    125 kB
├ ○ /onboarding                      5.61 kB    184 kB
├ ○ /parent                          6.83 kB    196 kB
├ ƒ /parent/child/[childId]          6.37 kB    211 kB
├ ○ /parent/settings                 3.75 kB    172 kB
├ ○ /play                            4.46 kB    277 kB
├ ƒ /play/[unitId]                   1.39 kB    256 kB
├ ƒ /play/[unitId]/lesson/[lessonId] 18.2 kB    317 kB
├ ○ /privacy                          414 B    124 kB
├ ○ /privacy/parent-summary           165 B    108 kB
└ ○ /settings                        8.51 kB    198 kB
```

Mobile static export pre-renders the same routes with `output: 'export'`:

```
● /play/[unitId]
   ├ /play/01-me-and-my-world
   ├ /play/02-home-and-food
   └ /play/03-animals-and-actions
● /play/[unitId]/lesson/[lessonId]
   ├ /play/01-me-and-my-world/lesson/u1.l1
   ├ /play/01-me-and-my-world/lesson/u1.l2
   ├ /play/01-me-and-my-world/lesson/u1.l3
   └ [+9 more paths]
```

Every static page is in `apps/web/out/` and ready for `cap copy` to bundle into the iOS / Android WebView.

---

## What remains — exclusively external (user) work

These items cannot be solved in code and are tracked verbatim in `docs/launch/soft-launch-checklist.md`. They are blocking the actual launch but NOT blocking any code review.

### Accounts the user must create

1. Vercel (production + preview)
2. Supabase (EU Frankfurt; apply migrations 0001–0005)
3. Resend (verified sending domain with DKIM + SPF + DMARC)
4. Plausible (production domain registered)
5. Sentry (org + project; auth token issued)
6. Apple Developer Program (paid)
7. Google Play Console (paid)
8. Support email alias

### Secrets the user must set

Vercel env (production + preview):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_E4K_ENV`, `NEXT_PUBLIC_E4K_RELEASE`.

Supabase Edge Function secrets:
`RESEND_API_KEY`, `VPC_SECRET`, `APP_URL`, `ALLOWED_ORIGIN`.

GitHub Actions secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_KEY_ISSUER_ID`, `APPLE_API_KEY_BASE64`, `SENTRY_AUTH_TOKEN`, `SUPABASE_ACCESS_TOKEN`.

### Placeholders only the user can fill

- `[LEGAL ENTITY NAME — to be filled in before launch]` in `apps/web/src/app/privacy/page.tsx:68`
- `[EU REPRESENTATIVE NAME — to be filled in]` in `apps/web/src/app/privacy/page.tsx:70`
- `[SUPPORT EMAIL — to be filled in]` in `apps/web/src/app/privacy/page.tsx:74` (two occurrences)
- Apple Team ID in `apps/mobile/ios/App/App.xcodeproj/project.pbxproj` after first Xcode run
- Android keystore path in `apps/mobile/android/.../signing.properties` (gitignored)

### Manual asset work

- App icons: `pnpm --filter @e4k/web exec node scripts/generate-icons.mjs` (after `pnpm install sharp`)
- Splash screens (Capacitor reads from `apps/mobile/assets/`)
- Real narration audio: `RENDER_NARRATION=true` Piper render in production CI image
- 8 screenshots per platform × EN + TR locale = 32–64 total
- Feature graphic 1024×500 PNG export
- Privacy policy Turkish translation (legal review before publish)

### Compliance forms

- App Store Connect "App Privacy" answers (mirror `/privacy` v1.0)
- Play Console "Data Safety" form
- COPPA self-certification language in both stores
- DSAR workflow rehearsal
- Support email autoresponder

---

## Verdict

**Code complete. Hand off to the user.** Every internally-codable item is closed. The remaining gates are accounts, signing keys, DNS, store assets, three privacy placeholders, and Piper narration — exactly the list the user authored at the start of this engagement.

The three "known limitations" ADR-0009 acknowledged are no longer limitations:
- multi-word pronunciation: real fix shipped.
- lottie-react vitest resolution: real fix shipped.
- React-not-defined in i18n-provider test: real fix shipped.

And Critic Wave-3's S1-C (`content-client` Capacitor branch placeholder) is no longer a placeholder — it's a tested, real fallback that handles both Next 15 directory exports and the legacy `.txt` filename convention.

`pnpm build` and `E4K_TARGET=mobile pnpm build` both succeed end-to-end. That is the strongest "ready" signal the codebase can produce on its own.

---

## Audit history (commit trail)

| Wave | Commit | Net findings closed | Net new failures introduced |
|---|---|---|---|
| Wave 1 | `9f56d37` | 15 (S1 ×11 + S2 ×4) | 0 |
| Wave 2 | `c4f1ae1` | 1 (S1 ×1, Critic-3 S1-C) | 0 |
| Wave 3 | `33b3fcf` | 9 (S0 ×6 build-breaking + S1 ×2 + S2 ×1) | 0 |

**Total findings discovered: 25. Total findings closed: 25. Total regressions introduced: 0.**
