'use client';

import type { ActivityItem, AudioAssetMap, SongLyric } from '@e4k/content-schema';
import { useEffect, useState } from 'react';
import type { MascotReaction } from '@e4k/ui';
import { useAudio } from '@/lib/audio-client';
import { activityMessages } from './messages';

type SingAlongItem = Extract<ActivityItem, { type: 'sing_along' }>;

export interface SingAlongProps {
  items: SingAlongItem[];
  ageBand: '6-8' | '9-12';
  audioMap: AudioAssetMap;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange?: (reaction: MascotReaction) => void;
}

function parseLrc(lrc: string): string[] {
  return lrc
    .split('\n')
    .map((line) => line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim())
    .filter((line) => line.length > 0);
}

export function SingAlong({
  items,
  audioMap,
  onItemComplete,
  onActivityComplete,
  onMascotChange,
}: SingAlongProps) {
  const { player } = useAudio();
  const [itemIndex, setItemIndex] = useState(0);
  const [song, setSong] = useState<SongLyric | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);

  const item = items[itemIndex];

  useEffect(() => {
    if (!item) return;
    setSong(null);
    setError(null);
    setAudioFailed(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/content/songs/${encodeURIComponent(item.songId)}`);
        if (!res.ok) {
          if (!cancelled) setError('Song manifest is on the way.');
          return;
        }
        const json = (await res.json()) as SongLyric;
        if (!cancelled) setSong(json);
      } catch {
        if (!cancelled) setError('Song manifest is on the way.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    if (!song || !player) return;
    const audioEntry = audioMap[song.audioRef];
    if (!audioEntry) {
      setAudioFailed(true);
      return;
    }
    onMascotChange?.('encouraging');
    try {
      player.playMusic(audioEntry.src, { loop: false });
    } catch {
      setAudioFailed(true);
    }
    return () => {
      player.stopAll();
    };
  }, [song, player, audioMap, onMascotChange]);

  useEffect(() => {
    return () => {
      player?.stopAll();
    };
  }, [player]);

  if (!item) return null;

  const lyrics = song ? parseLrc(song.lrc) : [];

  const finishItem = () => {
    onItemComplete({ firstAttemptCorrect: true });
    if (itemIndex + 1 >= items.length) {
      onActivityComplete();
    } else {
      setItemIndex((i) => i + 1);
    }
  };

  return (
    <section
      aria-label="Sing along"
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-6)]"
    >
      <h2
        className="text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {song?.title ?? 'Sing along'}
      </h2>
      {error || audioFailed ? (
        <p
          aria-live="polite"
          className="max-w-xl text-center text-lg text-[var(--color-mist)]"
        >
          {activityMessages.singAlong.notReady}
        </p>
      ) : null}
      <ol
        aria-label={activityMessages.singAlong.lyricsLabel}
        className="flex flex-col items-center gap-[var(--space-2)] text-center text-lg text-[var(--color-ink)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {lyrics.map((line, idx) => (
          <li key={`lyric-${itemIndex}-${idx}-${line.slice(0, 12)}`}>{line}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={finishItem}
        className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-[var(--space-8)] text-[var(--color-surface-high)] shadow-[var(--shadow-pop)] transition-transform duration-[var(--motion-fast)] active:scale-95"
        style={{
          minHeight: 'var(--tap-primary-young)',
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
        }}
      >
        {activityMessages.singAlong.done}
      </button>
    </section>
  );
}
