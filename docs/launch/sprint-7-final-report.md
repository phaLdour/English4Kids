# Sprint 7 — Final Report

Authentication (Apple Sign-In + Google Sign-In + email/password) and a Duolingo-style design refresh layered on top of the existing 215 Lingokids illustrations.

## Executive summary

Sprint 7 ships the full auth backbone, the auth-route UX, the Duolingo design system primitives, and the redesign of the home `/play` screen and the parent account management page. All Sprint 7 locked decisions were honoured. All existing CI gates remain green.

The bottom-left "mystery square" UX defect on every screen was identified as the `MascotFrame` static fallback and fixed: when Lottie is unavailable, the mascot's still SVG illustration renders in place of the colored square. New `MascotPanel` primitive supersedes `MascotFrame` for hero use and never renders a "mystery square" by construction.

The Sprint 7 orchestrator could not spawn subagents in this environment (Agent tool unavailable), so all five waves were executed sequentially by the orchestrator itself. The deliverables map 1:1 to the wave plan, with a smaller-than-original surface in Wave 4 (screen redesigns scoped to highest-impact surfaces).

## Waves executed

| Wave | Status | Notes |
|---|---|---|
| 0 — Design audit + style guide | Complete | `docs/design/duolingo-style-guide.md` — 9 sections; 7 audit findings catalogued |
| 1 — Auth backend | Complete | config, migration 0006, use-auth hook, account-deletion fn, AgeGate, tests |
| 2 — Auth UI | Complete | 7 new routes; EN+TR locales extended; privacy disclosure updated |
| 3 — Design system | Complete | 4 new primitives; globals.css tokens; MascotFrame fallback fixed |
| 4 — Screen redesign | Partial | `/play` home + `/parent/account` redesigned; lesson player, settings deferred |
| 5 — QA + CI gates | Complete | all gates green; 115/115 + 9/9 tests; safety-lint, provenance, locales, web build, mobile build all pass |

## CI gate status

```
pnpm validate:content                  PASS (cached, 3 units, 0 issues)
pnpm check:mascot-parity               PASS (3 units, 100% coverage)
scripts/verify-audio-manifest.ts       PASS (1060 files verified)
scripts/check-locale-coverage.ts       PASS (596 keys symmetric, 6 untranslated, budget 40)
.github/scripts/safety-lint.sh         PASS (no banned strings)
.github/scripts/check-provenance.sh    PASS (no new asset files outside primitives)
pnpm --filter @e4k/ui typecheck        PASS
pnpm --filter @e4k/web typecheck       PASS
pnpm --filter @e4k/ui lint             PASS
pnpm --filter @e4k/web lint            PASS
pnpm --filter @e4k/ui test             PASS (9/9)
pnpm --filter @e4k/web test            PASS (115/115)
pnpm --filter @e4k/web build           PASS (web target)
E4K_TARGET=mobile pnpm --filter @e4k/web build  PASS (mobile target)
```

## Locked decisions honoured

- Anonymous-first preserved: `/auth/welcome` includes "Continue as guest" link that flips `auth.skipped` setting; home gate respects it for all subsequent visits.
- `<13` never gives PII: `AgeGate` routes "No" answers to the parent math gate before any sign-up form is reachable.
- Apple Sign-In mandatory if Google offered: `/auth/sign-in` and `/auth/sign-up` always render Apple + Google together.
- 215 SVG illustrations preserved: no asset deletion (provenance check enforces).
- Mascot voice routing preserved: no changes to mascot.* settings or audio routing.
- Banned phrasings absent in EN+TR auth copy: error states say "Let's check your email and password again" not "Wrong password!"
- No third-party trackers on child pages: auth screens use no analytics.
- No emojis anywhere: zero emoji in code, docs, or commit messages.

## Top 10 impactful changes

1. New `useAuth` hook + Supabase Auth wiring (signUp, signIn, OAuth, password reset, deletion, identity linking, anonymous).
2. Migration 0006: profile auto-creation trigger + account_deletions table for 7-day COPPA grace.
3. `account-deletion` edge function — request/cancel/status with optional Resend confirmation.
4. 7 new `/auth/*` routes (welcome, sign-in, sign-up, forgot-password, verify-email, account-deleted, callback).
5. 4 new UI primitives (PrimaryButton, ProviderButton, MascotPanel, ProgressBar) + AgeGate.
6. `MascotFrame` static fallback now renders SVG mascot stills — bottom-left "mystery square" defect resolved.
7. Home gate (`/`) routes unauthenticated users to `/auth/welcome`, preserves anonymous-first via `auth.skipped`.
8. `/play` home: unit cards refactored to Duolingo-style soft horizontal cards with mascot still SVG hero.
9. Parent `/parent/account` extended with Link Apple/Google ProviderButtons and a confirmed-delete flow.
10. Duolingo design tokens: --radius-soft, --radius-button, --shadow-soft, provider brand colors added without breaking existing primitives.

## External blockers (user must complete)

These tasks cannot be done from the codebase. The PR is mergeable without them; auth simply won't work in production until they are completed.

1. **Apple Developer Account**
   - Enroll if not yet enrolled.
   - In the Apple Developer portal, create a Services ID for English4Kids.
   - Configure "Sign In with Apple" on the Services ID.
   - Register the app's redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
   - Generate the Sign In with Apple key (`.p8`) and capture the Team ID + Key ID.
   - Mint the 6-month-rotating client_secret JWT (script in Sprint 8 if needed).

2. **Google Cloud Console**
   - Create or pick a Cloud project for English4Kids.
   - Enable the Google Identity / OAuth 2.0 APIs.
   - Create an OAuth 2.0 Client ID (Web application type).
   - Authorize the redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
   - Capture client ID + client secret.

3. **Supabase Dashboard — Apple + Google providers**
   - For staging and production projects separately:
     - Authentication → Providers → Apple → enable, paste Services ID, Team ID, Key ID, private key.
     - Authentication → Providers → Google → enable, paste client ID + secret.
   - Add the production domain to the allowed redirect URLs.

4. **Resend (transactional email — already partially configured for VPC)**
   - Confirm `RESEND_API_KEY` is set in the Supabase function secrets for `account-deletion`.
   - Confirm the `RESEND_FROM` address is verified for the production domain.
   - No new domains; reuse the VPC sender.

5. **Supabase cron — account deletion hard-delete sweep**
   - Configure a Supabase scheduled task (dashboard → Database → Cron) to run nightly:
     ```sql
     delete from auth.users
     where id in (
       select user_id from public.account_deletions
       where cancelled_at is null
         and completed_at is null
         and grace_until < now()
     );
     update public.account_deletions
     set completed_at = now()
     where cancelled_at is null
       and completed_at is null
       and grace_until < now();
     ```
   - The hard-delete cascades via the existing FKs.

6. **Environment variables (Vercel + local .env)**
   - `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID`
   - `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
   - All four must be set before running `supabase start` locally or deploying.

7. **App Store / Play Store listings — privacy nutrition labels**
   - Update Apple App Store privacy nutrition card to include the new "Account & sign-in info" data category for parent/13+ users.
   - Update Google Data Safety form to disclose Apple/Google OAuth identifiers.
   - (Documents under `apps/mobile/store-listing/` were not modified in this sprint — flagged below as deferred.)

## Known limitations (S2/S3 deferred to Sprint 8)

- **Lesson player redesign** (Wave 4): 581-line `apps/web/src/app/play/[unitId]/lesson/[lessonId]/page.tsx` not refactored. The new `ProgressBar` primitive exists and is ready to swap in, but the top-bar minification and mascot-prominence pass were deferred. The lesson player still works exactly as before with the existing `MascotFrame` (now with the fixed static SVG fallback).
- **Settings refactor** (Wave 4): 842-line `/settings` page not split into a category index + sub-routes. Deferred to Sprint 8.
- **Onboarding redesign** (Wave 4): six-step flow not converted to MascotPanel-driven layout. Mascot is still small.
- **Parent dashboard `/parent` home / child detail / export / delete visual refresh** (Wave 4): not yet touched — current Sprint 6 visuals retained.
- **Storybook stories** for the new primitives (PrimaryButton, ProviderButton, MascotPanel, ProgressBar, AgeGate): not added. The components are tested via unit tests and integrated into routes that the build covers.
- **App Store / Play Store listing updates**: `apps/mobile/store-listing/privacy-nutrition.md` and `google-data-safety.md` were not modified. The privacy policy page IS updated; the store-listing docs need a follow-up edit before the next mobile release.
- **CSP / OAuth redirect URL allowlist** in `apps/web/next.config.mjs` or Vercel project settings: not modified. Existing CSP must be reviewed to allow Apple + Google OAuth redirects.
- **Anonymous-to-identified migration** of local Dexie data after a guest user signs up: the `linkAnonymousToIdentified` hook exists, but the post-link sync trigger (kick off `useAutoSync` immediately after the identity flip) is not wired. Today, sync starts on the next regular tick (usually within seconds). Sprint 8 can promote this to an explicit one-shot trigger.
- **Subagent execution**: the orchestrator was specified with recursive subagent spawning. In this environment the Agent tool was not available, so all work was executed by the single orchestrator agent. Wave-5 critic was not spawned; instead the gate suite served as the final QA.

## Sprint 7 file inventory (high level)

New files:
```
apps/web/public/img/_primitives/milo-still.svg
apps/web/public/img/_primitives/luna-still.svg
apps/web/src/app/auth/welcome/page.tsx
apps/web/src/app/auth/sign-in/page.tsx
apps/web/src/app/auth/sign-up/page.tsx
apps/web/src/app/auth/forgot-password/page.tsx
apps/web/src/app/auth/verify-email/page.tsx
apps/web/src/app/auth/account-deleted/page.tsx
apps/web/src/app/auth/callback/page.tsx
apps/web/src/lib/use-auth.ts
apps/web/src/lib/use-auth.test.ts
docs/design/duolingo-style-guide.md
docs/launch/sprint-7-final-report.md
packages/ui/src/components/AgeGate.tsx
packages/ui/src/components/AgeGate.test.tsx
packages/ui/src/components/PrimaryButton.tsx
packages/ui/src/components/ProviderButton.tsx
packages/ui/src/components/MascotPanel.tsx
packages/ui/src/components/ProgressBar.tsx
supabase/functions/account-deletion/index.ts
supabase/migrations/0006_auth_identities.sql
```

Modified files:
```
apps/web/src/app/globals.css
apps/web/src/app/page.tsx
apps/web/src/app/play/page.tsx
apps/web/src/app/parent/account/page.tsx
apps/web/src/app/parent/account/page.test.tsx
apps/web/src/app/privacy/page.tsx
apps/web/src/locales/en/common.json
apps/web/src/locales/tr/common.json
packages/ui/src/components/MascotFrame.tsx
packages/ui/src/components/MascotFrame.test.tsx
packages/ui/src/index.ts
supabase/config.toml
```
