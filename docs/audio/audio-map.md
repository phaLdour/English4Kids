# English4Kids Audio Map

The Audio Map is the canonical contract between the Audio Director, the engineers
who wire activities, and the Provenance log. Every audio asset that plays during
an activity must be listed here, must have a row in `PROVENANCE.md`, and must use
an Asset ID matching the namespace below.

## Asset ID conventions

```
<kind>.<owner>.<scope>.<name>
```

| Kind | Examples |
|---|---|
| `vo` | `vo.milo.u1.l1.tapHello`, `vo.milo.encourage.tryAgain` |
| `fx` | `fx.correctBell`, `fx.gentleHmm`, `fx.tapSoft` |
| `mus` | `mus.menuCalm01`, `mus.helloFriend` |
| `amb` | `amb.classroomLow`, `amb.parkBird` |

Scope segments: `u<n>` = unit, `l<n>` = lesson, `a<n>` = activity (optional).

## Loudness & format

- Target loudness: **-16 LUFS integrated** (music & long narration); short SFX targeted at **-14 LUFS-S**.
- True peak ceiling: **-1 dBTP**.
- Primary format: **opus** (48 kHz, VBR ~96 kbps for music, ~48 kbps for narration, ~64 kbps for SFX sprites).
- Fallback: **mp3 192 kbps** (music) / **mp3 128 kbps** (narration & SFX) for Safari < 17 and legacy WebViews.
- SFX delivered as **sprite sheets** (single opus file + JSON index) to minimise HTTP requests.

## Asset Catalog

| Asset ID | Type | Source | Duration | LUFS | License | Used In |
|---|---|---|---|---|---|---|
| `vo.milo.u1.l1.intro` | narration | Piper pre-render (build) | ~2.4s | -16 | Original-MIT | u1/l1/listen-tap |
| `vo.milo.u1.l1.tapHello` | narration | Piper pre-render (build) | ~1.2s | -16 | Original-MIT | u1/l1/listen-tap |
| `vo.milo.encourage.tryAgain` | narration | Piper pre-render (build) | ~1.0s | -16 | Original-MIT | global |
| `vo.milo.encourage.niceTry` | narration | Piper pre-render (build) | ~1.1s | -16 | Original-MIT | global |
| `fx.correctBell` | sfx | jsfxr generated | 0.4s | -14 | Original-MIT | global |
| `fx.gentleHmm` | sfx | Piper + jsfxr | 0.5s | -14 | Original-MIT | global |
| `fx.tapSoft` | sfx | jsfxr generated | 0.15s | -14 | Original-MIT | global |
| `fx.starPlink` | sfx | jsfxr generated | 0.35s | -14 | Original-MIT | celebration |
| `mus.menuCalm01` | music | MuseScore composition | 1:30 (loop) | -16 | Original-MIT | menu, onboarding |
| `mus.helloFriend` | music | MuseScore composition | 2:10 | -16 | Original-MIT | u1/l1/sing-along |

> All Sprint 1 entries are *placeholders*. Actual asset files are produced in Sprint 2 (narration) and Sprint 3 (music).

## Activities

### unit-01 / lesson-01 / activity-01 — Listen & Tap (Greetings intro)

| Slot | Asset ID | File | Trigger | Notes |
|---|---|---|---|---|
| BGM | `mus.menuCalm01` | `/audio/music/menu-calm-01.opus` | onEnter, loop | duck -6 dB during narration; pause on visibility change |
| Intro narration | `vo.milo.u1.l1.intro` | `/audio/vo/milo/u1-l1-intro.opus` | onEnter + 200 ms | captions ON by default |
| Prompt narration | `vo.milo.u1.l1.tapHello` | `/audio/vo/milo/u1-l1-tapHello.opus` | onItemShow | replays on wrong tap (max 2 replays per item) |
| SFX correct | `fx.correctBell` | sprite `#correctBell` | onCorrect | followed by `vo.milo.encourage.niceTry` at 50% chance |
| SFX wrong | `fx.gentleHmm` | sprite `#gentleHmm` | onWrong | always follow with `vo.milo.encourage.tryAgain` |
| SFX tap | `fx.tapSoft` | sprite `#tapSoft` | onTap | volume -10 dB relative to other SFX |
| Celebration | `fx.starPlink` | sprite `#starPlink` | onActivityComplete | follows by score-up animation |

### Future activities

Stubbed in subsequent sprints. Each activity gets a dedicated section with the
same eight-slot table (BGM, Intro, Prompt, Correct, Wrong, Tap, Celebration, and
any activity-specific cues).

## Ducking & focus rules

- **Narration** always wins the audio focus: BGM ducks -6 dB and SFX defer.
- **SFX** mix above BGM but never above narration.
- **Songs** in the Sing Along activity pause BGM entirely.
- On visibility change (tab hidden), all audio pauses; on resume, BGM fades back in over 400 ms.

## Captioning

Every narration asset ships with a JSON caption file (`<assetId>.captions.json`)
with per-word timings produced from the Piper alignment output. Captions render
beneath the activity scene; toggle defaults to ON for ages 6–8 and OFF for ages
9–12 (configurable in Parent Settings).
