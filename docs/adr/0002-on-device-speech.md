# ADR 0002 — On-device speech processing only

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Safety & Privacy Officer, Product Architect, Pedagogy Lead, user
- **Supersedes:** —

## Context

The "Speak It!" activity asks children (ages 6–12) to pronounce target words. Child voice data is among the most sensitive categories under COPPA (US) and GDPR-K (EU). Any cloud-side audio collection would:

- Require **verifiable parental consent** (COPPA §312.5) — operationally expensive and friction-heavy for our anonymous-first MVP.
- Trigger a Data Processing Agreement with each STT vendor; most consumer STT APIs (Google, Azure, AssemblyAI) explicitly forbid child data without an enterprise contract.
- Make us liable for retention windows, breach disclosure, and right-to-erasure compliance per child.

We refuse to take on that risk for an MVP. Speech must be processed **entirely on-device**.

## Decision

Two speech engines, both browser-side, controlled via a single `SpeechEngine` interface in `packages/audio`:

### Engine A — Web Speech API (default)

- Uses `SpeechRecognition` / `webkitSpeechRecognition` in the browser.
- Fast, zero download, available in Chrome, Edge, Safari (limited).
- **Caveat:** in Chrome, the API routes audio to Google's cloud transparently. We **must disclose** this in the Parent Guide and the in-app mic disclosure modal: *"Your child's voice is processed by your browser's speech engine. In Chrome, this means audio is sent to Google for transcription."*
- The audio bytes never touch our servers, never enter our app's memory as a Blob, and our code does not retain transcripts beyond the current attempt.

### Engine B — whisper.cpp WASM (opt-in offline)

- Bundled model: `ggml-tiny.en.bin` (~40 MB) loaded lazily into IndexedDB.
- 100% local; no network calls during inference.
- Opt-in via the **Parent Settings Panel** (behind math gate) — labelled "Offline speech mode (uses 40 MB)."
- Recommended for: privacy-conscious parents, EU users, regions with weak connectivity, school deployments.

### Hard rules (enforced by code + CI)

1. **No `MediaRecorder`** anywhere in the app. CI safety-lint greps for it and fails the build.
2. **No `Blob` containing audio** is ever constructed.
3. **No upload endpoint** accepts audio bytes. Supabase Storage has no audio bucket and the API has no audio routes.
4. **CSP `connect-src`** is allowlisted to Supabase origins only. No third-party speech vendor URLs.
5. **Phoneme reference data is pre-computed at build time** as `content/phonemes/<unit>.json` (~30 KB total for MVP vocabulary). No runtime g2p, no CMU dict fetch.
6. **Persistent visual mic indicator** (red dot in the top bar) whenever the mic is hot, even if Web Speech is silent.
7. **Push-to-talk only** for kids 6–8; toggle to continuous available for 9–12.
8. **Parent kill-switch** in Settings disables the mic globally (Speak It! falls back to a Listen & Repeat variant).

## Consequences

**Positive**

- COPPA/GDPR-K posture is dramatically simpler: we are a "no-collection" service for voice.
- Zero per-child storage costs for audio.
- Offline engine is a genuine selling point and competitive differentiator.

**Negative / Risks**

- We cannot do server-side ML scoring (e.g., wav2vec2 fine-tuned for child speech). We accept this trade-off — Critic Wave-1 explicitly validated this trade.
- Bundle size grows by 40 MB when a parent opts into whisper.cpp WASM. Mitigations: lazy download, cached in IndexedDB across sessions, only loaded on Speak It! entry, with a clear progress UI and skip option.
- Web Speech API is unavailable in Firefox; users on Firefox without opting into whisper see a "Speech is disabled in this browser" notice and the Listen & Repeat variant.
- Chrome's hidden-cloud-routing must be honestly disclosed every place we mention mic features.

## Verification

- A whisper.cpp WASM proof-of-concept on a low-end Android (target: 2019-era device, 2 GB RAM, Chromium) is required in **Sprint 3** before we promote the offline engine to production.
- Inference target: ≤ 2 s on a 1-second utterance for tiny.en on that device.

## Alternatives Rejected

| Option | Why rejected |
|---|---|
| Cloud STT (Google / Azure / AssemblyAI) | COPPA/GDPR-K friction; vendor TOS forbid child data without enterprise terms; cost. |
| Server-side wav2vec2 self-host | Same COPPA issue (we'd still be collecting audio); ops cost; latency. |
| MFA (Montreal Forced Aligner) WASM | Heavier than whisper.tiny for our use case; alignment-not-recognition. |
| Local wav2vec2 ONNX | Larger than whisper.tiny.en for similar accuracy; worse browser story today. |

## Sprint 4 Addendum (S4-3) — Bundling whisper.cpp via Git LFS

Sprint 3 stood up the loader and the UI plumbing. Sprint 4 makes the offline engine actually shippable.

### Storage — Git LFS

The tiny.en model is ~39 MB; the whisper.cpp WASM runtime is ~2-3 MB. Both are tracked in `.gitattributes`:

```
public/whisper/*.bin   filter=lfs diff=lfs merge=lfs -text
public/whisper/*.wasm  filter=lfs diff=lfs merge=lfs -text
```

This keeps regular clones small for contributors who don't need the artifacts, while CI fetches via `actions/checkout@v4` with `lfs: true`.

### Placeholder strategy + magic-byte detection

A real ~39 MB binary cannot be checked in by hand from every sandbox. We instead commit a **1 KB placeholder** at `apps/web/public/whisper/ggml-tiny.en.bin` and a 512 B placeholder at `whisper.wasm`. Each placeholder starts with the correct file-format magic (`ggml` / `\0asm`), contains the ASCII marker `PLACEHOLDER` within the first 2 KB, and is far below any plausible real model. The loader (`apps/web/src/lib/whisper-loader.ts`) detects all three conditions defensively and short-circuits to a `placeholder` status — never feeding a stub into the WASM init path.

### `whisper-loader` status machine

```
idle -> loading -> ready          (real binaries, ready to recognize)
idle -> loading -> placeholder    (placeholder binaries, fall back silently)
idle -> loading -> error          (network / CSP / WASM compile failure)
```

`placeholder` is explicitly distinct from `error`: it's the expected steady-state of a fresh clone until the bundling workflow runs.

### CI workflow — `.github/workflows/render-whisper-model.yml`

A manual `workflow_dispatch` job downloads `ggml-tiny.en.bin` from Hugging Face plus the matching `whisper.cpp` WASM runtime, verifies magic bytes + minimum size, tracks via `git lfs track`, and opens a PR titled *"chore: bundle whisper.cpp tiny.en model + WASM runtime"* against the working branch.

### Settings UI states

The Mic Engine toggle reflects the loader state: `idle` -> enabled with *"Use offline speech engine"*; `loading` -> disabled with progress bar *"Downloading speech engine... N%"*; `ready` -> enabled with *"Offline speech engine ready"* and a *"Test microphone"* button; `placeholder` -> disabled with neutral copy *"Offline engine isn't bundled in this build yet. Online engine is being used."*; `error` -> *"Couldn't load the offline engine. Online engine will be used."*

### Service Worker

`/whisper/*` is excluded from the initial precache via `next.config.ts`'s Serwist `exclude` setting. A separate runtime rule (CacheFirst, 90-day expiration, max 4 entries) populates `whisper-runtime-cache` on first opt-in fetch so subsequent loads are instant and offline-capable.

## Sprint 4 Addendum — Narration corpus, adaptive bitrate, CI gate

This addendum extends ADR-0002 with the production output side of the
audio pipeline (input-side speech recognition is unchanged). All decisions
below are consistent with the original "no cloud audio for children" rule:
narration is *output* (TTS), pre-rendered offline by maintainers, and
shipped as static assets.

### Decisions

1. **Piper as the canonical TTS engine.** Two voices: `en_US-amy-medium`
   (Milo) and `en_GB-jenny_dioco-medium` (Luna). Both MIT / CC-BY-SA per
   `PROVENANCE.md`. Rendered ahead of time, never at runtime.
2. **Build pipeline lives in `scripts/build-narration.ts`.** It is a pure-
   Node TS script that reads `content/audio-assets/unit-*.json`, walks each
   asset, and either (a) invokes Piper + ffmpeg when
   `RENDER_NARRATION=true` and `piper` is on PATH, or (b) emits a valid
   1-second silent Opus + MP3 placeholder. Path (b) is the default — the
   sandbox + most contributor laptops do not have Piper installed, and the
   placeholders are decodable audio that lets the lesson player run.
3. **Adaptive bitrate.** Each clip is shipped as both `.opus` (~3 KB
   typical) and `.mp3` (~12 KB typical). The SW serves the cached `.opus`
   sibling whenever the client advertised Opus support; otherwise the MP3
   fallback. See `apps/web/src/app/sw.ts` `adaptiveAudioHandler`.
4. **CI render workflow.** `.github/workflows/render-narration.yml` is a
   manual-trigger workflow that installs Piper, downloads both voice
   models from HuggingFace, runs the build script with
   `RENDER_NARRATION=true`, then opens a PR with the refreshed
   `apps/web/public/audio/**`. Cost: ~3-5 min compute per render.
5. **Integrity gate.** `scripts/verify-audio-manifest.ts` re-hashes every
   file referenced from `apps/web/public/audio/manifest.json` and exits
   non-zero on mismatch. Wired into `pnpm verify:audio` and the root
   `turbo.json` task list. Run on every PR.
6. **Git LFS** tracks `*.opus`, `*.mp3`, `*.bin`, `*.onnx`. Without LFS
   each re-render would dirty ~270 binary files in the repo history.
7. **Lexicon overrides** live in
   `content/audio-assets/lexicon-overrides.json` (IPA map). Piper picks
   them up via `--phoneme_id_map_path` when present. Pre-populated with
   character names (Bea, Milo, Luna, Coco, Pip), homophones (two/to/too,
   ate/eight), brand tokens (English4Kids, Owl Lavender), and kid-tricky
   words (ducklings, grandma).
8. **PWA precache extensions.** Critic Wave-2 §1.5 noted the SW did not
   precache `/lottie/*.json`. Fixed: dedicated `e4k-lottie-v1` cache with
   14-entry LRU cap (one per mascot animation file currently shipped).
   Also added `precacheUnitAudio(unitId)` — the lesson player posts a
   message to the SW on `/play/<unitId>/…` entry to warm the audio cache
   before the first prompt.

### Why this stays inside ADR-0002

Narration TTS is output-only. We are not collecting child audio; we are
pre-rendering maintainer-authored transcripts into static files. The
"no cloud STT for kids" rule is unaffected — that constraint is about
inbound audio bytes from microphones, which still runs entirely on-device
via Web Speech / whisper.cpp WASM (see prior sections).
