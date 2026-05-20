# Critic Wave-2 Findings (post-Phase 2 audit)

**Audit date:** 2026-05-20
**Scope:** Cumulative state after Sprints 1-3 (MVP) + Phase 2 wave
**Auditor:** Critic / Red Team subagent

## Summary

Critic Wave-2 identified **2 S0 (must-fix-before-Sprint-4)**, **3 S1 (Sprint-4-priority)**, and **several S2 cleanups** across the Phase 2 deliverables. The S0s are runtime crash + a half-baked COPPA email-plus implementation. The S1s are user-visible quality issues (mascot voice mismatch, mobile build break, locale half-coverage).

## S0 Issues (block Sprint 4 Wave A)

### S0-1 — WordBuilder sentence chunks crash u3.l4
**Where:** `apps/web/src/components/activities/WordBuilder.tsx:222-270` + `content/units/03-animals-and-actions/manifest.json` u3.l4 items.

**Problem:** Content Engineer's note (Sprint 4 Wave) — "WordBuilderItemSchema letterPool reused for sentence chunks in u3 lesson 3.4" — was not actioned in the renderer. The current renderer assumes `letterPool` is per-character; given multi-char tokens like `["a", "bird", "can", "fly"]` and `targetWord = "a bird can fly"` (14 chars), `slots = 14` but pool has 7 entries → index out of bounds at runtime.

**Fix:** Add `variant: 'sentence_chunks'` to schema. Branch renderer: when `letterPool` contains multi-char entries, use word-level slots (`targetWord.split(' ').length`). Block u3.l4 in CI until passing.

**Owner:** Frontend Lead + Content Engineer

### S0-2 — VPC client never calls `auth.updateUser({email})`
**Where:** `apps/web/src/app/parent/account/page.tsx:52-61` (onConfirmSecond) + `apps/web/src/lib/use-vpc-upgrade.ts:25-29` (doc-comment).

**Problem:** After `confirm-second` returns `'upgraded'`, the spec explicitly states the **client** must call `supabase.auth.updateUser({ email })` to trigger Supabase's real email-verification round trip. The page does nothing of the kind — it just `setStep('done')`. Consequence: `profiles.is_anonymous` flips to false, but `auth.users.email` stays null. Parent has no recoverable login, no password reset. **COPPA paperwork satisfied on paper, but the account is half-built.**

**Fix:** In `onConfirmSecond` after `r.status === 'upgraded'`, call `getSupabase().auth.updateUser({ email })`. Display Supabase verification step as Step 4 of the flow. Add E2E.

**Owner:** Backend / Parent Dashboard Lead

## S1 Issues (Sprint 4 priority)

### S1-1 — Luna voice coverage massively asymmetric
**Where:** `content/audio-assets/unit-01.json`, `unit-02.json`, `unit-03.json`.

**Problem:** Audio asset maps confirm: Unit 3 has 94 `vo.milo.*` keys vs 9 `vo.luna.*` (only `theQuietestAnimal` story narration). Units 1-2 have **zero** Luna assets. `resolveNarrationAsset` falls back gracefully to Milo, but consequence: selecting Luna or 'both' = Luna mascot animating with Milo voice on essentially every prompt. User-visible identity mismatch.

**Fix:** Either (a) hide Luna/Both options in settings + onboarding until parity, OR (b) record Luna takes for at least Speak-It! and Listen-Tap activity-level prompts. Add content-lint script comparing milo/luna key sets per unit.

**Owner:** Content + Audio + Frontend

### S1-2 — Capacitor static export breaks content API routes
**Where:** `apps/web/src/app/api/content/[unitId]/route.ts` and siblings.

**Problem:** `output: 'export'` (active when `E4K_TARGET=mobile`) requires static routes. None of the content API routes have `generateStaticParams`. Mobile build either fails or runs with empty lessons.

**Fix:** Add `generateStaticParams` + `dynamic = 'force-static'` to every `/api/content/*` route when `E4K_TARGET=mobile`. OR move content fetching to direct JSON imports under mobile target. ADR-0008 addendum.

**Owner:** Mobile + Backend

### S1-3 — TR locale covers only ~5% of UI surface
**Where:** `apps/web/src/locales/tr/common.json` (76 keys) vs hard-coded English strings across `app/settings/*`, `app/play/*`, `app/parent/*`, activities, garden, privacy page.

**Problem:** Switching to TR translates only onboarding. Rest of app stays in English. Worse than no TR option — suggests features that aren't there.

**Fix:** Either gate the language picker to "EN only — TR coming soon", OR thread `useTranslations` through all surfaces. Add CI check: count untranslated string literals; fail if > N.

**Owner:** Frontend Lead + Locale Agent

## S2 Cleanups (Sprint 4 nice-to-have)

- **Sentry SDK in client bundle regardless of DSN** (~50KB). Move `import * as Sentry from '@sentry/nextjs'` inside a dynamic-import guarded by `Boolean(DSN)`.
- **SW does not precache `/lottie/*.json`** — first lesson offline shows static fallback. Add Serwist rule.
- **VPC `/start` has no rate limit** — anonymous user can spam emails. Add per-parent quota or captcha.
- **VPC two-step update is non-atomic** — failure between `second_confirmed_at` write and `profiles.is_anonymous` flip leaves the profile stuck anonymous. Add reconciliation job or wrap in stored procedure.
- **Token check missing parent_id binding on confirm-first** — stolen token can jam original parent's flow. Add `parent_id = caller_id` to the WHERE clause.
- **Sentry beforeSend regex misses `display_name`, breadcrumbs, contexts**. Expand scrubber.
- **FNV-1a hash inlined in lesson player** instead of importing from `mascot-voice.ts` — drift risk.

## What's Strong (locked-in)

1. **Idempotent sync protocol** with per-op partial failure isolation — well-designed for flaky kid-device networks. Monotonic conflict policy matches ADR-0004.
2. **Audio-blob defence in depth** — `containsAudioBlob` regex + suspicious-key set is a real second-layer enforcement of the "no audio leaves device" red line.
3. **Anonymous-first client gate** correctly placed in `useAutoSync`, re-checked on every trigger.
4. **MascotFrame reduced-motion handling** skips the fetch entirely (not just CSS pause).
5. **24h email-plus delay** taken seriously (HTTP 425 too-early with `tryAgainAt`). Credible COPPA email-plus implementation once S0-2 is fixed.

## Resolution Plan

All S0 + S1 issues land in **Sprint 4** roadmap:
- S0-1 + S0-2 → S4-0 (Wave 0, day 1-2, blocks Wave A)
- S1-1 → S4-9
- S1-2 → S4-10
- S1-3 → S4-5

See `docs/sprints/sprint-4-real-assets-performance-polish.md` for full ticket layout.
