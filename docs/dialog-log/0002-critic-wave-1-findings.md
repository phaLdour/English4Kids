# Dialog Log 0002 — Critic Wave-1 findings

The Critic agent's job is to adversarially review the Wave-1 outputs and surface issues at a severity level. Findings are graded:

- **S0** — ship-blocker; cannot proceed without resolution.
- **S1** — significant; should be resolved before Sprint 2.
- **S2** — minor; track and revisit.

This log captures the S0 and S1 findings and the user's decision on each.

## S0 findings

### S0-1 — Schema/Pedagogy mismatch on spaced repetition

> Critic: "Pedagogy Lead specified Leitner. The data model in the Product Architect draft has SM-2 columns (`ease`, `interval`, `repetitions`). One of these is wrong; we cannot ship both."

**Resolution:** User chose **Leitner**. The data model is rewritten with `box (1..5)`, `lastReviewed`, `nextDue`, `consecutiveCorrect`. ADR 0004 is the canonical reference. Property tests added in `packages/game-engine` to verify box bounds.

### S0-2 — Bundle payload would brick low-end Android

> Critic: "Sum of whisper + Piper runtime + CMU dict + two mascots + 5 songs + narration + Lottie projects to 100–140 MB. On a 2 GB-RAM 2019 Android this either OOMs at decode or takes 5+ minutes on 4G. PWA install will refuse over a certain quota in some browsers."

**Resolution:** User accepted **all cuts** proposed by Critic:

- Drop runtime Piper.
- Drop runtime g2p; precompute phoneme JSON at build.
- One mascot (Milo) at MVP.
- Lottie 2 MB cap.
- whisper.cpp WASM as parent-opt-in.
- 3 songs (not 5).

Captured in ADR 0006. New target: ≤ 25 MB initial + ≤ 8 MB per cached unit.

### S0-3 — Chrome Web Speech API routes audio to Google's cloud

> Critic: "Pedagogy and Audio Director assumed Web Speech is fully on-device. In Chrome it is not — Chrome routes audio to a Google service for transcription, transparently. If we ship Web Speech as the default and call it 'on-device,' we will mislead parents."

**Resolution:** User accepted **hybrid**:

- Web Speech as default, with **explicit disclosure** in the parent gate's mic modal ("In Chrome, your child's voice is processed by Google's speech engine in the browser. We never send the audio ourselves.")
- whisper.cpp WASM as an opt-in offline mode (40 MB).
- ADR 0002 documents the contract.

## S1 findings

### S1-1 — Email-plus-VPC at MVP creates an onboarding cliff

> Critic: "If the parent dashboard requires verifiable parental consent before any progress is shown, parents will bounce. Yet COPPA needs VPC if we have actual knowledge we are dealing with under-13 users and we collect anything beyond a session cookie."

**Resolution:** **Math-gate-only at MVP, no email collected, no sync to Supabase active.** Because we collect nothing personally identifying, the COPPA "actual knowledge" trigger does not require VPC. Email-plus-VPC ships in Phase 2 when sync activates. ADRs 0002 and 0003 reflect this.

### S1-2 — Gamification ladder risks an implicit comparison frame

> Critic: "XP + levels + badges + leaderboards is the standard ladder. For ages 6–12 in a learning context, these create comparison ('Why am I level 3 when my friend is level 7?'), which Pedagogy Lead's own red lines forbid."

**Resolution:** Stars + Word Garden + Streak only. XP/levels/badges/leaderboards **deferred**, with a strong default to "don't add them in Phase 2 either."

### S1-3 — 5 original songs is unrealistic for a solo MVP

> Critic: "Composing, recording, mixing, mastering, and rights-clearing 5 original songs is a multi-week effort. The MVP timeline cannot absorb it."

**Resolution:** Reduced to 3 songs (one per Unit 1–3). Songs 4 and 5 deferred.

### S1-4 — Two mascots double the asset and personality surface

> Critic: "Luna doubles voice records, Lottie sets, dialog branches, captions. The user value of mascot choice does not justify the cost at MVP."

**Resolution:** One mascot (Milo). Luna deferred.

### S1-5 — Runtime g2p + CMU dict has no MVP justification

> Critic: "CMU dict (~3 MB) and a runtime g2p library only earn their cost if we score out-of-curriculum words. We don't. Precompute the phoneme JSON at build time."

**Resolution:** Accepted. ~30 KB build-time phoneme JSON, no runtime g2p. See ADR 0006.

## S2 findings (tracked, not blocking)

- Plausible self-hosted analytics on marketing pages — to be re-evaluated when marketing pages exist.
- Whether to publish OG images for shared lesson links — privacy-positive but adds tooling.
- A "freeze day" UI for streaks needs careful copy so it doesn't read as a failure.

## Process notes

The Critic agent was constrained to read all four Wave-1 outputs but not to write any other artifact. Its output is preserved here verbatim-in-spirit (paraphrased to keep this doc concise). Future critics should follow the same severity grading.
