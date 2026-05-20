# ADR-0012 — Sprint 5: Plausible (parent-only) and Privacy Policy v1.0

Status: Accepted
Date: 2026-05-20
Sprint: 5 (S5-5 + S5-6)
Owner: Frontend Agent + Safety/Legal-lite Agent

## Context

Sprint 5 ships the first production-grade privacy posture for English4Kids. Two pieces had been planned in every prior sprint but never actually executed:

- **Plausible analytics** had been documented as "parent-dashboard-only, deferred to Phase 2" in ADR-0001/0007 and in `docs/safety/coppa-gdpr-k.md`, but no code instrumented it. Critic Wave-3 would have flagged the gap before any public launch.
- **Privacy policy v1.0** — the Sprint 3 page reflects MVP-only state (no cloud sync, no email, no error reporting, no analytics) but Phase 2 shipped all of those plus the 7-day grace delete and the COPPA self-certification statements for the app stores.

We bundle the two deliverables because they share the same compliance scope: parent-only telemetry plus transparent disclosure.

## Decision

### Plausible architecture

1. **Loader as a client component.** `apps/web/src/components/PlausibleScript.tsx` renders `<Script src="https://plausible.io/js/script.tagged-events.js" data-domain={domain} strategy="afterInteractive" defer />`, gated on `process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Until the user creates a Plausible account and sets the env var, the component returns `null` and no tracking traffic ships.

2. **Mounted exclusively from `apps/web/src/app/parent/layout.tsx`.** The script renders at the top of the parent layout, OUTSIDE the math-gate conditional, so the gate itself is counted as parent traffic.

3. **`tagged-events` variant.** Lets us declare custom events via `className="plausible-event-name=<name>"` on buttons (declarative path). A thin `track()` wrapper in `apps/web/src/lib/plausible-events.ts` handles the programmatic path for events that fire after a successful async action (e.g. VPC confirmations).

4. **Event vocabulary (Sprint 5):**
   - `parent_vpc_request` (declarative) — Send confirmation email button
   - `parent_vpc_first_confirm` (programmatic) — first confirmation accepted
   - `parent_vpc_complete` (programmatic) — second confirmation succeeded
   - `parent_export` (declarative) — JSON export downloaded
   - `parent_delete_request` (declarative) — 7-day deletion scheduled
   - `parent_mic_enable` (programmatic, ON-only) — microphone toggle ON
   - `parent_sync_enable` — reserved name for a future explicit sync toggle (no UI in Sprint 5; sync auto-activates after `parent_vpc_complete`)

5. **Child-route isolation enforced by E2E.** `tests/e2e/plausible-child-isolation.spec.ts` navigates to every child-facing route (`/play`, `/play/[unitId]`, `/play/[unitId]/lesson/[lessonId]`, `/garden`, `/onboarding`) and asserts that no `<script src="*plausible*">` tag exists and no request hits `plausible.io`. The positive-path test on `/parent` is skipped when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` isn't set in the test environment.

6. **CSP coordination.** The current global CSP in `apps/web/next.config.ts` restricts `script-src` and `connect-src` to `'self'` plus Supabase. When the user enables Plausible, a sibling subagent owns the route-scoped CSP carve-out for `/parent/*` so `https://plausible.io` is allowlisted only on parent URLs.

### Privacy policy v1.0 content map

Section structure (11 numbered sections plus the kid summary and change log):

1. **Data Controller** — placeholders for the user to fill in the legal entity name, EU representative name, and support email.
2. **What We Collect** — data inventory table covering display name, age band, progress, pronunciation score, audit events, parent email (post-VPC only), parent password hash, settings, IP address, and the explicit "raw microphone audio NEVER STORED, NEVER TRANSMITTED" row.
3. **Microphone Policy** — parent gate, persistent red-dot indicator, on-device STT, numeric-score-only network transit, 30-minute auto-disable, global kill-switch.
4. **Cloud Sync & Email Verification** — anonymous-first default, email-plus VPC with 24h server-enforced delay, three-layer anonymous-first gate, EU data residency.
5. **Email** — Resend as transactional provider, no marketing, deletion on request.
6. **Error Logging** — Sentry errors-only, PII scrubbed at SDK level, DSN-gated (SDK doesn't load if DSN unset).
7. **Parent Dashboard Analytics** — Plausible cookieless, parent-only, no cross-site tracking, EU-hosted.
8. **Cookies & Storage** — IndexedDB for game state, localStorage for hints, no cookies on child pages.
9. **Your Rights** — COPPA + GDPR Art. 8 + UK AADC rights with self-serve and DSAR endpoints.
10. **Data Retention** — 18-month anonymous inactivity purge, 90-day audit, 7-day VPC token, 30-day IP, 7-day grace delete.
11. **Contact** — placeholder for support email.
12. **Change Log** — v1.0 production / v0.x Sprint 3 draft.

A new `apps/web/src/lib/privacy-version.ts` exposes `PRIVACY_VERSION = '1.0'` and `PRIVACY_EFFECTIVE_DATE = '2026-05-20'`, displayed in the page header and asserted by the E2E test.

### TR section-title localization

The body of the policy stays in English under the Sprint 5 policy: legal text must be reviewed by a native Turkish speaker (the user) before any TR translation goes live. We add **section-title keys only** under a new `privacy.section.*` namespace in both `en/common.json` and `tr/common.json`, plus `privacy.title`, `privacy.kidSummary`, and `privacy.banner.translationPending`. The existing `privacy.translationPending` banner stays in place via `apps/web/src/app/privacy/translation-notice.tsx`. Sprint 6 will pick up the full TR body translation once the user reviews.

### COPPA self-certification

`apps/mobile/store-listing/coppa-checklist.md` now carries the six drop-in statements the user pastes into the App Store Connect / Play Console privacy questionnaires, plus a supplementary-facts section listing every third-party processor (Supabase, Resend, Sentry, Plausible) with its purpose and region.

## Alternatives considered

- **Self-host Plausible.** Rejected for Sprint 5: increases ops surface and bills with no user-facing benefit. Plausible Cloud is EU-hosted and cookieless, which satisfies the safety posture. Self-hosting can be revisited if a future regulator requires it.
- **Defer Plausible to Sprint 6.** Rejected because the privacy policy v1.0 has to disclose either way; doing both together avoids a policy revision a sprint later.
- **Add CSP carve-out for Plausible globally.** Rejected on principle — child pages must remain tracker-free, including in the CSP. The route-scoped header override is the only acceptable path.
- **Translate the full privacy policy body to TR now.** Rejected: legal text translated by an LLM without native review is a reputational and regulatory risk. Section titles + kid summary + banner is the safe compromise; the full body translation is on the user's review queue.

## Consequences

### Positive

- Critic Wave-3's Plausible gap is closed; the codebase is Plausible-ready and the user can activate it by setting one env var and adding the domain to a Plausible account.
- The privacy policy now accurately reflects every shipping data flow, removing the legal exposure of the v0.x draft.
- App-store submissions can proceed against the COPPA checklist without further legal drafting.

### Negative / follow-up

- The CSP carve-out for `/parent/*` is owned by the sibling middleware subagent and must land before the user enables Plausible in production. Until then the script will be blocked by CSP even if the env var is set.
- The full TR privacy translation is queued for Sprint 6 user review.
- The privacy policy contains three placeholders (legal entity, EU representative, support email) that the user must fill in before the first production deploy.

## User actions to close Sprint 5 S5-5 + S5-6

1. **Create a Plausible Cloud account** at https://plausible.io and add the production domain (`english4-kids.vercel.app` or the final brand domain) as a site.
2. **Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`** in the Vercel environment to that domain. On the next build, `PlausibleScript` will activate on `/parent/*` routes only.
3. **Fill in the privacy policy placeholders** in `apps/web/src/app/privacy/page.tsx`:
   - `[LEGAL ENTITY NAME — to be filled in before launch]`
   - `[EU REPRESENTATIVE NAME — to be filled in]`
   - `[SUPPORT EMAIL — to be filled in]`
4. **Fill in the COPPA checklist placeholders** in `apps/mobile/store-listing/coppa-checklist.md`.
5. **Review the TR section titles and kid summary** in `apps/web/src/locales/tr/common.json` under `privacy.*` for tone (formal "siz" for parent content).
6. **Confirm with the sibling middleware subagent** that the CSP carve-out for `/parent/*` is in place before flipping the env var in production.
