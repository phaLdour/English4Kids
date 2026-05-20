'use client';

/**
 * Runtime adapter — bridges the web codebase to native Capacitor plugins
 * when running inside the iOS / Android shell, and falls back to standard
 * browser APIs otherwise.
 *
 * The web bundle MUST stay free of static Capacitor imports — those modules
 * pull native bindings that don't exist in the browser. Every plugin is
 * loaded via `await import(...)` inside an `isCapacitor()` guard so that
 * the chunk is only fetched when the WebView host can serve it.
 *
 * PRIVACY: speech recognition runs on-device. Neither this adapter nor any
 * downstream plugin uploads audio. The web fallback (Web Speech API) is
 * already constrained by the privacy contract in `@e4k/audio`.
 */

import { type SttAdapter, type SttResult, WebSpeechStt } from '@e4k/audio';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

interface CapacitorHost {
  Capacitor?: CapacitorGlobal;
}

/**
 * `true` when the bundle is being served from inside the Capacitor WebView.
 * Falsy in normal browser sessions.
 */
export function isCapacitor(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const host = globalThis as unknown as CapacitorHost;
  const cap = host.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') {
    try {
      return cap.isNativePlatform();
    } catch {
      return false;
    }
  }
  return false;
}

/** Returns 'ios' | 'android' | 'web' (lowercase). */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof globalThis === 'undefined') return 'web';
  const host = globalThis as unknown as CapacitorHost;
  const cap = host.Capacitor;
  if (cap?.getPlatform) {
    try {
      const p = cap.getPlatform();
      if (p === 'ios' || p === 'android') return p;
    } catch {
      // ignore
    }
  }
  return 'web';
}

// --- Native SpeechRecognition wrapper --------------------------------------

interface CommunitySpeechResult {
  matches?: string[];
}

interface CommunitySpeechRecognitionPlugin {
  available(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<unknown>;
  start(opts: {
    language?: string;
    maxResults?: number;
    prompt?: string;
    partialResults?: boolean;
    popup?: boolean;
  }): Promise<CommunitySpeechResult>;
  stop(): Promise<void>;
}

/**
 * Lazy import of the community plugin. Throws if the plugin module is
 * unavailable (i.e. running in a regular browser session).
 *
 * The import specifier is stored in a variable so the web `tsc` build does
 * not try to resolve the Capacitor package — it only exists inside the
 * mobile workspace. The runtime check ahead of every call guarantees we
 * never reach this code path outside the WebView.
 */
async function loadCommunitySpeechRecognition(): Promise<CommunitySpeechRecognitionPlugin> {
  const specifier = '@capacitor-community/speech-recognition';
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynamicImport: (s: string) => Promise<unknown> = new Function(
    's',
    'return import(s)',
  ) as (s: string) => Promise<unknown>;
  const mod = (await dynamicImport(specifier)) as {
    SpeechRecognition: CommunitySpeechRecognitionPlugin;
  };
  return mod.SpeechRecognition;
}

class CapacitorSttAdapter implements SttAdapter {
  isAvailable(): boolean {
    return isCapacitor();
  }

  async recognize(opts?: { lang?: string; maxDurationMs?: number }): Promise<SttResult> {
    const plugin = await loadCommunitySpeechRecognition();
    // Best-effort capability check; the plugin's own `available()` honours
    // the OS-level recognition availability.
    try {
      const cap = await plugin.available();
      if (!cap.available) {
        throw new Error('native speech recognition unavailable');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    await plugin.requestPermissions();
    const res = await plugin.start({
      language: opts?.lang ?? 'en-US',
      maxResults: 1,
      partialResults: false,
      // `popup: false` keeps the experience kid-friendly on Android
      // (no system speech dialog). iOS doesn't surface a popup either way.
      popup: false,
    });
    const transcript = res.matches?.[0] ?? '';
    if (!transcript) {
      throw new Error('stt empty result');
    }
    return { transcript, confidence: 1 };
  }
}

/**
 * Pick the right STT adapter for the current runtime.
 *
 * Order of preference:
 *   1. Native plugin when we're inside Capacitor.
 *   2. Whatever `pickStt(pref)` from `@e4k/audio` decides on the web.
 *
 * Callers should prefer this over `pickStt()` directly when they expect
 * mobile users; existing call sites that only target the web are unchanged.
 */
export function getSpeechRecognition(): SttAdapter {
  if (isCapacitor()) {
    return new CapacitorSttAdapter();
  }
  // Default web path: the existing privacy-checked Web Speech adapter.
  return new WebSpeechStt();
}
