'use client';

/**
 * Derived stats hook for the parent dashboard.
 *
 * Reads Dexie tables directly (local-first MVP). Returns a normalised, easy
 * to render shape. If the active child has no recorded activity we return
 * zeroed counters + empty lists so the UI can show an empty-state message
 * rather than crash.
 */

import { db } from '@e4k/db';
import type { AuditEvent, PronunciationAttempt, Progress, VocabState } from '@e4k/db';
import { useEffect, useState } from 'react';

export interface DailyMinutes {
  /** ISO local-day 'YYYY-MM-DD'. */
  day: string;
  /** Short weekday label e.g. 'Mon'. */
  label: string;
  minutes: number;
}

export interface RecentLesson {
  lessonId: string;
  title: string;
  stars: number;
  completedAt: Date;
}

export interface ChildStats {
  todayMinutes: number;
  todayLessons: number;
  todayNewWords: number;
  todayPronunciationAttempts: number;
  weeklyMinutes: DailyMinutes[];
  recentLessons: RecentLesson[];
  totalStars: number;
  totalWordsLearned: number;
}

const ZERO_STATS: ChildStats = {
  todayMinutes: 0,
  todayLessons: 0,
  todayNewWords: 0,
  todayPronunciationAttempts: 0,
  weeklyMinutes: [],
  recentLessons: [],
  totalStars: 0,
  totalWordsLearned: 0,
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Format a Date as a local-day ISO 'YYYY-MM-DD' string. */
function toLocalDay(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(d: Date, ref: Date): boolean {
  return toLocalDay(d) === toLocalDay(ref);
}

/**
 * Build the past-7-days window ending today (inclusive) as zeroed buckets.
 * Caller fills in minutes via the audit log.
 */
function buildWeekBuckets(today: Date): DailyMinutes[] {
  const buckets: DailyMinutes[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const label = WEEKDAY_LABELS[d.getDay()] ?? '';
    buckets.push({ day: toLocalDay(d), label, minutes: 0 });
  }
  return buckets;
}

interface SessionWindow {
  start: number;
  end: number;
}

/**
 * Roll up audit_log lesson_started / lesson_completed pairs into per-day
 * minutes. If a lesson_started has no matching completed event within 1 hour
 * we cap that session at 1 hour (defensive — protects against runaway audit
 * trails when a tab is left open).
 */
function rollUpSessions(events: AuditEvent[]): SessionWindow[] {
  const sessions: SessionWindow[] = [];
  const openStarts: number[] = [];
  for (const evt of events) {
    const ts = new Date(evt.occurred_at).getTime();
    if (evt.event_type === 'lesson_started') {
      openStarts.push(ts);
    } else if (evt.event_type === 'lesson_completed' && openStarts.length > 0) {
      const start = openStarts.shift();
      if (start !== undefined) {
        const cappedEnd = Math.min(ts, start + 60 * 60 * 1000);
        sessions.push({ start, end: cappedEnd });
      }
    }
  }
  // Any lingering open starts cap at 5 min (treated as abandoned).
  for (const start of openStarts) {
    sessions.push({ start, end: start + 5 * 60 * 1000 });
  }
  return sessions;
}

function minutesBetween(a: number, b: number): number {
  return Math.max(0, Math.round((b - a) / 60_000));
}

interface DexieTables {
  progress: Progress[];
  vocabState: VocabState[];
  pronunciationAttempts: PronunciationAttempt[];
  auditLog: AuditEvent[];
}

async function readChildTables(childId: string): Promise<DexieTables> {
  const [progress, vocabState, pronunciationAttempts, auditLog] = await Promise.all([
    db.progress.where('child_id').equals(childId).toArray(),
    db.vocabState.where('child_id').equals(childId).toArray(),
    db.pronunciationAttempts.where('child_id').equals(childId).toArray(),
    db.auditLog.where('child_id').equals(childId).toArray(),
  ]);
  return { progress, vocabState, pronunciationAttempts, auditLog };
}

function computeStats(tables: DexieTables, now: Date): ChildStats {
  const { progress, vocabState, pronunciationAttempts, auditLog } = tables;

  // Sort audit events oldest -> newest so the start/complete pairing is stable.
  const sortedEvents = [...auditLog].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );

  const sessions = rollUpSessions(sortedEvents);
  const weekBuckets = buildWeekBuckets(now);
  const weekIndex = new Map<string, DailyMinutes>();
  for (const b of weekBuckets) weekIndex.set(b.day, b);

  let todayMinutes = 0;
  const todayKey = toLocalDay(now);
  for (const s of sessions) {
    const day = toLocalDay(new Date(s.start));
    const mins = minutesBetween(s.start, s.end);
    if (day === todayKey) todayMinutes += mins;
    const bucket = weekIndex.get(day);
    if (bucket) bucket.minutes += mins;
  }

  const todayLessons = sortedEvents.filter(
    (e) => e.event_type === 'lesson_completed' && isSameLocalDay(new Date(e.occurred_at), now),
  ).length;

  const todayNewWords = vocabState.filter((v) =>
    isSameLocalDay(new Date(v.created_at), now),
  ).length;

  const todayPronunciationAttempts = pronunciationAttempts.filter((p) =>
    isSameLocalDay(new Date(p.attempted_at), now),
  ).length;

  const completed = progress
    .filter((p) => p.status === 'completed' || p.status === 'mastered')
    .filter((p) => p.last_attempt_at !== null)
    .sort((a, b) => {
      const ta = a.last_attempt_at ? new Date(a.last_attempt_at).getTime() : 0;
      const tb = b.last_attempt_at ? new Date(b.last_attempt_at).getTime() : 0;
      return tb - ta;
    });

  const recentLessons: RecentLesson[] = completed.slice(0, 10).map((p) => ({
    lessonId: p.lesson_id,
    title: p.lesson_id, // Titles are content-driven; the page maps lesson_id -> friendly title.
    stars: p.stars,
    completedAt: p.last_attempt_at ? new Date(p.last_attempt_at) : new Date(0),
  }));

  const totalStars = progress.reduce((sum, p) => sum + (p.stars ?? 0), 0);
  const totalWordsLearned = vocabState.filter((v) => v.box >= 3).length;

  return {
    todayMinutes,
    todayLessons,
    todayNewWords,
    todayPronunciationAttempts,
    weeklyMinutes: weekBuckets,
    recentLessons,
    totalStars,
    totalWordsLearned,
  };
}

export interface UseChildStatsResult {
  stats: ChildStats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useChildStats(childId: string | undefined): UseChildStatsResult {
  const [stats, setStats] = useState<ChildStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!childId) {
      setStats(ZERO_STATS);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const tables = await readChildTables(childId);
        if (cancelled) return;
        setStats(computeStats(tables, new Date()));
      } catch (err) {
        if (cancelled) return;
        // Dexie may not be available in private browsing — show empty state.
        setError(err instanceof Error ? err : new Error('Failed to load stats'));
        setStats(ZERO_STATS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, version]);

  return {
    stats,
    loading,
    error,
    refresh: () => setVersion((v) => v + 1),
  };
}

/** Exported for tests. */
export const __testing = { computeStats, toLocalDay, ZERO_STATS };
