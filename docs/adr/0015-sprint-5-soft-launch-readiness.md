# ADR 0015 — Sprint 5: soft-launch readiness (marketing, FAQ, checklist, Storybook closure)

- **Status:** Accepted
- **Date:** 2026-05-20
- **Sprint:** 5 (S5-10)
- **Deciders:** Orchestrator + Safety Officer
- **Related:** ADR-0012 (Plausible + privacy v1.0), ADR-0013 (marketing assets), ADR-0014 (secrets + Sentry source maps)

## Context

Sprint 5 Wave A shipped the production-readiness backbone: VPC, Resend, Plausible (parent-only), privacy policy v1.0, Sentry, mobile build pipelines, secrets management. Wave B closes the public-facing surface: a parent landing page so prospective families can evaluate the app before installing, an FAQ so the same audience finds answers without emailing us, a soft-launch checklist so we know when we are actually ready, and a post-launch monitoring rubric. A Sprint 4 Storybook subagent hit the session limit mid-work; three component stories (MascotFrame 14-variant grid, MicButton state matrix, ParentGate cooldown flow) had to be re-attempted here.

This ADR records the choices behind those four artefacts.

## Decision

### 1. Soft-launch checklist structure

We adopted a hierarchical checklist with eight phases, totalling ~50 boxes:

1. Pre-launch infrastructure
2. Content and assets
3. Mobile native
4. Privacy and legal
5. QA
6. Communication
7. Monitoring
8. Soft launch day

Rationale:
- The eight-phase split mirrors the dependency graph. You cannot run a privacy-policy review before the privacy policy exists; you cannot upload an Android AAB before the signing keystore is generated. Walking top-to-bottom enforces the right order.
- Each item is a single concrete action, not a project. "Vercel env vars set" is one box, not eight, because the env-var list is owned by `docs/devops/secrets-management.md` — the checklist defers to that doc rather than duplicating it.
- The checklist explicitly tolerates intentionally-deferred items (e.g. Terms of Service is a Sprint 6 deliverable). Leaving a deferred box unchecked is acceptable as long as the deferral is documented; the doc instructs the launcher to write a one-line note.

We chose Markdown over a tracked GitHub issue because the checklist is reusable: future launches (next ring of testers, soft launch in a second region, App Store widescale launch) all repeat the same scaffolding with slight permutations. A doc file is easier to fork than an issue.

### 2. Marketing landing page minimalism

The marketing page is intentionally one screen of content stacked vertically, with five sections (hero, three feature cards, three-step "how it works", privacy block, final CTA) plus a footer. We rejected richer alternatives — testimonials, hero video, app-store badge carousel — because:

- We have no testimonials yet (we have not launched).
- A hero video at 1080p costs ~10 MB and would balloon the LCP budget. Parents on a school-pickup mobile connection are exactly the audience we cannot afford to bloat.
- App-store badges trigger pre-flight requests to the Apple / Google CDNs that load tracking pixels in some jurisdictions. Avoiding them is consistent with the "no third-party trackers on any page" promise that the privacy policy makes for the rest of the app.

The CSS reuses existing design tokens (`--color-surface`, `--color-primary-dark`, `--font-display`, `--font-body`). No new tokens were introduced; reviewers can audit the page using the same colour-contrast assertions as the rest of the app.

The page is marked `'use client'` only because the project's `next-intl` provider is client-side (ADR-0008). Once the provider is moved to a server-rendered messages loader (Phase 3), the page can drop the directive without copy changes.

The page does NOT load Plausible. Plausible is scoped to `/parent/*` per ADR-0012; the marketing page is a public surface that may be linked from app-store listings, blog posts, and press kits, so loading any analytics on it would silently break our promise.

### 3. FAQ content decisions

Twelve questions across three categories (parents 5, kids 3, technical 4). The split:

- **Parents (5)** — covers the questions a privacy-conscious parent asks before installing: how you protect privacy, whether mic audio leaves the device, how to delete, parental control surface, and why VPC requires email. These map 1:1 to the privacy policy sections.
- **Kids, read with a grown-up (3)** — covers the questions a child asks during onboarding: offline play, mascot choice, why there are no scores. Process-praise tone throughout ("Your brain grows whether you get it on the first try or the tenth.") so the FAQ reinforces the in-app pedagogy.
- **Technical (4)** — covers questions a power-user parent might raise: browsers, offline robustness, locale switching, support contact.

Each answer is 2-4 sentences. We rejected longer answers because the FAQ is a skim-first surface; longer answers belong in the privacy policy or in support email replies.

Locale coverage is symmetric across EN and TR — both languages ship every key. Anything answered here also lands as a docstring near the relevant code so engineers can validate that the public answer still matches the implementation (the parity check runs in `pnpm test:locale-symmetry`).

### 4. Storybook three-story closure

The Sprint 4 Storybook subagent timed out mid-work with three stories pending. We re-confirmed all three are now live and tagged `autodocs`:

- **`MascotFrame.stories.tsx`** — 14-variant grid (2 mascots × 7 reactions) + `ReducedMotion` decorator (patches `window.matchMedia` to force `prefers-reduced-motion: reduce`) + `FetchFail` decorator (intercepts `fetch('/lottie/*.json')` with a 404). The decorators restore the original `matchMedia` / `fetch` on teardown so they do not bleed into other stories.
- **`MicButton.stories.tsx`** — Idle, Listening, Processing, Disabled, Young (96px tap target), Older (72px tap target). The story file's `Meta.parameters.docs.description.component` re-asserts the safety invariant: MicButton is UI-only and never calls `getUserMedia` or constructs `MediaRecorder`.
- **`ParentGate.stories.tsx`** — Open, Attempt1Wrong, Attempt2Wrong, Cooldown (force 3 wrong attempts → 60s lockout), Solved. The Demo wrapper drives the gate programmatically via DOM queries (`aria-label="Digit 1"`, `aria-label="Submit answer"`) rather than the React-internal API; this keeps the story honest about the public interface.

Total stories in `@e4k/ui` after closure: 10 component story files (`EncouragementBanner`, `MascotFrame`, `MicButton`, `ParentGate`, `ProgressDots`, `StarReveal`, `TapCard`, `ToggleRow`, `TopBar`, `VolumeSlider`). All ten render under `pnpm --filter @e4k/ui storybook` and pass axe-core checks via the `a11y.config.rules` block declared per story.

### 5. Post-launch monitoring SLOs

The companion doc `docs/launch/post-launch-monitoring.md` records five SLOs:

| Signal | Target |
| --- | --- |
| Sentry error rate | < 0.5% of sessions |
| Resend bounce rate | < 2% |
| Plausible parent events | At least one of each within 72h |
| Supabase VPC funnel | `vpc_complete_at >= vpc_requested_at + 24h` |
| Support email latency | <= 24h reply |

These are intentionally conservative for the first soft-launch ring (10-50 families). They will tighten when we widen to the next ring; the next-ring numbers are TBD in Sprint 6.

The doc also defines rollback triggers, the strongest of which — "a user reports their child's audio reached our servers" — is treated as a P0 GDPR Art. 33 disclosure event. The 72-hour notification window is non-negotiable.

## Consequences

- The launch surface is now navigable: marketing → privacy → FAQ → onboarding → app, all linked from each other. Search engines can crawl the public side; the parent dashboard remains noindex.
- The checklist gives the team a definition of "done" for the soft launch. Anyone can run it; previously the criteria lived in chat.
- Storybook coverage matches what's shipped. Critics auditing the UI can review every state without booting the live app.
- Three places will have placeholder text until the user fills them in: privacy policy entity name, EU representative, and support email. The checklist surfaces these as explicit boxes.
- The signing key for Android and the Apple Team ID for iOS still depend on the user owning the developer accounts. The checklist documents the steps but cannot complete them autonomously.

## Alternatives considered

- **Server-component marketing page**: would drop the next-intl client cost but requires the i18n provider to migrate to a messages loader. Out of scope for Sprint 5; revisit in Phase 3.
- **Single mega-FAQ instead of categories**: easier to author but harder to skim. Categories let the parent jump directly to the question type they care about.
- **Issue-tracker checklist instead of Markdown**: rejected for fork-friendliness (next launch ring can copy the file forward).
- **Skip the post-launch monitoring doc**: rejected; without explicit SLOs, "monitoring" devolves into ad-hoc dashboard glances.

## Follow-ups

- Sprint 6: fill the three privacy placeholders, draft and publish Terms of Service, widen the launch ring.
- Sprint 6: tighten the SLOs once the first ring's baseline is known.
- Sprint 6 or later: migrate the i18n provider to a server-rendered messages loader so marketing / FAQ can drop `'use client'`.
