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
