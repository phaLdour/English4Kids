'use client';

import { AudioPlayer, type AudioPlayerConfig } from '@e4k/audio';
import type { AudioAssetMap } from '@e4k/content-schema';
import { getSetting } from '@e4k/db';
import { useEffect, useRef, useState } from 'react';

let singleton: AudioPlayer | null = null;
let initPromise: Promise<AudioPlayer> | null = null;

/**
 * Cached Opus-support detection. We do this once per session.
 *
 * Sprint 4 — S4-8: prefer Opus when the browser supports it. Opus narration
 * clips are ~3-4x smaller than equivalent MP3 fallbacks. Browsers that
 * cannot decode Opus (older Safari before 17, some webviews) get the .mp3.
 *
 * `canPlayType` returns `''` (no), `'maybe'` (probably), or `'probably'`
 * (yes). We treat `maybe` as "yes" since modern engines under-report.
 */
let opusSupported: boolean | null = null;
function detectOpusSupport(): boolean {
  if (opusSupported !== null) return opusSupported;
  if (typeof Audio === 'undefined') {
    opusSupported = false;
    return false;
  }
  try {
    const a = new Audio();
    const can = a.canPlayType('audio/ogg; codecs=opus');
    opusSupported = can === 'probably' || can === 'maybe';
  } catch {
    opusSupported = false;
  }
  return opusSupported;
}

/**
 * Build the ordered list of sources Howler should try for a given asset src.
 * The asset map always stores the `.mp3` path; we synthesize the `.opus`
 * sibling and put it first when Opus is supported. Howler will fall through
 * to the next entry on 404, so a missing Opus file degrades gracefully.
 */
export function buildAdaptiveSources(mp3Src: string): string[] {
  if (!detectOpusSupport()) return [mp3Src];
  const opusSrc = mp3Src.replace(/\.mp3(\?|$)/, '.opus$1');
  return [opusSrc, mp3Src];
}

/** Test-only hook to reset the detection cache. */
export function _resetOpusDetectionForTests(value: boolean | null = null): void {
  opusSupported = value;
}

async function loadConfigFromSettings(): Promise<AudioPlayerConfig> {
  const [master, music, sfx, voice, muted, focus] = await Promise.all([
    getSetting<number>('audio.master', 80),
    getSetting<number>('audio.music', 60),
    getSetting<number>('audio.sfx', 80),
    getSetting<number>('audio.voice', 100),
    getSetting<boolean>('audio.muted', false),
    getSetting<boolean>('audio.focusMode', false),
  ]);
  return {
    masterVolume: master,
    musicVolume: music,
    sfxVolume: sfx,
    voiceVolume: voice,
    muteAll: muted,
    focusMode: focus,
  };
}

export async function getAudioClient(): Promise<AudioPlayer> {
  if (singleton) return singleton;
  if (initPromise) return initPromise;
  initPromise = loadConfigFromSettings().then((cfg) => {
    singleton = new AudioPlayer(cfg);
    return singleton;
  });
  return initPromise;
}

export function resetAudioClientForTests(): void {
  singleton = null;
  initPromise = null;
}

export interface UseAudioReturn {
  player: AudioPlayer | null;
  ready: boolean;
  playPrompt: (assetId: string, audioMap: AudioAssetMap | undefined) => string | null;
}

export function useAudio(): UseAudioReturn {
  const [player, setPlayer] = useState<AudioPlayer | null>(singleton);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!player) {
      void getAudioClient().then((p) => {
        if (mountedRef.current) setPlayer(p);
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, [player]);

  const playPrompt = (assetId: string, audioMap: AudioAssetMap | undefined): string | null => {
    if (!player || !audioMap) return null;
    const entry = audioMap[assetId];
    if (!entry) return null;
    // S4-8: prefer Opus when supported; Howler probes each entry until one
    //       loads. If neither plays (e.g. tests, no audio context), log and
    //       resolve so the lesson keeps advancing.
    const sources = buildAdaptiveSources(entry.src);
    try {
      // Howler accepts an array; player.playVoice currently takes a single
      // src so we pass the highest-priority source it supports and rely on
      // the SW's adaptive handler + sibling-cache to do the rest. When the
      // .opus file 404s in placeholder mode, the SW falls back to network
      // which falls back to .mp3 via the lesson's natural retry.
      return player.playVoice(sources[0] ?? entry.src);
    } catch (err) {
      console.warn('[audio-client] playPrompt failed; continuing without audio', err);
      return null;
    }
  };

  return { player, ready: player !== null, playPrompt };
}

/**
 * Fire-and-forget: ask the SW to warm the audio cache for a given unit.
 * Safe to call before the SW is registered — falls through silently.
 */
export function requestUnitPrecache(unitId: string): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({
    type: 'precache-unit-audio',
    unitId,
  });
}
