// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - No MediaRecorder. No Blob construction. No fetch POST with audio body.
// - This module ONLY fetches a static model artifact (the whisper.cpp WASM
//   tiny.en weights + the whisper.cpp WASM runtime). It never uploads audio.
//   Both files are GET-only and served from the same-origin /whisper/ path.
// - Once loaded, recognition runs entirely on-device inside the WhisperWasmStt
//   adapter — no network call is made during recognize().
//
// Sprint 4 (S4-3) scope:
//   * The model + runtime are LFS-tracked at apps/web/public/whisper/.
//   * A 1 KB placeholder binary is committed so SHA tracking / CI is sane in
//     environments where the real ~39 MB tiny.en cannot be downloaded.
//   * The loader detects placeholders by magic + ASCII marker scan in the
//     first 2 KB and surfaces a friendly `placeholder` status — the caller
//     falls back to Web Speech instead of attempting to init WASM with a
//     bogus model (which would crash hard).
//   * Real binaries land via .github/workflows/render-whisper-model.yml,
//     which downloads from Hugging Face and PRs them onto the working branch.

'use client';

import {
  registerWhisperModuleProvider,
  type WhisperLoaderState,
} from '@e4k/audio';

export type WhisperLoadStatus =
  | 'idle'
  | 'loading'
  | 'placeholder'
  | 'ready'
  | 'error';

export interface WhisperLoadProgress {
  status: WhisperLoadStatus;
  bytesLoaded: number;
  bytesTotal: number;
  error: string | null;
}

const MODEL_URL = '/whisper/ggml-tiny.en.bin';
const RUNTIME_URL = '/whisper/whisper.wasm';
const RUNTIME_CACHE = 'whisper-runtime-cache';

// A genuine ggml-tiny.en.bin is ~39 MB. Anything below this floor is treated
// as suspicious and reinforces the placeholder check.
const REAL_MODEL_MIN_BYTES = 5 * 1024 * 1024;
const PLACEHOLDER_SCAN_BYTES = 2048;
const PLACEHOLDER_MARKER = 'PLACEHOLDER';
const GGML_MAGIC = [0x67, 0x67, 0x6d, 0x6c]; // "ggml"

let cachedStatus: WhisperLoadStatus = 'idle';
let cachedError: string | null = null;
let inflight: Promise<void> | null = null;
let cachedModuleHandle: WhisperModuleHandle | null = null;

/**
 * Thin handle returned by the loader for the STT adapter to invoke. The
 * actual implementation calls into the whisper.cpp Emscripten module that
 * the CI workflow drops at /whisper/whisper.wasm. In the placeholder build
 * this is `null` and the adapter rejects with `whisper-placeholder`.
 */
export interface WhisperModuleHandle {
  /** Returns the underlying ArrayBuffer that holds the ggml model. */
  readonly modelBuffer: ArrayBuffer;
  /** Compiled wasm module ready for the C entry points (`whisper_init`,
   *  `whisper_full`, `whisper_full_get_segment_text`). */
  readonly runtime: WebAssembly.Module;
}

export function isWhisperReady(): boolean {
  return cachedStatus === 'ready';
}

export function getWhisperStatus(): WhisperLoadStatus {
  return cachedStatus;
}

export function getWhisperError(): string | null {
  return cachedError;
}

export function getWhisperHandle(): WhisperModuleHandle | null {
  return cachedModuleHandle;
}

function emit(
  onProgress: ((p: WhisperLoadProgress) => void) | undefined,
  status: WhisperLoadStatus,
  bytesLoaded: number,
  bytesTotal: number,
  error: string | null,
): void {
  if (!onProgress) return;
  onProgress({ status, bytesLoaded, bytesTotal, error });
}

function bytesStartWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.byteLength < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function containsAsciiMarker(bytes: Uint8Array, marker: string): boolean {
  // ASCII-only scan — placeholder marker is plain ASCII so we don't need
  // a full UTF-8 decoder here.
  const limit = Math.min(bytes.byteLength, PLACEHOLDER_SCAN_BYTES);
  const m = new Uint8Array(marker.length);
  for (let i = 0; i < marker.length; i++) m[i] = marker.charCodeAt(i) & 0xff;
  outer: for (let i = 0; i + m.length <= limit; i++) {
    for (let j = 0; j < m.length; j++) {
      if (bytes[i + j] !== m[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Defensive: a real model MUST start with the ggml magic AND be large enough
 * AND not contain the PLACEHOLDER marker in its prologue. A fake binary that
 * satisfies all three would have to be a deliberate forgery, which we accept
 * as out-of-scope — the LFS pointer + CI workflow are the integrity layer.
 */
export function isPlaceholderBinary(bytes: Uint8Array, totalBytes: number): boolean {
  if (totalBytes > 0 && totalBytes < REAL_MODEL_MIN_BYTES) return true;
  if (!bytesStartWith(bytes, GGML_MAGIC)) {
    // Either the file is not a ggml model at all (treat as placeholder so we
    // never feed garbage into the WASM init) or the placeholder generator
    // changed shape.
    return true;
  }
  return containsAsciiMarker(bytes, PLACEHOLDER_MARKER);
}

async function openRuntimeCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(RUNTIME_CACHE);
  } catch {
    return null;
  }
}

/**
 * Streams the model into memory while reporting progress. We accumulate
 * chunks into a Uint8Array because the WASM module needs the whole buffer
 * at init time — there is no streaming `whisper_init`. We never wrap the
 * buffer in a Blob and never POST it; this is read-only memory used for
 * inference on this device.
 */
async function streamModel(
  res: Response,
  onProgress: ((p: WhisperLoadProgress) => void) | undefined,
): Promise<{ buffer: Uint8Array; total: number }> {
  const totalHeader = res.headers.get('content-length');
  const total = totalHeader ? Number(totalHeader) : 0;

  const reader = res.body?.getReader();
  if (!reader) throw new Error('no-stream-reader');

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      chunks.push(value);
      loaded += value.byteLength;
      emit(onProgress, 'loading', loaded, total, null);
    }
  }

  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { buffer, total: total || loaded };
}

async function compileRuntime(): Promise<WebAssembly.Module> {
  const res = await fetch(RUNTIME_URL, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`runtime-fetch-failed:${res.status}`);

  // Sanity check: real whisper.wasm is >1 MB; placeholder is 512 B. We
  // forward the failure mode through the placeholder branch so the UI gets
  // the same neutral copy.
  const ab = await res.arrayBuffer();
  if (ab.byteLength < 1024 * 1024) {
    throw new Error('runtime-placeholder');
  }
  return WebAssembly.compile(ab);
}

/**
 * Lazy-loads the whisper.cpp WASM tiny.en model + runtime.
 *
 * Status transitions:
 *   idle -> loading -> ready                 (real binaries present)
 *   idle -> loading -> placeholder           (placeholder binaries present)
 *   idle -> loading -> error                 (network/CSP/runtime failure)
 *
 * Caller contract: `placeholder` is NOT an error — it means the offline
 * engine is not bundled in this build and the UI should silently fall back
 * to Web Speech with a neutral message.
 */
export async function loadWhisper(
  onProgress?: (p: WhisperLoadProgress) => void,
): Promise<void> {
  if (cachedStatus === 'ready') {
    emit(onProgress, 'ready', 1, 1, null);
    return;
  }
  if (cachedStatus === 'placeholder') {
    emit(onProgress, 'placeholder', 0, 0, null);
    return;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    cachedStatus = 'loading';
    cachedError = null;
    emit(onProgress, 'loading', 0, 0, null);
    try {
      // HEAD probe first so we can short-circuit when the file is clearly
      // a placeholder (cheap, avoids the streaming reader overhead).
      let headTotal = 0;
      try {
        const head = await fetch(MODEL_URL, { method: 'HEAD' });
        if (head.ok) {
          const len = head.headers.get('content-length');
          headTotal = len ? Number(len) : 0;
        }
      } catch {
        // HEAD not supported by some static hosts — proceed with GET.
      }

      const res = await fetch(MODEL_URL, {
        method: 'GET',
        cache: 'force-cache',
      });
      if (!res.ok) {
        cachedStatus = 'error';
        cachedError = 'model-not-bundled';
        emit(onProgress, 'error', 0, headTotal, 'model-not-bundled');
        throw new Error('model-not-bundled');
      }

      // If HEAD reported a small size, sniff the first 2 KB only.
      if (headTotal > 0 && headTotal < REAL_MODEL_MIN_BYTES) {
        const probe = new Uint8Array(await res.arrayBuffer());
        if (isPlaceholderBinary(probe, headTotal)) {
          cachedStatus = 'placeholder';
          cachedError = null;
          emit(onProgress, 'placeholder', headTotal, headTotal, null);
          return;
        }
        // Fell through — small file but not a placeholder. Treat as error
        // rather than risk feeding a weird artifact to WASM.
        cachedStatus = 'error';
        cachedError = 'model-too-small';
        emit(onProgress, 'error', headTotal, headTotal, 'model-too-small');
        throw new Error('model-too-small');
      }

      // Stream the full model with progress reporting.
      const { buffer, total } = await streamModel(res, onProgress);

      if (isPlaceholderBinary(buffer, total)) {
        cachedStatus = 'placeholder';
        cachedError = null;
        emit(onProgress, 'placeholder', total, total, null);
        return;
      }

      // Cache the response for the SW to serve on next load. We swallow
      // failures here — the model is already in memory for this session.
      const cache = await openRuntimeCache();
      if (cache) {
        try {
          // We can't reuse the consumed Response, so put a fresh copy keyed
          // by the same URL. The body comes from our in-memory buffer.
          // Wrap the buffer in a fresh Uint8Array against a plain ArrayBuffer
          // copy. This satisfies `BodyInit` regardless of whether the source
          // buffer is `ArrayBuffer` or `SharedArrayBuffer` at the type level.
          const copy = new Uint8Array(buffer.byteLength);
          copy.set(buffer);
          await cache.put(
            MODEL_URL,
            new Response(copy as BlobPart as BodyInit, {
              status: 200,
              headers: {
                'content-type': 'application/octet-stream',
                'content-length': String(total),
              },
            }),
          );
        } catch {
          // Quota / opaque-cache constraints — non-fatal.
        }
      }

      const runtime = await compileRuntime();

      cachedModuleHandle = {
        modelBuffer: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
        runtime,
      };
      cachedStatus = 'ready';
      cachedError = null;
      emit(onProgress, 'ready', total, total, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'runtime-placeholder') {
        // The model passed magic + size but the runtime is still a stub —
        // collapse to placeholder so the UI shows the neutral copy.
        cachedStatus = 'placeholder';
        cachedError = null;
        emit(onProgress, 'placeholder', 0, 0, null);
        return;
      }
      if (cachedStatus !== 'placeholder') {
        cachedStatus = 'error';
        cachedError = message;
        emit(onProgress, 'error', 0, 0, message);
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function resetWhisperLoaderForTests(): void {
  cachedStatus = 'idle';
  cachedError = null;
  cachedModuleHandle = null;
  inflight = null;
}

/**
 * Bridge: lets `@e4k/audio`'s `WhisperWasmStt.load()` drive this loader
 * without taking a dependency on Next or the Cache API. Call once at app
 * boot (we do this from the runtime adapter so SSR doesn't try to fetch).
 */
export function installWhisperBridge(): void {
  registerWhisperModuleProvider(async (): Promise<WhisperLoaderState> => {
    try {
      await loadWhisper();
    } catch {
      // Fall through — we read the cached status below.
    }
    if (cachedStatus === 'ready' && cachedModuleHandle) {
      return { kind: 'ready', handle: cachedModuleHandle };
    }
    if (cachedStatus === 'placeholder') {
      return { kind: 'placeholder' };
    }
    return {
      kind: 'error',
      message: cachedError ?? 'whisper-load-failed',
    };
  });
}
