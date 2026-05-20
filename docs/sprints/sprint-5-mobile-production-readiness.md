# Sprint 5 — Mobile + Production Readiness

**Timeframe:** Weeks 9–10
**Goal:** Produce signed iOS + Android builds, harden the server-side trust boundary (anonymous gate, SMTP, secrets), and assemble the legal + store + analytics artefacts so a soft launch to ~50 invited families can happen within one week of sprint close.

## Sprint 5 Deliverables (11 items)

| # | Deliverable | Owner | Acceptance Criteria |
|---|---|---|---|
| S5-1 | iOS native build | Mobile Agent | `cap add ios` clean run, opens in Xcode 16, builds for iOS 16+ simulator + real device. App Group + capabilities configured for offline storage. TestFlight internal build uploaded. |
| S5-2 | Android native build | Mobile Agent | `cap add android` clean run, Gradle build succeeds, `targetSdk = 34` minimum. AAB uploaded to Play Console internal track. Tested on Android 9 (min) + Android 14. |
| S5-3 | **Server-side anonymous gate** | Backend Agent | RLS policy on `sync_outbox` table: anonymous users can write only when `profiles.is_anonymous = false`. Verified with two test JWTs. ADR 0007 §risk closed. (Critic Wave-1 + Wave-2 §1.2) |
| S5-4 | Real SMTP integration | Backend Agent | `email-plus` edge function calls Resend (or chosen provider). Verification email arrives ≤30s. Bounce + complaint webhooks logged. `devToken` path retained behind `EMAIL_DEV_MODE=true` env flag for local dev only. |
| S5-5 | Plausible analytics (parent only) | Frontend Agent | Plausible script loaded only on `/parent/*` routes. Custom events: `parent_login`, `export_pdf`, `delete_request`, `sync_enable`. Zero analytics on child-facing routes verified by Playwright assertion. Cookie-free, no PII. |
| S5-6 | Privacy policy v1.0 | Safety Officer + Legal-lite Agent | Covers: data collected (none from child by default), cloud sync opt-in, VPC flow, Sentry scope (errors only, scrubbed), retention (7-day grace delete), COPPA stance, contact email. Markdown + `/privacy` HTML route. Linked from parent dashboard + onboarding. |
| S5-7 | Store listing assets | Marketing Agent (NEW, light) | 8 screenshots per platform (iPhone 6.7", iPad 13", Android phone, Android tablet). Privacy nutrition label (Apple) + Data safety form (Google) drafts. Age band: 4-8. COPPA self-declaration text. App description EN + TR. |
| S5-8 | Production secrets management | DevOps Agent | All secrets moved from `.env.local` to Vercel / Supabase / Capacitor signing. No secret committed in git history (verified by `gitleaks` CI step). Rotation runbook documented. |
| S5-9 | Sentry source-map upload | DevOps Agent | Source maps uploaded on every production build via Sentry CLI. Verified: thrown error shows readable stack trace. PII scrubbing rules confirmed. |
| S5-10 | Soft launch checklist | Orchestrator | Parent landing page (EN + TR), FAQ (10 Q&A minimum), support email alias live, feedback collection mechanism. Safety Officer sign-off. |
| S5-11 | **Final QA + Safety Officer sign-off** | QA Agent + Safety Officer | Full regression on iOS device + Android device + desktop PWA + offline mode. Safety lint clean. Content validator clean. Axe-core CI green. ADR 0009 "MVP ready for soft launch." |

## Parallel Subagent Waves

**Wave A (Week 9 days 1-7, 4 paralel subagents):**
- A1: Mobile Agent → S5-1, S5-2
- A2: Backend Agent → S5-3, S5-4
- A3: Frontend Agent → S5-5
- A4: Safety Officer + Legal-lite Agent → S5-6

**Critic checkpoint: end of Week 9** — audit native build smoke tests, RLS proof, SMTP delivery proof, privacy policy completeness. Hard block on any unresolved Safety red line.

**Wave B (Week 10 days 8-12, 3 paralel subagents):**
- B1: Marketing Agent (NEW, light) → S5-7
- B2: DevOps Agent → S5-8, S5-9
- B3: Orchestrator + Safety Officer → S5-10

**Final QA + sign-off (Week 10 days 13-14, sequential):** S5-11 after Wave B.

## Sprint 5 Risks

1. **Apple/Google account ownership unresolved** — blocks S5-1, S5-2, S5-7 entirely. Surfaced as Open Question Q3; **must be answered before Sprint 5 starts**.
2. **RLS policy regressions** — tightening anonymous access can break existing useAutoSync clients. Mitigation: shadow-read policy in staging 48h before enforcing in prod; client-side gate stays as belt-and-braces.
3. **SMTP deliverability** — new sending domain hits spam folders. Mitigation: SPF + DKIM + DMARC configured Week 9 day 1; warmup with 10 test sends per day across first week.
4. **Store review rejection** — kids' category has elevated scrutiny. Mitigation: pre-flight checklist against App Store Review Guideline 1.3 (Kids) + Google Designed for Families before submission.

## Sprint 5 New Agent Roles
- **Mobile Agent** (NEW) — Capacitor native build expertise; owns iOS + Android pipelines, signing, TestFlight + Play Console.
- **Marketing Agent** (NEW, light scope) — store listing copy, screenshots, landing page. **Not** owning growth/paid acquisition.
- **Legal-lite Agent** (NEW) — drafts privacy policy v1.0 against COPPA/GDPR-K templates; pairs with Safety Officer. **Not a substitute for human legal review** before any paid launch.

## Sprint 5 Open Questions (must answer BEFORE Sprint 5 starts)

1. **Apple Developer + Google Play account ownership** — whose account, who pays $99/yr + $25 one-time, who holds signing keys?
2. **SMTP provider choice** — Resend (developer-friendly, modest free tier), Postmark (best deliverability, paid), or Supabase Auth's built-in (free but rate-limited)?
3. **Soft launch audience size + recruitment** — 10 families? 50? 200? Recruited from where?

## "Production-Ready MVP" Acceptance Criteria (end of Sprint 5)

### Demo-able state
A parent downloads the app from TestFlight or Play Internal track, opens it, picks a buddy (Milo / Luna / both), watches their child play through three units offline on a 5-year-old Android phone with no jank, hears native-quality narration, sees real illustrations, optionally enables cloud sync via parent gate + email verification, exports a PDF progress report, and reads a complete privacy policy that matches the actual data flow.

### What a parent can actually do
- Install on iOS or Android (or use PWA on desktop)
- Switch between EN and TR with full coverage
- Let their child play all 5 activity types across 3 units fully offline
- Opt-in to cloud sync (anonymous-first, then optionally verify email)
- Open parent dashboard via math gate, see child stats, word garden, streak plant
- Export child progress as JSON or PDF
- Request data deletion (7-day grace, then hard delete)
- Read privacy policy, contact support

### Still deferred (to where)
- **Units 4-12** → Sprint 6+ content authoring track
- **Premium TTS (ElevenLabs)** → indefinite; reassess only if Piper feedback materially negative
- **Suno music generation** → indefinite
- **B2B / teacher mode** → Milestone M2 (post-soft-launch)
- **Custom domain + public marketing launch** → Milestone M2
- **Multi-child profiles** → Sprint 6 if soft-launch feedback demands
- **iPad/Tablet-specific layouts beyond responsive** → Sprint 6

## Honest Scope Reality Check

Sprint 4-5 introduces **three new agent types** (Illustrator, Mobile, Marketing-light) plus the **highest-risk surfaces** so far (native builds, real money/account dependencies, legal artefacts).

**Forecast:**
- Sprint 4 as scoped is **achievable but tight**. Realistic risk is S4-2 (120 SVGs in one wave). Likely slip: Unit 3 illustrations to Sprint 5 Wave A.
- Sprint 5 has a **hard dependency cliff** on Apple/Google account ownership + SMTP provider. If unanswered by Week 8 day 5, Sprint 5 starts late and soft launch slips 1-2 weeks.

### Items most likely to slip to Sprint 6
- S5-5 Plausible analytics (nice-to-have)
- S5-7 store listing TR translation (subset)
- S5-10 marketing landing page polish (shippable at "functional" not "beautiful")

### Items that absolutely cannot slip (red-line MVP gates)
- S4-1 Piper narration (without it: silent app)
- S4-4 Performance (without it: Lighthouse rejects PWA install on weak phones)
- S5-3 server-side anonymous gate (without it: cloud sync = privacy liability)
- S5-6 privacy policy (without it: store rejection)
- S5-11 safety sign-off (non-negotiable per project constitution)
