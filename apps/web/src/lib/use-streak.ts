'use client';

import {
  getSetting,
  setSetting,
} from '@e4k/db';
import {
  grantWeeklyFreeze,
  initialStreak,
  recordActivity,
  type StreakState,
} from '@e4k/game-engine';
import { useCallback, useEffect, useState } from 'react';

const STREAK_STATE_KEY = 'streak.state';
const STREAK_LAST_FREEZE_GRANT_KEY = 'streak.lastFreezeGrant';

function isoLocalDay(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isMonday(d: Date = new Date()): boolean {
  return d.getDay() === 1;
}

export interface UseStreakReturn {
  state: StreakState;
  loading: boolean;
  recordToday: () => Promise<void>;
  grantWeeklyFreezeIfMonday: () => Promise<void>;
  /** True iff the previous active day is strictly before today's local-day. */
  isReturningToday: boolean;
}

/**
 * Read + write the streak state stored under `settings['streak.state']`.
 *
 * `recordToday()` is idempotent for same-day calls (delegates to engine).
 * `grantWeeklyFreezeIfMonday()` dedupes via `streak.lastFreezeGrant` to ensure
 * at most one grant per Monday even if the app is reopened multiple times.
 */
export function useStreak(): UseStreakReturn {
  const [state, setState] = useState<StreakState>(initialStreak());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prior = await getSetting<StreakState>(STREAK_STATE_KEY, initialStreak());
        if (!cancelled) setState(prior);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordToday = useCallback(async () => {
    const today = isoLocalDay();
    const prior = await getSetting<StreakState>(STREAK_STATE_KEY, initialStreak());
    const next = recordActivity({ state: prior, todayLocalDay: today });
    await setSetting(STREAK_STATE_KEY, next);
    setState(next);
  }, []);

  const grantWeeklyFreezeIfMonday = useCallback(async () => {
    const now = new Date();
    if (!isMonday(now)) return;
    const today = isoLocalDay(now);
    const lastGrant = await getSetting<string>(STREAK_LAST_FREEZE_GRANT_KEY, '');
    if (lastGrant === today) return;
    const prior = await getSetting<StreakState>(STREAK_STATE_KEY, initialStreak());
    const next = grantWeeklyFreeze({ state: prior, mondayLocalDay: today });
    await setSetting(STREAK_STATE_KEY, next);
    await setSetting(STREAK_LAST_FREEZE_GRANT_KEY, today);
    setState(next);
  }, []);

  const today = isoLocalDay();
  const isReturningToday =
    !!state.lastActiveDay && state.lastActiveDay !== '' && state.lastActiveDay < today;

  return {
    state,
    loading,
    recordToday,
    grantWeeklyFreezeIfMonday,
    isReturningToday,
  };
}
