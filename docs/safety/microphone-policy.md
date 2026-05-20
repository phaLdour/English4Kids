# Microphone Policy

This is the technical and UX contract for any feature that uses the microphone. It is binding. CI enforces parts of it; the rest is reviewed manually in PR.

## UX contract

### Before the first mic activation

1. The first time a child enters a Speak It! activity, the mic is **not yet armed**.
2. Milo appears with a calm explanation: *"To play this game, we need to listen to you. A grown-up needs to say it's okay."*
3. A **Parent Gate** (math challenge — *"What is 7 + 5?"*, age-band-appropriate) appears.
4. Behind the gate, a **Mic Disclosure Modal** explains:
   - What we listen for (just the target word).
   - That the audio stays on the device.
   - In Chrome with Web Speech: that audio is processed by Google's speech engine in the browser, and we do not send it anywhere ourselves.
   - That whisper.cpp WASM (offline mode) is available and how to switch.
   - That the parent can turn the mic off again at any time.
5. The parent taps **"Allow"**. The browser's native permission prompt then fires.
6. State persisted in Dexie: `parentConsent.mic = true; parentConsent.engine = 'webspeech'|'whisper'`.

### During mic use

- **Persistent visual indicator:** a red dot in the top bar whenever the mic is open, plus a soft pulse on Milo's microphone icon.
- **Push-to-talk** by default (6–8 mandatory; 9–12 default but switchable). Holding releases the mic; lifting closes it.
- **3-attempt safeguard:** see `pronunciation-scoring.md`. After 3 attempts on one item, we auto-pass and move on.
- **No background recording.** Mic only opens during the active item.

### Disabling the mic

- A one-tap **Mic Off** affordance in the player's top bar instantly disables the mic for the session.
- A persistent **Parent Kill-Switch** in Parent Settings (math-gated) disables the mic globally. When off, Speak It! falls back to a Listen & Repeat variant (no mic needed; child taps "I said it" — honor system).

## Technical contract

These rules are enforced by `safety-lint.sh` in CI and by code review.

### Hard "no" list

- **No `new MediaRecorder(...)`** anywhere.
- **No `audio.blob`** access — we never construct or persist a Blob containing audio.
- **No `webkitSpeechRecognition` or `SpeechRecognition` instantiation outside `packages/audio`.** The audio package wraps these behind a `SpeechEngine` interface.
- **No upload endpoint accepts audio.** Supabase has no audio bucket; the API has no audio route.
- **No third-party speech vendor** in `connect-src`. Our CSP allowlist is Supabase + same-origin only.

### Engine boundary

```
packages/audio/
  src/
    speech/
      types.ts                     # SpeechEngine interface
      web-speech-engine.ts         # default; wraps webkitSpeechRecognition
      whisper-wasm-engine.ts       # opt-in; lazy-imports the WASM
      index.ts                     # exports createSpeechEngine(opts)
```

Everything outside `packages/audio` imports `createSpeechEngine` and never touches the underlying API.

### Lifecycle

1. `engine.start({ targetWord })` — opens the mic, returns a stream of partial transcripts.
2. `engine.stop()` — closes the mic.
3. `engine.dispose()` — releases the underlying recogniser.

No method returns or accepts a `Blob`, `ArrayBuffer`, or `Stream` of audio bytes. The only data crossing the boundary is **text** (transcripts) plus the **score** computed in `packages/audio/src/scoring`.

### CSP

```
default-src 'self';
connect-src 'self' https://*.supabase.co;
media-src 'self';
img-src 'self' data:;
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
worker-src 'self' blob:;
```

`worker-src blob:` is required for the whisper.cpp WASM worker; we accept this and verify the worker source is bundled, not fetched cross-origin.

### Logging

- We log **transcripts** (text) and **scores** to Dexie.
- We never log audio.
- We do **not** log transcripts to any server-side log aggregator at MVP. Phase 2 sync uploads only the aggregate score, not the transcript.

## Failure modes

| Scenario | Behavior |
|---|---|
| Browser denies mic permission | Show calm "no problem — let's try a tap activity instead" message; auto-switch to Listen & Repeat for the session. |
| Parent revokes mic in Settings | Same fallback. |
| Web Speech unavailable (Firefox) | Suggest whisper offline mode; if declined, fall back to Listen & Repeat. |
| whisper.cpp WASM model download fails | Surface a friendly error; offer to retry or to use Web Speech instead. |
| Mic stays open in background due to bug | Watchdog timer in `packages/audio` force-closes after 8 s of inactivity; reported as a safety incident. |
