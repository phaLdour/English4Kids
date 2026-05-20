# Pull Request

## Summary

<!-- One or two sentences. What does this PR do and why? -->

## Sprint reference

- Sprint: <!-- e.g. Sprint 1 — Bootstrap -->
- Related issue / task: <!-- link or N/A -->

## Test plan

<!-- A bulleted checklist of how to verify this PR. Include both automated and manual steps where relevant. -->

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm validate:content` passes (if content changed)
- [ ] Manual: <!-- describe -->

## Child UX Code check

Confirm each line, or write "n/a" with a brief reason.

- [ ] **Honesty** — no dark patterns; no fake scarcity; no misleading streak/score behavior.
- [ ] **Calm** — feedback respects reduced-motion and audio-off settings; no jump-scares or loud SFX without warning.
- [ ] **Reversibility** — the child can back out of any flow without losing data or being trapped.
- [ ] **Parent visibility** — anything that changes a child's account/state is visible in the Parent Dashboard.
- [ ] **No financial coercion** — no IAP nags, no "unlock with friends," no reward gates that require external action.

## Safety check

- [ ] No `MediaRecorder` usage (see ADR 0002).
- [ ] No raw audio `Blob` is created or persisted anywhere.
- [ ] No third-party tracker / analytics script added to child-facing routes (`apps/web/src/app/(player)/**`).
- [ ] Mic audio remains entirely on-device (Web Speech default, whisper.cpp WASM opt-in).
- [ ] `safety-lint` CI job passes.

## Provenance

- [ ] If this PR adds assets under `assets/`, `apps/web/public/audio/`, or `apps/web/public/lottie/`, `PROVENANCE.md` has been updated with source, author, license, and date.
- [ ] Any new dependency uses an allowed license (CC0 / CC-BY / MIT / Apache-2.0 / BSD-2-or-3 / OFL).

## Screenshots / recordings

<!-- Attach if the PR is visual. Mark sensitive frames. -->

---

By submitting this PR, I confirm I have read `CONTRIBUTING.md` and the policy in `docs/safety/`.
