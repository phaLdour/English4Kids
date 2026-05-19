# Voice Strategy

## MVP scope

- **One mascot: Milo** (en-US, warm friendly child-adjacent voice, pitch slightly raised over the base Piper model).
- **Luna deferred** to Phase 2 (en-GB).
- All Milo narration is **pre-rendered at build time** via Piper TTS and shipped as opus + mp3 fallback under `apps/web/public/audio/vo/milo/`.
- **No runtime Piper** in the bundle (ADR 0006). Dynamic playback for arbitrary words (e.g., the Word Reader micro-feature) uses **Web Speech API `speechSynthesis`** with the user's installed system voice; we surface a "voice quality may vary" tooltip.
- Captions are generated alongside narration at build time and shipped as JSON.

## Build pipeline

A `scripts/build-narration.mjs` task (Sprint 2) iterates over every `narration` entry in `content/units/*.json`:

1. Run Piper with the chosen Milo voice model.
2. Capture word-level timings via the Piper alignment output.
3. Apply -16 LUFS normalisation (ffmpeg loudnorm).
4. Encode to opus (~48 kbps VBR) + mp3 fallback (128 kbps).
5. Write the audio files + a captions JSON next to them.
6. Update the audio map's Asset Catalog with hashes for cache busting.

Narration is regenerated whenever the source text changes (CI guards against drift).

## Voice qualities (target)

- Warm, slightly playful, never patronising.
- Pace ~140 wpm (slower than adult-adult speech; matches age-6 listening comprehension).
- Sentences ≤ 12 words.
- Pitch curve: rising on questions, falling-gentle on affirmations, never sing-song-mocking.

## Localisation

Wired via `next-intl` but unused at MVP. When localisation activates, each locale gets its own mascot voice asset folder (e.g. `audio/vo/milo-es-MX/`).

## Why not Web Speech as default?

- Inconsistent voice quality across browsers/OSes — kids' attachment to a mascot persona requires a *consistent* voice.
- No control over pacing or affect.
- It's our fallback for dynamic playback only.

## Why pre-render and not runtime Piper WASM?

- Runtime Piper costs ~25 MB of bundle and complicates the audio engine. ADR 0006 cuts it. Pre-rendered audio is smaller per-utterance and trivially cacheable in Serwist.
