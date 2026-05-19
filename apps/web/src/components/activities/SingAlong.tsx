'use client';

import type { ActivityItem, AudioAssetMap, SongLyric } from '@e4k/content-schema';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MascotReaction } from '@e4k/ui';
import { useAudio } from '@/lib/audio-client';
import { getSetting } from '@e4k/db';
import { activityMessages } from './messages';
import { WordHighlighter } from './WordHighlighter';

type SingAlongItem = Extract<ActivityItem, { type: 'sing_along' }>;

export interface SingAlongProps {
  items: SingAlongItem[];
  ageBand: '6-8' | '9-12';
  audioMap: AudioAssetMap;
  onItemComplete: (result: { firstAttemptCorrect: boolean }) => void;
  onActivityComplete: () => void;
  onMascotChange?: (reaction: MascotReaction) => void;
}

interface LyricLine {
  /** Start time in milliseconds. */
  startMs: number;
  text: string;
  words: string[];
}

const LRC_LINE_RE = /^\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\](.*)$/;
const FALLBACK_LINE_MS = 4000;

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = LRC_LINE_RE.exec(raw);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const fracRaw = m[3] ?? '0';
    const frac = Number(fracRaw.padEnd(3, '0').slice(0, 3));
    const startMs = (min * 60 + sec) * 1000 + frac;
    const text = (m[4] ?? '').trim();
    if (text.length === 0) continue;
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    lines.push({ startMs, text, words });
  }
  return lines;
}

function speakWord(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    synth.cancel();
    synth.speak(u);
  } catch {
    // Speech synthesis unavailable.
  }
}

export function SingAlong({
  items,
  ageBand,
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
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [activeMove, setActiveMove] = useState<string | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const item = items[itemIndex];

  // Hydrate captions setting (lyrics rarely off, but respect explicit user pref).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cap = await getSetting<boolean>('captions.enabled', true);
      if (!cancelled) setCaptionsEnabled(cap);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the song doc.
  useEffect(() => {
    if (!item) return;
    setSong(null);
    setError(null);
    setAudioFailed(false);
    setActiveLineIdx(0);
    setActiveMove(null);
    startedAtRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/content/songs/${encodeURIComponent(item.songId)}`,
        );
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

  const lyrics = useMemo<LyricLine[]>(() => (song ? parseLrc(song.lrc) : []), [song]);
  const moves = useMemo(
    () => (song?.tprMoves ?? []).filter((m) => m.ageBand === ageBand),
    [song, ageBand],
  );

  // Start music + advance loop.
  useEffect(() => {
    if (!song || !player) return;
    const audioEntry = audioMap[song.audioRef];
    if (!audioEntry) {
      setAudioFailed(true);
    } else {
      onMascotChange?.('encouraging');
      try {
        player.playMusic(audioEntry.src, { loop: false });
      } catch {
        setAudioFailed(true);
      }
    }
    startedAtRef.current = Date.now();

    const usesFallback = !audioEntry;
    if (usesFallback) {
      // No audio available — advance lines on a steady 4s clock.
      let idx = 0;
      fallbackTimerRef.current = setInterval(() => {
        idx += 1;
        if (idx >= lyrics.length) {
          if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
          return;
        }
        setActiveLineIdx(idx);
      }, FALLBACK_LINE_MS);
    } else {
      const tick = () => {
        if (startedAtRef.current === null) return;
        const elapsedMs = Date.now() - startedAtRef.current;
        // Find the latest line whose startMs has passed.
        let idx = 0;
        for (let i = 0; i < lyrics.length; i += 1) {
          const line = lyrics[i];
          if (line && line.startMs <= elapsedMs) idx = i;
        }
        setActiveLineIdx(idx);
        // Find the latest TPR move that has fired within the last second.
        const elapsedSec = elapsedMs / 1000;
        let pendingMove: string | null = null;
        for (const m of moves) {
          if (m.cueTime <= elapsedSec && elapsedSec - m.cueTime < 1.5) {
            pendingMove = m.move;
          }
        }
        setActiveMove(pendingMove);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      player.stopAll();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    };
  }, [song, player, audioMap, onMascotChange, lyrics, moves]);

  useEffect(() => {
    return () => {
      player?.stopAll();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [player]);

  const finishItem = useCallback(() => {
    onItemComplete({ firstAttemptCorrect: true });
    if (itemIndex + 1 >= items.length) {
      onActivityComplete();
    } else {
      setItemIndex((i) => i + 1);
    }
  }, [itemIndex, items.length, onItemComplete, onActivityComplete]);

  if (!item) return null;

  return (
    <section
      aria-label="Sing along"
      className="flex w-full max-w-3xl flex-col items-center gap-[var(--space-5)]"
    >
      <h2
        className="text-2xl text-[var(--color-primary-dark)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {song?.title ?? 'Sing along'}
      </h2>
      {error ? (
        <p
          aria-live="polite"
          className="max-w-xl text-center text-lg text-[var(--color-mist)]"
        >
          {activityMessages.singAlong.notReady}
        </p>
      ) : null}
      {audioFailed && !error ? (
        <p
          aria-live="polite"
          className="max-w-xl text-center text-base text-[var(--color-mist)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Sing along with the words!
        </p>
      ) : null}
      {activeMove ? (
        <motion.div
          key={`move-${activeMove}-${activeLineIdx}`}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          aria-live="polite"
          className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-pill)] bg-[var(--color-luna)] px-[var(--space-5)] py-[var(--space-2)] text-[var(--color-surface-high)] shadow-[var(--shadow-luna)]"
          style={{ fontFamily: 'var(--font-display)' }}
          data-tpr-move={activeMove}
        >
          {moveLabel(activeMove)}
        </motion.div>
      ) : null}
      {captionsEnabled ? (
        <ol
          aria-label={activityMessages.singAlong.lyricsLabel}
          className="flex flex-col items-center gap-[var(--space-2)] text-center text-xl text-[var(--color-ink)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {lyrics.map((line, idx) => {
            const isActive = idx === activeLineIdx;
            return (
              <li
                key={`lyric-${itemIndex}-${idx}-${line.text.slice(0, 8)}`}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  opacity: isActive ? 1 : 0.55,
                  transition: 'opacity 200ms ease',
                }}
              >
                {line.words.map((w, widx) => (
                  <WordHighlighter
                    key={`w-${idx}-${widx}-${w}`}
                    text={w}
                    isActive={false}
                    onTap={speakWord}
                  />
                ))}
              </li>
            );
          })}
        </ol>
      ) : null}
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

function moveLabel(move: string): string {
  switch (move) {
    case 'wave_hand':
      return 'Wave your hand!';
    case 'stretch_up':
      return 'Stretch up tall!';
    case 'smile_big':
      return 'Big smile!';
    case 'stomp':
      return 'Stomp your feet!';
    case 'clap':
      return 'Clap along!';
    default:
      return move.replace(/_/g, ' ');
  }
}
