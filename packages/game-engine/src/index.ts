/**
 * @e4k/game-engine — pure-TS engine for spaced repetition, stars, streak, garden.
 *
 * Pure functions, no DOM, no side effects, no runtime deps.
 */

export {
  LEITNER_INTERVAL_DAYS,
  advance,
  initialState,
  type LeitnerBox,
  type LeitnerState,
  type LeitnerUpdate,
} from './leitner';

export {
  calculateStars,
  type ActivityKind,
  type AttemptResult,
  type StarCount,
} from './stars';

export {
  STREAK_MAX_FREEZES,
  grantWeeklyFreeze,
  initialStreak,
  recordActivity,
  type StreakState,
  type StreakUpdate,
} from './streak';

export {
  gardenSummary,
  wordGardenStage,
  type GardenStage,
  type GardenSummary,
  type GardenWord,
} from './garden';
