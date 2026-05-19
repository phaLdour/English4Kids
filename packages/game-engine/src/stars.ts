/**
 * Star scoring for a single lesson.
 *
 * Pedagogy red lines:
 *   - We NEVER penalize pronunciation. `speak_it.attempted = true` is enough.
 *   - `story_time` and `sing_along` are not gating; they're for joy/exposure.
 *
 * Rules:
 *   1 star = at least one activity was attempted in the lesson.
 *   2 stars = ≥70% first-attempt accuracy across `listen_tap` + `word_builder`.
 *   3 stars = ≥90% first-attempt accuracy across `listen_tap` + `word_builder`
 *             AND every `speak_it` attempt has `attempted = true`.
 */

export type ActivityKind =
  | 'listen_tap'
  | 'word_builder'
  | 'speak_it'
  | 'story_time'
  | 'sing_along';

export interface AttemptResult {
  activityType: ActivityKind;
  firstAttemptCorrect: boolean;
  /** For speak_it: 'attempted' is enough; passing not required. */
  attempted: boolean;
}

export type StarCount = 0 | 1 | 2 | 3;

const TWO_STAR_THRESHOLD = 0.7;
const THREE_STAR_THRESHOLD = 0.9;

/**
 * Compute star count from a list of attempt results for one lesson.
 */
export function calculateStars(attempts: AttemptResult[]): StarCount {
  if (attempts.length === 0) return 0;

  const anyAttempted = attempts.some((a) => a.attempted);
  if (!anyAttempted) return 0;

  // L&T + WB pool used for accuracy gates.
  const gradedPool = attempts.filter(
    (a) => a.activityType === 'listen_tap' || a.activityType === 'word_builder',
  );

  // Speak-it attempts: every one must be `attempted` for 3 stars.
  const speakAttempts = attempts.filter((a) => a.activityType === 'speak_it');
  const allSpeakAttempted =
    speakAttempts.length === 0 || speakAttempts.every((a) => a.attempted);

  if (gradedPool.length === 0) {
    // Only story/sing/speak attempts present — at most 1 star.
    return 1;
  }

  const correct = gradedPool.filter((a) => a.firstAttemptCorrect).length;
  const accuracy = correct / gradedPool.length;

  if (accuracy >= THREE_STAR_THRESHOLD && allSpeakAttempted) return 3;
  if (accuracy >= TWO_STAR_THRESHOLD) return 2;
  return 1;
}
