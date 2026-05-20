# Sprint 4 — Real Assets + Performance + Polish

**Timeframe:** Weeks 7–8 (2 sprints × 2 weeks)
**Goal:** Replace every placeholder (audio, image, locale string) with production-grade content. Drive Lighthouse Performance ≥ 90 on a mid-tier phone. Lock down Phase 2 components with Storybook + E2E coverage so Sprint 5 mobile work has a stable foundation.

## Critic Wave-2 S0 Blockers (must close FIRST, before Sprint 4 Wave A)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| C2-S0-1 | S0 | WordBuilder cannot render sentence chunks (u3.l4 will crash) | Add `variant: 'sentence_chunks'` to schema; branch renderer in `WordBuilder.tsx` to use word-level slots when `letterPool` contains multi-char tokens. Block u3.l4 in CI until passing. |
| C2-S0-2 | S0 | VPC client never calls `auth.updateUser({email})` — profile flips `is_anonymous=false` but auth.users.email stays null (half-baked account) | In `parent/account/page.tsx:onConfirmSecond` after `'upgraded'` status, call `getSupabase().auth.updateUser({ email })`. Display Supabase verification step as Step 4. Add E2E. |

These must be hot-fixed in Sprint 4 Wave 0 (day 1–2) before any new work.

## Sprint 4 Deliverables (10 items)

| # | Deliverable | Owner | Acceptance Criteria |
|---|---|---|---|
| **S4-0** | **Critic Wave-2 S0 hotfixes** | Frontend + Backend Lead | C2-S0-1 + C2-S0-2 both closed; E2E for both green. Sprint 4 Wave A does NOT start until this is merged. |
| S4-1 | Piper narration corpus | Audio Pipeline Agent | ~290 asset IDs (Unit 1+2+3) rendered as 48kbps Opus + 64kbps MP3 fallback. Each ≤60KB. SHA-256 hash manifest matches on-disk. Spot-check 20 clips: pronunciation correct, no clipping, silence trimmed ≤200ms. |
| S4-2 | SVG illustration set | Illustrator Agent (NEW) | One SVG per `imageConceptId` (~120 concepts). Style guide locked: rounded shapes, 6-color palette, no realistic faces, no scary/violent imagery, inclusive skin tones. ≤8KB gzipped each. Under `/public/img/<unit>/<concept>.svg`. |
| S4-3 | Whisper.cpp tiny.en bundle | STT Agent | `tiny.en.bin` (~39MB) via Git LFS. Lazy-loaded only on first Speak It! use per session. Excluded from initial PWA precache. Loading copy in EN + TR. |
| S4-4 | Performance audit + optimization | Perf Agent | Lighthouse mobile (Moto G Power profile): Performance ≥90, A11y ≥95, Best Practices ≥95. LCP ≤2.5s, INP ≤200ms, CLS ≤0.05. Bundle analyzer report in PR. Main-route JS ≤180KB gzipped. **Dynamic-import Sentry SDK behind DSN gate** (Critic Wave-2 §4.4). |
| S4-5 | Full TR localization | Locale Agent | All EN string literals across `/src` extracted to i18n keys. Symmetric EN/TR (~280 keys target). Pluralization + interpolation tested. **Critic Wave-2 §1.4: gate language picker to "EN only" if TR coverage <90% at sprint end.** |
| S4-6 | Storybook Phase 2 stories | Design System Agent | Stories for MascotFrame (21 variants), MicButton (6 states), ParentGate (3 states), StreakPlant (5 stages), WordGarden (5 box states). Chromatic baseline captured. |
| S4-7 | E2E suite for Phase 2 | QA Agent | Playwright: VPC happy path (request → devToken → confirm-first → wait → confirm-second → **auth.updateUser called**), sync flush mid-session, locale switch persists across reload, mascot voice routing. Suite ≤4 min in CI. |
| S4-8 | Audio adaptive bitrate + preload tuning | Audio Pipeline Agent | SW serves Opus to supported browsers, MP3 fallback iOS Safari <17. Current unit fully precached, next unit lazy. **Add `/lottie/*.json` to SW precache (Critic Wave-2 §1.5).** Activity offline plays narration within 100ms. |
| S4-9 | Luna voice coverage parity | Audio Pipeline + Content Engineer | Either ship Luna takes for all activity-level prompts (Listen&Tap, Speak It! across Unit 1-3) OR hide Luna/Both options behind "preview" flag. CI lint compares milo/luna asset key sets per unit. (Critic Wave-2 #3) |
| S4-10 | Capacitor static export compatibility | Mobile Agent (preview) | All `/api/content/*` routes get `generateStaticParams` + `dynamic = 'force-static'` when `E4K_TARGET=mobile` so mobile build doesn't fail. ADR-0008 addendum. (Critic Wave-2 §1.7) |
| S4-11 | Image lazy-load + responsive `<picture>` | Frontend Agent | Above-the-fold SVGs inlined, below-the-fold lazy. `<picture>` srcset for HiDPI. Zero CLS on image load. |

## Parallel Subagent Waves

**Wave 0 (Sprint 4 days 1-2, sequential)**: S4-0 — Critic Wave-2 S0 hotfixes. Single subagent or 2 paralel (Frontend Lead for C2-S0-1, Backend Lead for C2-S0-2).

**Wave A (Sprint 4 days 3-9, 4 paralel subagents):**
- A1: Audio Pipeline Agent → S4-1, S4-8
- A2: Illustrator Agent (NEW) → S4-2
- A3: STT Agent → S4-3
- A4: Locale Agent → S4-5

**Critic checkpoint: end of Week 7** — audit asset quality, hash integrity, locale symmetry, LFS setup. Block Wave B until green.

**Wave B (Sprint 4 days 10-14, 4 paralel subagents):**
- B1: Perf Agent → S4-4, S4-11
- B2: Design System Agent → S4-6
- B3: QA Agent → S4-7
- B4: Audio Pipeline + Content Engineer → S4-9
- B5: Mobile Agent (preview) → S4-10

**Final Critic re-pass (Sprint 4 day 14):** all S0/S1 from Critic Wave-2 either closed or explicitly descoped via ADR addendum.

## Sprint 4 Risks

1. **Piper voice quality on edge cases** (kid names, loanwords, numbers). Mitigation: lexicon override file alongside manifest; spot-check 10 edge cases per unit.
2. **Illustration throughput** — 120 SVGs in one wave is aggressive. Mitigation: prioritize Unit 1 first (40 SVGs), then 2 + 3. **Likely slip: Unit 3 illustrations move to Sprint 5 Wave A.**
3. **LFS bandwidth/quota** — whisper model + Piper outputs may exceed free LFS allowances. Confirm Week 7 day 1; fall back to CDN-hosted external bundle if exceeded.
4. **TR native speaker review bottleneck** — if user can't review TR strings inside the sprint, locale ships marked "beta TR" with English fallback.
5. **WordBuilder schema migration ripples** — adding `variant: 'sentence_chunks'` may need content/audio-asset/unit-NN.json updates. Triple-check before merging.

## Sprint 4 New Agent Roles
- **Illustrator Agent** (NEW) — SVG generation against locked style guide. Needs user-supplied north-star reference. See Open Questions.

## Sprint 4 Open Questions (must answer BEFORE Sprint 4 starts)

1. **Illustration style direction** — which reference anchors Illustrator Agent? Options:
   - Sago Mini (vibrant, simple shapes)
   - Khan Academy Kids (rounded, friendly)
   - Lingokids (cartoonish, bold outlines)
   - Custom palette inferred from existing UI tokens
2. **TR native speaker reviewer** — user reviews personally, or external reviewer? Affects S4-5 acceptance criteria.
3. **Piper voice character selection** — `en_US-amy-medium` (current Milo) and `en_GB-jenny_dioco-medium` (current Luna) locked, or test alternative voices first?
