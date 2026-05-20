# Sprint 2 — Unit 1 + first activities

**Goal:** Real content for Unit 1 (Greetings), the two tap-based activities (Listen & Tap, Word Builder), the in-activity Settings Panel, the onboarding flow, and Song #1 ("Hello Friend").

## Scope

### Content

- [ ] `content/units/unit-01.json` — full Unit 1: 4 lessons, ~24 vocabulary items, story stub, song reference.
- [ ] `content/phonemes/unit-01.json` — generated from the build-time CMU pass; committed to repo.
- [ ] `packages/content-schema` — Zod schemas finalised; `validate:content` runs banned-phrasing lint.

### Activity components

- [ ] **Listen & Tap** activity (`apps/web/src/app/(player)/activities/listen-tap/`).
  - Plays narration, shows 4 image options, child taps the match.
  - Wrong tap: shake + `fx.gentleHmm` + `vo.milo.encourage.tryAgain` + replay narration.
  - Correct tap: bounce + `fx.correctBell` + advance.
- [ ] **Word Builder** activity (`apps/web/src/app/(player)/activities/word-builder/`).
  - Drag-and-drop letters into slots.
  - Snap-on-near (24 px radius — see design-tokens).
  - Letter audio plays on pickup; word audio plays on completion.

### Settings Panel

- [ ] In-activity overlay reachable from the player top bar.
- [ ] Child-facing toggles (volume, BGM, SFX, captions).
- [ ] Math-gate before any parent-only toggle is shown.
- [ ] All toggles defined in `docs/audio/audio-settings.md` and `docs/safety/microphone-policy.md`.

### Onboarding flow

- [ ] First-run wizard: child picks an age band (6–8 / 9–12), Milo says hello.
- [ ] No name collected. No email collected.
- [ ] Sets the `age-band-young | age-band-older` class on `<html>`.
- [ ] Persisted in Dexie.

### Audio pipeline (build-time)

- [ ] `scripts/build-narration.mjs` — runs Piper over every narration entry in Unit 1.
- [ ] `scripts/build-sfx.mjs` — generates the jsfxr SFX sprite + JSON index.
- [ ] Outputs land under `apps/web/public/audio/`.
- [ ] `PROVENANCE.md` updated by the script (or fails the build).

### Song #1

- [ ] "Hello Friend" composed, mastered to -14 LUFS.
- [ ] Encoded as opus + mp3.
- [ ] Wired into a placeholder Sing Along entry (full Sing Along activity ships in Sprint 3).

## Acceptance criteria

1. A child can launch the app, complete onboarding, play through Unit 1 / Lesson 1 / Activity 1 (Listen & Tap) and Activity 2 (Word Builder), and earn stars.
2. The Settings Panel works; toggling SFX off mutes SFX immediately mid-activity without breaking narration.
3. The math-gate prevents reaching the parent-only toggles.
4. `pnpm validate:content` passes for `unit-01.json`.
5. Bundle for `/play/*` is under the soft 12 MB target (we have 13 MB of headroom against the 25 MB hard cap for later sprints).
6. Lighthouse PWA audit ≥ 90 on the player route.

## Out of scope (Sprint 3)

- Speak It! activity (mic).
- Story Time activity.
- Sing Along full UX (lyric karaoke).
- Word Garden visualisation.
- Streak feature.
- Parent Dashboard.
- whisper.cpp WASM.
- Offline / PWA precache of secondary units.
