'use client';

import { db } from '@e4k/db';
import type { VocabState } from '@e4k/db';
import {
  advance,
  initialState,
  type LeitnerBox,
  type LeitnerState,
} from '@e4k/game-engine';
import { useCallback, useEffect, useState } from 'react';

export interface VocabStateRow {
  word: string;
  box: LeitnerBox;
  due_at: Date;
  last_practiced_at: Date | null;
}

export interface UseVocabStateReturn {
  states: VocabStateRow[];
  loading: boolean;
  recordOutcome: (word: string, result: 'correct' | 'incorrect') => Promise<void>;
  /** Force a re-read from Dexie. Returned for parent dashboards. */
  refresh: () => Promise<void>;
}

function vocabId(childId: string, word: string): string {
  return `${childId}::${word}`;
}

function rowToLeitner(row: VocabState): LeitnerState {
  return {
    box: row.box,
    consecutiveCorrect: row.consecutive_correct,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    dueAt: new Date(row.due_at),
  };
}

function leitnerToRow(
  childId: string,
  word: string,
  state: LeitnerState,
  existing: VocabState | undefined,
  result: 'correct' | 'incorrect',
  now: Date,
): VocabState {
  const id = existing?.id ?? vocabId(childId, word);
  return {
    id,
    child_id: childId,
    word_key: word,
    box: state.box,
    consecutive_correct: state.consecutiveCorrect,
    last_result: result,
    last_seen_at: now.toISOString(),
    due_at: state.dueAt.toISOString(),
    created_at: existing?.created_at ?? now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Reads vocab states for the given child from Dexie. The hook is reactive in
 * that `recordOutcome` updates local state immediately; for cross-tab updates
 * the parent can call `refresh()`.
 */
export function useVocabState(childId: string | null): UseVocabStateReturn {
  const [states, setStates] = useState<VocabStateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!childId) {
      setStates([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await db.vocabState.where('child_id').equals(childId).toArray();
      setStates(
        rows.map((r) => ({
          word: r.word_key,
          box: r.box,
          due_at: new Date(r.due_at),
          last_practiced_at: r.last_seen_at ? new Date(r.last_seen_at) : null,
        })),
      );
    } catch {
      setStates([]);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordOutcome = useCallback(
    async (word: string, result: 'correct' | 'incorrect') => {
      if (!childId) return;
      const now = new Date();
      const id = vocabId(childId, word);
      let existing: VocabState | undefined;
      try {
        existing = await db.vocabState.get(id);
      } catch {
        existing = undefined;
      }
      const priorLeitner: LeitnerState = existing
        ? rowToLeitner(existing)
        : initialState(now);
      const nextLeitner = advance({ state: priorLeitner, result, now });
      const nextRow = leitnerToRow(childId, word, nextLeitner, existing, result, now);
      try {
        await db.vocabState.put(nextRow);
      } catch {
        // Dexie may be unavailable; UI state update below keeps the session
        // consistent for the rest of the lesson.
      }
      setStates((prev) => {
        const out = prev.filter((r) => r.word !== word);
        out.push({
          word,
          box: nextLeitner.box,
          due_at: nextLeitner.dueAt,
          last_practiced_at: now,
        });
        return out;
      });
    },
    [childId],
  );

  return { states, loading, recordOutcome, refresh };
}
