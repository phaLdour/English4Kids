import { describe, expect, it } from 'vitest';
import { type AttemptResult, calculateStars } from './stars';

function lt(correct: boolean): AttemptResult {
  return { activityType: 'listen_tap', firstAttemptCorrect: correct, attempted: true };
}
function wb(correct: boolean): AttemptResult {
  return { activityType: 'word_builder', firstAttemptCorrect: correct, attempted: true };
}
function speak(attempted: boolean): AttemptResult {
  return { activityType: 'speak_it', firstAttemptCorrect: false, attempted };
}
function story(attempted = true): AttemptResult {
  return { activityType: 'story_time', firstAttemptCorrect: true, attempted };
}
function sing(attempted = true): AttemptResult {
  return { activityType: 'sing_along', firstAttemptCorrect: true, attempted };
}

describe('calculateStars', () => {
  it('empty attempts → 0 stars', () => {
    expect(calculateStars([])).toBe(0);
  });

  it('only non-attempted entries → 0 stars', () => {
    expect(
      calculateStars([
        { activityType: 'listen_tap', firstAttemptCorrect: false, attempted: false },
        { activityType: 'word_builder', firstAttemptCorrect: false, attempted: false },
      ]),
    ).toBe(0);
  });

  it('one attempt below 70% accuracy → 1 star', () => {
    expect(calculateStars([lt(false)])).toBe(1);
  });

  it('only story / sing attempts → 1 star (no graded pool)', () => {
    expect(calculateStars([story(), sing()])).toBe(1);
  });

  it('exactly 70% accuracy on L&T + WB → 2 stars', () => {
    // 7 of 10 correct → 0.70
    const arr: AttemptResult[] = [];
    for (let i = 0; i < 7; i++) arr.push(lt(true));
    for (let i = 0; i < 3; i++) arr.push(wb(false));
    expect(calculateStars(arr)).toBe(2);
  });

  it('80% accuracy without speak attempts → 2 stars', () => {
    const arr: AttemptResult[] = [
      lt(true),
      lt(true),
      wb(true),
      wb(true),
      lt(false),
    ];
    // 4/5 = 0.8, no speak — below 3-star threshold (needs 0.9)
    expect(calculateStars(arr)).toBe(2);
  });

  it('90% accuracy AND all speak attempted → 3 stars', () => {
    const arr: AttemptResult[] = [];
    for (let i = 0; i < 9; i++) arr.push(lt(true));
    arr.push(wb(false));
    arr.push(speak(true));
    arr.push(speak(true));
    expect(calculateStars(arr)).toBe(3);
  });

  it('100% accuracy and no speak items at all → 3 stars', () => {
    const arr: AttemptResult[] = [lt(true), wb(true), lt(true), wb(true)];
    expect(calculateStars(arr)).toBe(3);
  });

  it('90% accuracy but missing speak attempts (one not attempted) → 2 stars', () => {
    const arr: AttemptResult[] = [];
    for (let i = 0; i < 9; i++) arr.push(lt(true));
    arr.push(wb(false));
    arr.push(speak(true));
    arr.push(speak(false)); // skipped
    expect(calculateStars(arr)).toBe(2);
  });

  it('story_time and sing_along do not influence accuracy gate', () => {
    // 70% L&T+WB, plus lots of story/sing — still 2 stars (story doesn't bump us to 3)
    const arr: AttemptResult[] = [
      lt(true),
      lt(true),
      lt(true),
      lt(true),
      lt(true),
      lt(true),
      lt(true),
      wb(false),
      wb(false),
      wb(false),
      story(),
      sing(),
    ];
    expect(calculateStars(arr)).toBe(2);
  });

  it('60% accuracy → 1 star (below 2-star threshold)', () => {
    const arr: AttemptResult[] = [
      lt(true),
      lt(true),
      lt(true),
      wb(false),
      wb(false),
    ];
    // 3/5 = 0.6
    expect(calculateStars(arr)).toBe(1);
  });

  it('speak_it never penalizes accuracy (firstAttemptCorrect false but attempted)', () => {
    // All L&T+WB correct, all speak attempts logged as attempted.
    const arr: AttemptResult[] = [
      lt(true),
      lt(true),
      wb(true),
      wb(true),
      speak(true),
      speak(true),
      speak(true),
    ];
    expect(calculateStars(arr)).toBe(3);
  });
});
