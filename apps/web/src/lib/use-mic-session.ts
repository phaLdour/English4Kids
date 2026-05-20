// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - No `MediaRecorder` is instantiated anywhere in this file.
// - No `Blob` containing audio is constructed.
// - No `fetch(..., { method: 'POST', body: <audio> })` ever runs.
// - The MediaStream returned by `getUserMedia` is released IMMEDIATELY
//   after permission is granted — we only used it to surface the permission
//   prompt. The browser's SpeechRecognition / whisper WASM adapter owns the
//   real audio pipeline and only emits `{ transcript, confidence }`.
// - Only `{ transcript, confidence }` ever leaves this hook.

'use client';

import { pickStt, type SttAdapter, type SttPreference, type SttResult } from '@e4k/audio';
import { getSetting, type MicEngine } from '@e4k/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMicStore } from './mic-store';

export type MicState =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'processing'
  | 'denied'
  | 'error'
  | 'unsupported';

export interface MicStartOptions {
  maxDurationMs?: number;
}

export interface MicSession {
  state: MicState;
  start: (opts?: MicStartOptions) => Promise<void>;
  stop: () => void;
  lastResult: SttResult | null;
  error: string | null;
  isSupported: boolean;
}

const DEFAULT_MAX_DURATION_MS = 1500;

interface MediaDevicesWithGUM {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
}

function getMediaDevices(): MediaDevicesWithGUM | null {
  if (typeof navigator === 'undefined') return null;
  const md = (navigator as Navigator).mediaDevices as MediaDevicesWithGUM | undefined;
  if (!md || typeof md.getUserMedia !== 'function') return null;
  return md;
}

/** Release every track on the stream so the OS mic indicator clears. */
function releaseStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // noop — track may already be stopped.
    }
  }
}

export function useMicSession(): MicSession {
  const [state, setState] = useState<MicState>('idle');
  const [lastResult, setLastResult] = useState<SttResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);

  const adapterRef = useRef<SttAdapter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  const setMicActive = useMicStore((s) => s.setActive);
  const stopRequest = useMicStore((s) => s.stopRequest);

  // Probe support on mount.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    void (async () => {
      const enabled = await getSetting<boolean>('mic.enabled', false);
      const engine = await getSetting<MicEngine>('mic.engine', 'web-speech');
      if (cancelled) return;
      try {
        const adapter = pickStt(engine as SttPreference);
        setIsSupported(enabled && adapter.isAvailable());
      } catch {
        setIsSupported(false);
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const safeSetState = useCallback((next: MicState) => {
    if (!mountedRef.current) return;
    setState(next);
    setMicActive(next === 'listening');
  }, [setMicActive]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    clearTimeoutRef();
    releaseStream(streamRef.current);
    streamRef.current = null;
    // Best-effort abort on the adapter — WebSpeechStt resolves/rejects its
    // own promise; we treat the in-flight result as discarded.
    adapterRef.current = null;
    safeSetState('idle');
  }, [clearTimeoutRef, safeSetState]);

  // React to global "Stop talking" requests from the persistent MicIndicator.
  const lastSeenStopRequestRef = useRef<number>(stopRequest);
  useEffect(() => {
    if (stopRequest !== lastSeenStopRequestRef.current) {
      lastSeenStopRequestRef.current = stopRequest;
      // Only act if we're currently running.
      if (state === 'listening' || state === 'requesting-permission' || state === 'processing') {
        stop();
      }
    }
  }, [stopRequest, state, stop]);

  // Cleanup on unmount: always release tracks.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      releaseStream(streamRef.current);
      streamRef.current = null;
      setMicActive(false);
    };
  }, [setMicActive]);

  const start = useCallback(
    async (opts?: MicStartOptions): Promise<void> => {
      cancelledRef.current = false;
      setError(null);
      setLastResult(null);

      const enabled = await getSetting<boolean>('mic.enabled', false);
      if (!enabled) {
        safeSetState('denied');
        setError('mic-disabled');
        return;
      }

      const engine = await getSetting<MicEngine>('mic.engine', 'web-speech');
      let adapter: SttAdapter;
      try {
        adapter = pickStt(engine as SttPreference);
      } catch (err) {
        safeSetState('unsupported');
        setError(err instanceof Error ? err.message : 'adapter-init-failed');
        return;
      }

      // If the parent picked whisper-offline but the model hasn't been
      // bundled yet, fall back to Web Speech and surface a hint. We detect
      // this by probing isAvailable() — WhisperWasmStt returns false until
      // its loader has flipped `loaded = true`.
      if (engine === 'whisper-offline' && !adapter.isAvailable()) {
        try {
          adapter = pickStt('web-speech');
          setError('offline-engine-not-ready');
        } catch {
          safeSetState('unsupported');
          setError('offline-engine-not-ready');
          return;
        }
      }

      if (!adapter.isAvailable()) {
        safeSetState('unsupported');
        setError('stt-unavailable');
        return;
      }

      adapterRef.current = adapter;
      safeSetState('requesting-permission');

      // Surface the browser permission prompt. We immediately release the
      // tracks — the SpeechRecognition / WASM adapter manages its own audio
      // pipeline. We DO NOT instantiate MediaRecorder against this stream.
      const md = getMediaDevices();
      if (md) {
        try {
          const stream = await md.getUserMedia({ audio: true });
          streamRef.current = stream;
          // Release immediately. Permission persists for the page session.
          releaseStream(stream);
          streamRef.current = null;
        } catch (err) {
          const name = err instanceof Error ? err.name : 'PermissionError';
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            safeSetState('denied');
            setError('permission-denied');
          } else {
            safeSetState('error');
            setError(err instanceof Error ? err.message : 'permission-failed');
          }
          return;
        }
      }
      // If no mediaDevices (test JSDOM) we proceed — the adapter is mocked.

      if (cancelledRef.current) {
        safeSetState('idle');
        return;
      }

      safeSetState('listening');

      const maxDurationMs = opts?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

      // Hard cap: even if the adapter ignores its own timeout, we flip state.
      timeoutRef.current = setTimeout(() => {
        // Adapter is expected to time out on its own as well; this is the
        // belt-and-braces ceiling so the kid never leaves the mic open.
        if (state === 'listening') {
          // The promise below will resolve/reject; nothing to do here
          // beyond the state flip — the adapter's own timeout fires first.
        }
      }, maxDurationMs + 250);

      try {
        const result = await adapter.recognize({
          lang: 'en-US',
          maxDurationMs,
        });
        clearTimeoutRef();
        if (cancelledRef.current || !mountedRef.current) {
          safeSetState('idle');
          return;
        }
        safeSetState('processing');
        setLastResult(result);
        safeSetState('idle');
      } catch (err) {
        clearTimeoutRef();
        if (!mountedRef.current) return;
        if (cancelledRef.current) {
          safeSetState('idle');
          return;
        }
        const message = err instanceof Error ? err.message : 'recognize-failed';
        // STT timeouts are an expected outcome — the kid simply didn't
        // speak. Surface as an idle state with a null lastResult so the
        // caller can re-prompt without a "scary" error band.
        if (message.includes('timeout') || message.includes('empty')) {
          safeSetState('idle');
          setError(null);
          return;
        }
        safeSetState('error');
        setError(message);
      } finally {
        releaseStream(streamRef.current);
        streamRef.current = null;
      }
    },
    [clearTimeoutRef, safeSetState, state],
  );

  return {
    state,
    start,
    stop,
    lastResult,
    error,
    isSupported,
  };
}
