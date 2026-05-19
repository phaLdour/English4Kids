# SFX Palette

All SFX are short (≤ 0.6 s), mastered to **-14 LUFS-S**, true peak **-1 dBTP**, and shipped as a single opus sprite plus a JSON sprite index. The palette intentionally avoids loud transients, sub-bass, and "casino" reward cues.

## Generation

- **jsfxr-generated** SFX are scripted in `scripts/build-sfx.mjs` from seed parameters checked into the repo. Reproducible builds.
- **CC0-sourced** SFX come from Freesound CC0-only filter; archived under `LICENSES/sfx/` with a copy of the source page.
- A few SFX are **Piper + jsfxr hybrids** (e.g. a soft "hmm" from Piper layered under a jsfxr tone).

## Palette

| Asset ID | Source kind | Purpose | Duration | Notes |
|---|---|---|---|---|
| `fx.tapSoft` | jsfxr | UI tap | 0.15s | -10 dB vs other SFX |
| `fx.tapBouncy` | jsfxr | drag-drop pickup | 0.20s | rising pitch |
| `fx.dropSnap` | jsfxr | drag-drop snap-in | 0.25s | descending soft thud |
| `fx.correctBell` | jsfxr | correct answer | 0.40s | major-third bell |
| `fx.correctSparkle` | jsfxr | streak bonus | 0.55s | layered with `fx.correctBell` |
| `fx.gentleHmm` | Piper+jsfxr | wrong answer | 0.50s | warm "hmm" — never harsh |
| `fx.starPlink` | jsfxr | star awarded | 0.35s | glockenspiel-like |
| `fx.gardenGrow` | jsfxr | word garden plant grows | 0.50s | ascending arpeggio |
| `fx.unlockChime` | jsfxr | new lesson unlocked | 0.60s | warm triad |
| `fx.streakDing` | jsfxr | streak day added | 0.30s | soft single tone |
| `fx.micArm` | jsfxr | mic activates (push-to-talk down) | 0.10s | very quiet, courtesy cue |
| `fx.micDisarm` | jsfxr | mic releases | 0.10s | mirrors `fx.micArm` |
| `fx.ambBird` (optional) | CC0 sourced | park scene ambient one-shot | 0.40s | only in scene-based stories |

## Banned sound design

- No coin/jackpot "cha-ching" cues.
- No buzzer/klaxon on wrong answers.
- No screams, jump-scares, or sudden loud noises.
- No mimicking real adult voices saying single words (always Milo).

## Accessibility

- All SFX defer to narration (see ducking rules in `audio-map.md`).
- A global Settings toggle disables all SFX (BGM and narration remain).
- Captions accompany any SFX that carries information (e.g. "✔ correct" caption when `fx.correctBell` fires).
