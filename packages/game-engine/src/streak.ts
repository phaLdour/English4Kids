/**
 * Streak state machine.
 *
 * Safety red lines:
 *   - No "you broke your streak" copy. UI handles welcome-back gently.
 *   - One freeze auto-granted per Monday (cap 2). Skipping a single day with a freeze
 *     available preserves the streak silently.
 *
 * `lastActiveDay` is stored as a local-day ISO 'YYYY-MM-DD' string so that
 * timezone math lives at the caller boundary, not inside the engine.
 */

export interface StreakState {
  /** Consecutive active days. */
  current: number;
  longest: number;
  /** Local-day ISO 'YYYY-MM-DD'. */
  lastActiveDay: string;
  /** 0..2, auto-granted 1 per Monday. */
  freezesAvailable: number;
}

export interface StreakUpdate {
  state: StreakState;
  todayLocalDay: string;
  /** Reserved for locales that start the week on Sunday. Default true. */
  weekStartIsMonday?: boolean;
}

const MAX_FREEZES = 2;
const DAY_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertLocalDay(d: string): void {
  if (!DAY_ISO_RE.test(d)) {
    throw new Error(`Invalid local-day ISO string: ${d}`);
  }
}

/** Convert 'YYYY-MM-DD' to a UTC midnight Date for arithmetic. */
function dayToUtcDate(d: string): Date {
  assertLocalDay(d);
  return new Date(`${d}T00:00:00.000Z`);
}

/** Whole-day diff between two local-day strings (b - a). */
function dayDiff(a: string, b: string): number {
  const ms = dayToUtcDate(b).getTime() - dayToUtcDate(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Record activity for the given local-day. Idempotent for same-day calls.
 *
 * Transitions:
 *   - same day            → no change
 *   - next day (+1)       → current + 1
 *   - skipped 1 day (+2)  → if freeze available: consume, preserve current
 *                           else: reset to 1
 *   - skipped >1 day      → reset to 1
 *   - empty lastActiveDay → start at 1
 */
export function recordActivity(u: StreakUpdate): StreakState {
  const { state, todayLocalDay } = u;
  assertLocalDay(todayLocalDay);

  // First-ever activity (no prior lastActiveDay).
  if (!state.lastActiveDay) {
    const next: StreakState = {
      current: 1,
      longest: Math.max(state.longest, 1),
      lastActiveDay: todayLocalDay,
      freezesAvailable: state.freezesAvailable,
    };
    return next;
  }

  assertLocalDay(state.lastActiveDay);
  const diff = dayDiff(state.lastActiveDay, todayLocalDay);

  // Same day — idempotent.
  if (diff === 0) {
    return { ...state };
  }

  // Future date in the past? Defensive: treat as no-op rather than throw.
  if (diff < 0) {
    return { ...state };
  }

  // Consecutive day.
  if (diff === 1) {
    const current = state.current + 1;
    return {
      current,
      longest: Math.max(state.longest, current),
      lastActiveDay: todayLocalDay,
      freezesAvailable: state.freezesAvailable,
    };
  }

  // Skipped exactly one day: try to consume a freeze.
  if (diff === 2 && state.freezesAvailable > 0) {
    const current = state.current + 1;
    return {
      current,
      longest: Math.max(state.longest, current),
      lastActiveDay: todayLocalDay,
      freezesAvailable: state.freezesAvailable - 1,
    };
  }

  // Otherwise, reset to a new streak of 1 (this session counts as the new start).
  return {
    current: 1,
    longest: Math.max(state.longest, 1),
    lastActiveDay: todayLocalDay,
    freezesAvailable: state.freezesAvailable,
  };
}

/**
 * Grant a weekly freeze, idempotent per Monday — caller must pass a Monday local-day.
 * Caps at MAX_FREEZES (2). If already at cap, no-op.
 *
 * Caller is expected to invoke this once at session start when the current local-day
 * is a Monday and `state.lastActiveDay` is from a prior week (the dedupe lives at the
 * call site / DB layer; this function itself is pure and cap-bounded).
 */
export function grantWeeklyFreeze(args: {
  state: StreakState;
  mondayLocalDay: string;
}): StreakState {
  assertLocalDay(args.mondayLocalDay);
  if (args.state.freezesAvailable >= MAX_FREEZES) {
    return { ...args.state };
  }
  return {
    ...args.state,
    freezesAvailable: args.state.freezesAvailable + 1,
  };
}

/** Initial empty streak. */
export function initialStreak(): StreakState {
  return {
    current: 0,
    longest: 0,
    lastActiveDay: '',
    freezesAvailable: 0,
  };
}

export const STREAK_MAX_FREEZES = MAX_FREEZES;
