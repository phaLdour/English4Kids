import { describe, expect, it } from 'vitest';
import { LEITNER_INTERVAL_DAYS, advance, initialState, type LeitnerState } from './leitner';

const T0 = new Date('2026-01-01T00:00:00.000Z');

function stateAt(box: 1 | 2 | 3 | 4 | 5, consecutive = 0): LeitnerState {
  return {
    box,
    consecutiveCorrect: consecutive,
    lastSeenAt: null,
    dueAt: new Date(T0.getTime()),
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

describe('initialState', () => {
  it('returns Box 1 due now with no history', () => {
    const s = initialState(T0);
    expect(s.box).toBe(1);
    expect(s.consecutiveCorrect).toBe(0);
    expect(s.lastSeenAt).toBeNull();
    expect(s.dueAt.getTime()).toBe(T0.getTime());
  });
});

describe('advance — correct answers (promotion path)', () => {
  it('Box 1 + correct → Box 2, due in 2 days', () => {
    const next = advance({ state: stateAt(1), result: 'correct', now: T0 });
    expect(next.box).toBe(2);
    expect(next.consecutiveCorrect).toBe(1);
    expect(next.lastSeenAt).toEqual(T0);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[2]);
  });

  it('Box 2 + correct → Box 3, due in 5 days', () => {
    const next = advance({ state: stateAt(2, 1), result: 'correct', now: T0 });
    expect(next.box).toBe(3);
    expect(next.consecutiveCorrect).toBe(2);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[3]);
  });

  it('Box 3 + correct → Box 4, due in 12 days', () => {
    const next = advance({ state: stateAt(3, 2), result: 'correct', now: T0 });
    expect(next.box).toBe(4);
    expect(next.consecutiveCorrect).toBe(3);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[4]);
  });

  it('Box 4 + first correct (consecutive 0 → 1) → stays Box 4', () => {
    const next = advance({ state: stateAt(4, 0), result: 'correct', now: T0 });
    expect(next.box).toBe(4);
    expect(next.consecutiveCorrect).toBe(1);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[4]);
  });

  it('Box 4 + 2 consecutive correct → Box 5, due in 30 days', () => {
    const next = advance({ state: stateAt(4, 1), result: 'correct', now: T0 });
    expect(next.box).toBe(5);
    expect(next.consecutiveCorrect).toBe(2);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[5]);
  });

  it('Box 5 + correct → stays Box 5, due in 30 days', () => {
    const next = advance({ state: stateAt(5, 5), result: 'correct', now: T0 });
    expect(next.box).toBe(5);
    expect(next.consecutiveCorrect).toBe(6);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[5]);
  });
});

describe('advance — incorrect answers (demotion path)', () => {
  it('Box 1 + incorrect → stays Box 1, due in 1 day', () => {
    const next = advance({ state: stateAt(1, 0), result: 'incorrect', now: T0 });
    expect(next.box).toBe(1);
    expect(next.consecutiveCorrect).toBe(0);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[1]);
  });

  it('Box 2 + incorrect → stays Box 2 (no demotion rule)', () => {
    const next = advance({ state: stateAt(2, 1), result: 'incorrect', now: T0 });
    expect(next.box).toBe(2);
    expect(next.consecutiveCorrect).toBe(0);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[2]);
  });

  it('Box 3 + incorrect → Box 2', () => {
    const next = advance({ state: stateAt(3, 2), result: 'incorrect', now: T0 });
    expect(next.box).toBe(2);
    expect(next.consecutiveCorrect).toBe(0);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[2]);
  });

  it('Box 4 + incorrect → Box 3, resets consecutive', () => {
    const next = advance({ state: stateAt(4, 1), result: 'incorrect', now: T0 });
    expect(next.box).toBe(3);
    expect(next.consecutiveCorrect).toBe(0);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[3]);
  });

  it('Box 5 + incorrect → Box 3, resets consecutive', () => {
    const next = advance({ state: stateAt(5, 4), result: 'incorrect', now: T0 });
    expect(next.box).toBe(3);
    expect(next.consecutiveCorrect).toBe(0);
    expect(daysBetween(T0, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[3]);
  });
});

describe('advance — purity & metadata', () => {
  it('does not mutate the input state', () => {
    const before = stateAt(3, 2);
    const snapshot = { ...before, dueAt: new Date(before.dueAt.getTime()) };
    advance({ state: before, result: 'correct', now: T0 });
    expect(before.box).toBe(snapshot.box);
    expect(before.consecutiveCorrect).toBe(snapshot.consecutiveCorrect);
    expect(before.dueAt.getTime()).toBe(snapshot.dueAt.getTime());
  });

  it('uses `now` for both lastSeenAt and dueAt baseline', () => {
    const t = new Date('2026-06-15T12:34:56.000Z');
    const next = advance({ state: stateAt(1), result: 'correct', now: t });
    expect(next.lastSeenAt).toEqual(t);
    expect(daysBetween(t, next.dueAt)).toBe(LEITNER_INTERVAL_DAYS[2]);
  });

  it('Box 2 no-demotion rule confirmed under repeated incorrects', () => {
    let s = stateAt(2, 3);
    for (let i = 0; i < 5; i++) {
      s = advance({ state: s, result: 'incorrect', now: T0 });
      expect(s.box).toBe(2);
      expect(s.consecutiveCorrect).toBe(0);
    }
  });
});
