// Speech-to-Text adapters.
//
// PRIVACY CONTRACT — DO NOT VIOLATE:
//   * No `MediaRecorder` is instantiated anywhere in this file.
//   * No `Blob` containing audio is constructed.
//   * No `fetch(..., { method: 'POST', body: <audio> })` ever runs.
//   * Only `{ transcript, confidence }` may leave this module — never the
//     raw audio stream, never a reference to a MediaStreamTrack.
//
// Two implementations:
//   - WebSpeechStt: uses the browser's `SpeechRecognition` API. On Chrome
//     this routes audio to Google's servers; the parent gate MUST disclose
//     this before enabling it.
//   - WhisperWasmStt: stub for Sprint 3 — whisper.cpp WASM tiny.en (~40MB).
//     Parent-opt-in toggle; lazy-loaded on first use.

export interface SttRecognizeOptions {
  lang?: string;
  maxDurationMs?: number;
}

export interface SttResult {
  transcript: string;
  confidence: number;
}

export interface SttAdapter {
  recognize(opts?: SttRecognizeOptions): Promise<SttResult>;
  isAvailable(): boolean;
}

export type SttPreference = "web-speech" | "whisper-offline";

// --- Browser type shims (SpeechRecognition is not in lib.dom yet) -----------

type SpeechRecognitionAlternative = {
  readonly transcript: string;
  readonly confidence: number;
};
type SpeechRecognitionResult = {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  readonly isFinal: boolean;
};
type SpeechRecognitionResultList = {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEventLike = { readonly results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEventLike = { readonly error: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// --- WebSpeechStt -----------------------------------------------------------

export class WebSpeechStt implements SttAdapter {
  isAvailable(): boolean {
    return getRecognitionCtor() !== null;
  }

  recognize(opts?: SttRecognizeOptions): Promise<SttResult> {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      return Promise.reject(new Error("SpeechRecognition not supported"));
    }

    // ASSERT (compile-time review): we instantiate ONLY SpeechRecognition.
    // No MediaRecorder, no getUserMedia, no Blob — the browser owns the audio
    // pipeline and we only ever read text out.
    const rec = new Ctor();
    rec.lang = opts?.lang ?? "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    return new Promise<SttResult>((resolve, reject) => {
      let finished = false;
      const finish = (fn: () => void): void => {
        if (finished) return;
        finished = true;
        fn();
      };

      const timeout = setTimeout(
        () => {
          try {
            rec.stop();
          } catch {
            /* noop */
          }
          finish(() => reject(new Error("stt timeout")));
        },
        Math.max(500, opts?.maxDurationMs ?? 5000),
      );

      rec.onresult = (e: SpeechRecognitionEventLike) => {
        const first = e.results[0]?.[0];
        if (!first) {
          clearTimeout(timeout);
          finish(() => reject(new Error("stt empty result")));
          return;
        }
        clearTimeout(timeout);
        finish(() =>
          resolve({
            transcript: first.transcript,
            confidence: first.confidence,
          }),
        );
      };
      rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
        clearTimeout(timeout);
        finish(() => reject(new Error(`stt error: ${e.error}`)));
      };
      rec.onend = () => {
        // If we never got a result we resolve via the timeout / error paths.
      };

      try {
        rec.start();
      } catch (err) {
        clearTimeout(timeout);
        finish(() => reject(err instanceof Error ? err : new Error(String(err))));
      }
    });
  }
}

// --- WhisperWasmStt (Sprint 4 — on-device whisper.cpp) ----------------------
//
// Architecture: the loader (`apps/web/src/lib/whisper-loader.ts`) owns the
// network fetch, placeholder detection, progress reporting, and Cache API
// integration — those concerns are Next-specific. This adapter only knows
// how to drive a compiled whisper.cpp WASM module against a pre-loaded
// ggml model buffer.
//
// To keep `@e4k/audio` framework-agnostic, the web layer registers a
// "module provider" at boot via `registerWhisperModuleProvider`. The
// adapter calls it from `load()` and stores the returned handle.

export interface WhisperRuntimeHandle {
  readonly modelBuffer: ArrayBuffer;
  readonly runtime: WebAssembly.Module;
}

export type WhisperLoaderState =
  | { kind: "ready"; handle: WhisperRuntimeHandle }
  | { kind: "placeholder" }
  | { kind: "error"; message: string };

/**
 * Function the application layer registers so this framework-agnostic
 * adapter can ask "is the offline model present and ready?" without taking
 * a dependency on the Next runtime or Cache API.
 */
export type WhisperModuleProvider = () => Promise<WhisperLoaderState>;

let moduleProvider: WhisperModuleProvider | null = null;

/** Register the loader bridge. Call once at app boot. */
export function registerWhisperModuleProvider(provider: WhisperModuleProvider): void {
  moduleProvider = provider;
}

/**
 * Minimal Emscripten-style binding surface for the whisper.cpp examples
 * WASM build. Mirrors the public C API surface we need:
 *   - whisper_init_from_buffer(buf, size) -> ctx
 *   - whisper_full(ctx, params, samples, n_samples) -> 0 on success
 *   - whisper_full_n_segments(ctx) -> n
 *   - whisper_full_get_segment_text(ctx, i) -> char*
 *
 * The real binding is generated by Emscripten and exposed as
 * `Module.cwrap(...)`. We type the subset we use; the runtime cast at the
 * point of instantiation keeps this file dependency-free.
 */
interface WhisperEmscriptenExports {
  _malloc(n: number): number;
  _free(p: number): void;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
  UTF8ToString(p: number): string;
  cwrap<TFn>(
    name: string,
    returnType: string | null,
    argTypes: readonly string[],
  ): TFn;
}

interface WhisperFullParamsRef {
  readonly ptr: number;
}

interface WhisperApi {
  initFromBuffer(buf: number, size: number): number;
  fullDefaultParams(strategy: number): WhisperFullParamsRef;
  full(
    ctx: number,
    params: WhisperFullParamsRef,
    samples: number,
    nSamples: number,
  ): number;
  nSegments(ctx: number): number;
  segmentText(ctx: number, i: number): string;
  free(ctx: number): void;
}

export class WhisperWasmStt implements SttAdapter {
  private static state:
    | { kind: "idle" }
    | { kind: "ready"; handle: WhisperRuntimeHandle }
    | { kind: "placeholder" }
    | { kind: "error"; message: string } = { kind: "idle" };

  isAvailable(): boolean {
    return WhisperWasmStt.state.kind === "ready";
  }

  /**
   * Drives the registered loader bridge. Resolves only when the offline
   * engine is fully ready; rejects with `whisper-placeholder` when the
   * binaries in the build are stubs (caller should fall back to Web
   * Speech with a neutral status message) and with a descriptive error
   * for any other failure path.
   *
   * ASSERT: once resolved, recognition runs entirely on-device. No network
   * calls, no audio uploaded. The model buffer is loaded once and reused.
   */
  static async load(): Promise<void> {
    if (WhisperWasmStt.state.kind === "ready") return;
    if (!moduleProvider) {
      WhisperWasmStt.state = {
        kind: "error",
        message: "whisper-provider-not-registered",
      };
      throw new Error("whisper-provider-not-registered");
    }
    const result = await moduleProvider();
    if (result.kind === "ready") {
      WhisperWasmStt.state = { kind: "ready", handle: result.handle };
      return;
    }
    if (result.kind === "placeholder") {
      WhisperWasmStt.state = { kind: "placeholder" };
      throw new Error("whisper-placeholder");
    }
    WhisperWasmStt.state = { kind: "error", message: result.message };
    throw new Error(result.message);
  }

  /**
   * Run inference against the loaded WASM module. The Emscripten module is
   * instantiated once per recognize() call against the cached compiled
   * `WebAssembly.Module` — we pay the small instantiation cost in exchange
   * for tearing the memory down between utterances, which keeps mobile
   * memory pressure predictable.
   */
  recognize(opts?: SttRecognizeOptions): Promise<SttResult> {
    const s = WhisperWasmStt.state;
    if (s.kind === "placeholder") {
      return Promise.reject(new Error("whisper-placeholder"));
    }
    if (s.kind !== "ready") {
      return Promise.reject(new Error("whisper-not-loaded"));
    }
    return runWhisperInference(s.handle, opts);
  }

  /** For tests. */
  static __resetForTests(): void {
    WhisperWasmStt.state = { kind: "idle" };
    moduleProvider = null;
  }
}

/**
 * Real inference entry point — instantiates the compiled WASM runtime
 * against an Emscripten-style import object, copies the model into the
 * module's HEAP, captures a single utterance of microphone audio via the
 * Web Audio API (NOT MediaRecorder — see safety contract at the top of
 * this file), and reads the transcript back out.
 *
 * The Web Audio path uses an `AudioContext` + `AudioWorkletNode` that
 * exports `Float32Array` PCM frames directly into the WASM heap. We never
 * construct a Blob, never write the samples to disk, never POST anywhere.
 */
async function runWhisperInference(
  handle: WhisperRuntimeHandle,
  _opts: SttRecognizeOptions | undefined,
): Promise<SttResult> {
  if (typeof WebAssembly === "undefined") {
    return Promise.reject(new Error("wasm-unsupported"));
  }

  // Emscripten modules ship a JS glue that we'd normally `import()`. Inside
  // this framework-agnostic file we instantiate the compiled module
  // directly and expect the glue to be registered alongside the runtime.
  // The Module export is fetched from the registered provider's transitive
  // setup — the web layer wires it via window.__whisperModuleFactory.
  const factory = (globalThis as { __whisperModuleFactory?: WhisperModuleFactory })
    .__whisperModuleFactory;
  if (!factory) {
    return Promise.reject(new Error("whisper-runtime-factory-missing"));
  }

  let instance: WhisperEmscriptenExports | null = null;
  let ctxPtr = 0;
  let modelPtr = 0;
  try {
    instance = await factory({
      wasmModule: handle.runtime,
    });

    const api = buildWhisperApi(instance);

    // Copy the model into the WASM HEAP — required for whisper_init_from_buffer.
    const modelBytes = new Uint8Array(handle.modelBuffer);
    modelPtr = instance._malloc(modelBytes.byteLength);
    instance.HEAPU8.set(modelBytes, modelPtr);
    ctxPtr = api.initFromBuffer(modelPtr, modelBytes.byteLength);
    if (ctxPtr === 0) {
      throw new Error("whisper-init-failed");
    }

    // Acquire one utterance of PCM samples via the safe Web Audio path.
    const samples = await captureUtterancePcm();

    // Copy PCM into HEAPF32 and run inference.
    const sampleBytes = samples.byteLength;
    const samplePtr = instance._malloc(sampleBytes);
    instance.HEAPF32.set(samples, samplePtr / 4);
    const params = api.fullDefaultParams(0 /* GREEDY */);
    const rc = api.full(ctxPtr, params, samplePtr, samples.length);
    instance._free(samplePtr);
    if (rc !== 0) {
      throw new Error(`whisper-full-failed:${rc}`);
    }

    const n = api.nSegments(ctxPtr);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) parts.push(api.segmentText(ctxPtr, i));
    const transcript = parts.join(" ").trim();

    // whisper.cpp does not surface a per-utterance confidence; we map to a
    // fixed 0.85 for the scoring layer — pronunciation.ts owns the real
    // grading via phoneme alignment.
    return { transcript, confidence: transcript ? 0.85 : 0 };
  } finally {
    if (instance && ctxPtr !== 0) {
      const free = instance.cwrap<(ctx: number) => void>("whisper_free", null, [
        "number",
      ]);
      try {
        free(ctxPtr);
      } catch {
        // best-effort
      }
    }
    if (instance && modelPtr !== 0) {
      try {
        instance._free(modelPtr);
      } catch {
        // best-effort
      }
    }
  }
}

type WhisperModuleFactory = (opts: {
  wasmModule: WebAssembly.Module;
}) => Promise<WhisperEmscriptenExports>;

function buildWhisperApi(m: WhisperEmscriptenExports): WhisperApi {
  return {
    initFromBuffer: m.cwrap<(b: number, s: number) => number>(
      "whisper_init_from_buffer",
      "number",
      ["number", "number"],
    ),
    fullDefaultParams: (strategy) => ({
      ptr: m.cwrap<(s: number) => number>("whisper_full_default_params_by_ref", "number", [
        "number",
      ])(strategy),
    }),
    full: (ctx, params, samples, n) =>
      m.cwrap<(c: number, p: number, s: number, n: number) => number>(
        "whisper_full",
        "number",
        ["number", "number", "number", "number"],
      )(ctx, params.ptr, samples, n),
    nSegments: m.cwrap<(c: number) => number>(
      "whisper_full_n_segments",
      "number",
      ["number"],
    ),
    segmentText: (ctx, i) => {
      const ptr = m.cwrap<(c: number, i: number) => number>(
        "whisper_full_get_segment_text",
        "number",
        ["number", "number"],
      )(ctx, i);
      return m.UTF8ToString(ptr);
    },
    free: m.cwrap<(c: number) => void>("whisper_free", null, ["number"]),
  };
}

/**
 * Capture one short utterance of PCM samples for whisper.
 *
 * This is the ONLY place in the codebase that touches the microphone for
 * the offline engine, and it does so without MediaRecorder:
 *   - `getUserMedia` returns a MediaStream.
 *   - We pipe the stream through an `AudioContext` -> `AudioWorkletNode`
 *     that exposes Float32 PCM frames.
 *   - Frames are concatenated into a single Float32Array (never a Blob,
 *     never serialized).
 *   - The MediaStream tracks are stopped before resolving.
 *
 * For the placeholder build this function is never reached — `recognize`
 * rejects with `whisper-placeholder` first.
 */
async function captureUtterancePcm(): Promise<Float32Array> {
  // Not implemented in the placeholder build. Real implementation lands
  // alongside the CI workflow that drops the actual whisper.wasm runtime
  // — at that point we also commit the AudioWorklet processor under
  // apps/web/public/whisper/worklet.js.
  throw new Error("whisper-capture-not-bundled");
}

/**
 * Factory: choose an STT adapter based on the parent-configured preference.
 *
 * Note: the application layer is responsible for showing the "Chrome routes
 * audio to Google" disclosure before enabling 'web-speech'.
 */
export function pickStt(pref: SttPreference): SttAdapter {
  if (pref === "whisper-offline") return new WhisperWasmStt();
  return new WebSpeechStt();
}
