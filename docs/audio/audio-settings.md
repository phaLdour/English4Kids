# Audio Settings (player + Parent Panel)

## Settings exposed to the **child** (in-activity, top bar)

| Toggle | Default | Notes |
|---|---|---|
| Master volume slider | 80% | Persisted per device. |
| BGM on/off | on | One-tap mute icon. |
| SFX on/off | on | |
| Captions on/off | on (ages 6–8) / off (9–12) | Auto-set by age band on first run. |

## Settings exposed to the **parent** (Parent Panel, behind math gate)

| Setting | Default | Notes |
|---|---|---|
| Mic globally enabled | off (until consented) | First Speak It! attempt shows a disclosure modal; parent confirms via math gate. |
| Speech engine | Web Speech (browser) | Toggle to "Offline (whisper.cpp WASM, 40 MB download)". |
| Pronunciation strictness | Gentle (6–8) / Standard (9–12) | Three positions: Gentle / Standard / Stricter. |
| Push-to-talk vs continuous | Push-to-talk | Continuous available for 9–12 only. |
| BGM permitted | on | Some parents/classrooms prefer silence. |
| Reduce motion | matches OS preference | Forces minimal animation, no Lottie. |
| Increase text size | matches OS preference | Bumps body to Lexend at the next size. |
| Daily play time limit | none | Soft cap — banner appears at limit; never hard-locks mid-activity. |
| Reset progress | confirm dialog | Clears Dexie; if Phase 2 sync is on, also clears Supabase. |
| Export progress (CSV) | n/a (Phase 2) | |

## Persistence

- Child-facing toggles: per-device, stored in `localStorage`.
- Parent-controlled toggles: in Dexie, mirrored to Supabase when sync activates (Phase 2).
- Sensitive toggles (mic enabled, speech engine, strictness) are gated behind the math challenge every time they are *changed*, not every time they are viewed.

## Defaults rationale

- BGM/SFX/Captions defaults err toward **calm + accessible**.
- Mic defaults to **off** because the parent must consent before audio is ever captured (even on-device).
- Reduce motion and text size honor the OS so we don't override system accessibility.

## OS-level cues we honor

- `prefers-reduced-motion: reduce` → Lottie disabled, Motion transitions cut to opacity-only.
- `prefers-color-scheme: dark` → dim theme variant (warmer than typical "dark mode" so it stays kid-friendly).
- `prefers-contrast: more` → bumps token contrast variants.
