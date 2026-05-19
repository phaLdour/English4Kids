// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - No MediaRecorder. No Blob construction. No fetch POST with audio body.
// - This module ONLY fetches a static model artifact (the whisper.cpp WASM
//   tiny.en weights). It never uploads audio. The model file is GET-only.
// - Once loaded, recognition runs entirely on-device inside the WhisperWasmStt
//   adapter — no network call is made during recognize().
// - For Sprint 3 the actual .bin file is NOT bundled in the repo (~30MB).
//   `loadWhisper` simulates the fetch from `/whisper/ggml-tiny.en.bin` and
//   surfaces a clean `model-not-bundled` error so the UI can fall back to
//   Web Speech. Phase 2 will commit the model under an LFS-tracked path.

'use client';

export type WhisperLoadStatus = 'idle' | 'downloading' | 'ready' | 'error';

export interface WhisperLoadProgress {
  status: WhisperLoadStatus;
  bytesLoaded: number;
  bytesTotal: number;
  error: string | null;
}

const MODEL_URL = '/whisper/ggml-tiny.en.bin';

let cachedStatus: WhisperLoadStatus = 'idle';
let inflight: Promise<void> | null = null;

export function isWhisperReady(): boolean {
  return cachedStatus === 'ready';
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

/**
 * Lazy-loads the whisper.cpp WASM tiny.en model.
 *
 * Sprint 3 scope: we stand up the loader plumbing and progress callback
 * surface. The model artifact itself is not yet checked into the repo
 * (~30MB), so a 404 surfaces as `model-not-bundled`. Phase 2 will commit the
 * artifact at `/whisper/ggml-tiny.en.bin` (LFS) and this function will
 * transparently succeed.
 */
export async function loadWhisper(
  onProgress?: (p: WhisperLoadProgress) => void,
): Promise<void> {
  if (cachedStatus === 'ready') {
    emit(onProgress, 'ready', 1, 1, null);
    return;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    cachedStatus = 'downloading';
    emit(onProgress, 'downloading', 0, 0, null);
    try {
      const res = await fetch(MODEL_URL, { method: 'GET', cache: 'force-cache' });
      if (!res.ok) {
        cachedStatus = 'error';
        emit(onProgress, 'error', 0, 0, 'model-not-bundled');
        throw new Error('model-not-bundled');
      }

      const totalHeader = res.headers.get('content-length');
      const total = totalHeader ? Number(totalHeader) : 0;

      const reader = res.body?.getReader();
      if (!reader) {
        cachedStatus = 'error';
        emit(onProgress, 'error', 0, total, 'no-stream-reader');
        throw new Error('no-stream-reader');
      }

      let loaded = 0;
      // We intentionally do NOT accumulate chunks into a Blob or Uint8Array
      // here — the actual whisper.cpp WASM module ingests bytes through its
      // own module loader, which Phase 2 will wire in. For Sprint 3 we only
      // need to surface progress and verify reachability.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value?.byteLength ?? 0;
        emit(onProgress, 'downloading', loaded, total, null);
      }

      cachedStatus = 'ready';
      emit(onProgress, 'ready', loaded, total, null);
    } catch (err) {
      cachedStatus = 'error';
      const message = err instanceof Error ? err.message : String(err);
      emit(onProgress, 'error', 0, 0, message);
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function resetWhisperLoaderForTests(): void {
  cachedStatus = 'idle';
  inflight = null;
}
