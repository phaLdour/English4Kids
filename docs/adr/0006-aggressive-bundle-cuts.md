# ADR 0006 — Aggressive MVP bundle cuts (Critic-driven)

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Critic Wave-1, Product Architect, Audio Director, Pedagogy Lead, user
- **Supersedes:** —

## Context

Critic Wave-1 added up the projected payload for the originally-scoped MVP:

| Item | Projected size |
|---|---|
| whisper.cpp WASM (base) | ~40 MB |
| Piper TTS runtime + voices | ~30 MB |
| CMU pronouncing dict | ~3 MB |
| Two mascot Lottie sets (Milo + Luna, idle / happy / sad / cheer) | ~6 MB |
| 5 original songs (opus + mp3 fallback) | ~20 MB |
| Narration (pre-rendered) | ~10 MB |
| Lottie celebrations + UI | ~4 MB |
| Fonts, code, images | ~10 MB |
| **Total projected** | **~100–140 MB** |

On entry-class Android (2019, 2 GB RAM, Chromium, 4G/3G mixed connectivity) this is a non-starter. It would either fail to install as a PWA, OOM on first load, or take minutes to download.

Critic recommendation: cut hard, then re-evaluate in Phase 2 when we have real user data.

## Decision

For the MVP, we apply the following cuts:

| Cut | What we lose | What we save |
|---|---|---|
| **Drop runtime Piper TTS.** Use only **build-time pre-rendered Piper narration** stored as opus + mp3. | Dynamic TTS for arbitrary words (we'll use Web Speech API as fallback for dynamic playback). | ~25 MB runtime payload. |
| **Drop runtime g2p + CMU dict.** Ship a **build-time precomputed phoneme JSON** (~30 KB) for the MVP vocabulary. | Generic pronunciation scoring for out-of-vocab words. We don't need that at MVP. | ~3 MB. |
| **One mascot (Milo) only.** Luna deferred to Phase 2. | Per-child mascot selection. | ~3 MB Lottie + voice assets. |
| **Lottie 2 MB total cap.** | Some envisioned celebration animations. | Predictable budget. |
| **whisper.cpp WASM is parent-opt-in**, not in the default bundle. | Offline STT by default (Web Speech is the default). | ~40 MB until opted-in. |
| **3 original songs**, not 5. | 2 songs deferred to Phase 2. | ~8 MB. |

### Resulting MVP budget (target)

| Stage | Target |
|---|---|
| First load (PWA install) | **≤ 25 MB initial** |
| Per-unit lazy precache | **≤ 8 MB per unit** |
| Parent-opt-in whisper download | **40 MB** (one-time, cached in IndexedDB) |

### Enforcement

- A `size-limit` check (Sprint 4) will be added to CI that fails the build if the production bundle for `/play/*` exceeds 25 MB.
- `pnpm analyze` will surface per-route bundle sizes locally.

## Consequences

**Positive**

- Realistic chance of installing on a low-end Android in under 60 seconds on 4G.
- Forces clarity about what is core (Milo, narration, garden, three songs) vs. polish (Luna, runtime TTS, more songs).
- Whisper-opt-in pattern is itself a privacy positive — parents who care choose the more private path knowingly.

**Negative / Risks**

- Single mascot is less personal; some kids may not connect with Milo. Mitigation: Luna in Phase 2; mascot personality is strong.
- Build-time narration means every new vocab item requires a build step. Acceptable for our content cadence.
- No runtime g2p means we cannot score made-up or off-list words. Acceptable — we score the curriculum.

## Verification

- After Sprint 1 scaffold, capture baseline route sizes with `pnpm analyze`.
- After Sprint 3, measure actual install size on a low-end Android target. If we are over budget, the first cut is BGM compression (192 → 128 kbps opus).

## Alternatives Rejected

| Option | Why rejected |
|---|---|
| Keep everything; rely on lazy loading | Cumulative download still too large; PWA install size matters even with lazy chunks. |
| Server-side TTS | Conflicts with on-device-only stance (ADR 0002 lets us narrow this, but Piper-runtime on-device is the real cost driver). |
| Sprite-sheet replacement for Lottie | Loses the animation quality kids respond to; revisit if Lottie budget keeps creeping. |
