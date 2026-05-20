/**
 * Replay detection for "Made it Shine!" copy.
 *
 * If a child replays a lesson and earns more stars than before, we celebrate
 * the improvement with a dedicated message. The pure helper keeps the logic
 * trivially unit-testable.
 *
 * Semantics:
 *   - `prevStars === 0` means no prior completion, so a fresh result is the
 *     first time through (NOT a "made it shine" replay).
 *   - `prevStars > 0` AND `newStars > prevStars` is the replay case.
 *   - Equal or lower star count on a re-run is celebrated as normal.
 */

export interface ReplayResult {
  isReplay: boolean;
  gainedStars: number;
}

export function isShineReplay(prevStars: number, newStars: number): ReplayResult {
  const isReplay = prevStars > 0 && newStars > prevStars;
  const gainedStars = isReplay ? newStars - prevStars : 0;
  return { isReplay, gainedStars };
}
