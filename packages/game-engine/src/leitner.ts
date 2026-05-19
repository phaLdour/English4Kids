/**
 * Leitner 5-box spaced repetition.
 *
 * Pedagogy:
 *  - Box 1 (new):       correct → Box 2; incorrect → stays Box 1.
 *  - Box 2 (learning):  correct → Box 3; incorrect → stays Box 2 (no demotion).
 *  - Box 3 (familiar):  correct → Box 4; incorrect → Box 2.
 *  - Box 4 (known):     2 consecutive correct → Box 5; 1 incorrect → Box 3.
 *  - Box 5 (mastered):  stays; 1 incorrect → Box 3.
 *
 * `consecutiveCorrect` is tracked across reviews and gates Box 4 → 5 promotion.
 * Any incorrect answer resets `consecutiveCorrect` to 0.
 *
 * `dueAt` = now + INTERVAL_DAYS[newBox] days, computed from the `now` passed in.
 */

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface LeitnerState {
  box: LeitnerBox;
  consecutiveCorrect: number;
  lastSeenAt: Date | null;
  dueAt: Date;
}

export interface LeitnerUpdate {
  state: LeitnerState;
  result: 'correct' | 'incorrect';
  /** Defaults to `new Date()` if omitted. */
  now?: Date;
}

const INTERVAL_DAYS: Record<LeitnerBox, number> = {
  1: 1, // next day (massed practice within session handled elsewhere)
  2: 2,
  3: 5,
  4: 12,
  5: 30,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Compute the next Leitner state from a review outcome.
 *
 * Pure function: does not mutate the input state.
 */
export function advance(update: LeitnerUpdate): LeitnerState {
  const { state, result } = update;
  const now = update.now ?? new Date();

  let nextBox: LeitnerBox = state.box;
  let nextConsecutive = state.consecutiveCorrect;

  if (result === 'correct') {
    nextConsecutive = state.consecutiveCorrect + 1;
    switch (state.box) {
      case 1:
        nextBox = 2;
        break;
      case 2:
        nextBox = 3;
        break;
      case 3:
        nextBox = 4;
        break;
      case 4:
        // Need 2 consecutive correct to promote to Box 5.
        nextBox = nextConsecutive >= 2 ? 5 : 4;
        break;
      case 5:
        nextBox = 5;
        break;
    }
  } else {
    // incorrect
    nextConsecutive = 0;
    switch (state.box) {
      case 1:
        nextBox = 1;
        break;
      case 2:
        nextBox = 2; // no demotion from learning box
        break;
      case 3:
        nextBox = 2;
        break;
      case 4:
        nextBox = 3;
        break;
      case 5:
        nextBox = 3;
        break;
    }
  }

  const dueAt = addDays(now, INTERVAL_DAYS[nextBox]);

  return {
    box: nextBox,
    consecutiveCorrect: nextConsecutive,
    lastSeenAt: now,
    dueAt,
  };
}

/**
 * Initial state for a brand-new word: Box 1, due immediately.
 */
export function initialState(now: Date = new Date()): LeitnerState {
  return {
    box: 1,
    consecutiveCorrect: 0,
    lastSeenAt: null,
    dueAt: new Date(now.getTime()),
  };
}

/** Exposed for tests / UI display. */
export const LEITNER_INTERVAL_DAYS: Readonly<Record<LeitnerBox, number>> = INTERVAL_DAYS;
