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

// --- WhisperWasmStt (Sprint 3 stub) -----------------------------------------

export class WhisperWasmStt implements SttAdapter {
  private static loaded = false;

  isAvailable(): boolean {
    return WhisperWasmStt.loaded;
  }

  /**
   * Sprint 3 will load whisper.cpp WASM tiny.en (~40MB) here. The model is
   * fetched once on parent opt-in and cached in IndexedDB.
   *
   * ASSERT: once loaded, recognition runs entirely on-device. No network
   * calls, no audio uploaded.
   */
  static async load(): Promise<void> {
    // Intentionally not implemented in Sprint 1.
    throw new Error(
      "WhisperWasmStt not yet loaded — Sprint 3 will integrate whisper.cpp WASM tiny.en (~40MB)",
    );
  }

  recognize(_opts?: SttRecognizeOptions): Promise<SttResult> {
    return Promise.reject(
      new Error(
        "WhisperWasmStt not yet loaded — Sprint 3 will integrate whisper.cpp WASM tiny.en (~40MB)",
      ),
    );
  }
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
