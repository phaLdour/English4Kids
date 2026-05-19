'use client';

import { AudioPlayer, type AudioPlayerConfig } from '@e4k/audio';
import type { AudioAssetMap } from '@e4k/content-schema';
import { getSetting } from '@e4k/db';
import { useEffect, useRef, useState } from 'react';

let singleton: AudioPlayer | null = null;
let initPromise: Promise<AudioPlayer> | null = null;

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
    return player.playVoice(entry.src);
  };

  return { player, ready: player !== null, playPrompt };
}
