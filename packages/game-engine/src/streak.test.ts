import { describe, expect, it } from 'vitest';
import {
  STREAK_MAX_FREEZES,
  type StreakState,
  grantWeeklyFreeze,
  initialStreak,
  recordActivity,
} from './streak';

function base(overrides: Partial<StreakState> = {}): StreakState {
  return {
    current: 3,
    longest: 5,
    lastActiveDay: '2026-05-11', // a Monday
    freezesAvailable: 0,
    ...overrides,
  };
}

describe('initialStreak', () => {
  it('returns empty streak', () => {
    expect(initialStreak()).toEqual({
      current: 0,
      longest: 0,
      lastActiveDay: '',
      freezesAvailable: 0,
    });
  });
});

describe('recordActivity', () => {
  it('first-ever activity starts streak at 1', () => {
    const next = recordActivity({
      state: initialStreak(),
      todayLocalDay: '2026-05-19',
    });
    expect(next.current).toBe(1);
    expect(next.longest).toBe(1);
    expect(next.lastActiveDay).toBe('2026-05-19');
  });

  it('same day → idempotent, no change', () => {
    const s = base({ lastActiveDay: '2026-05-19', current: 4 });
    const next = recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(next.current).toBe(4);
    expect(next.lastActiveDay).toBe('2026-05-19');
  });

  it('next day → current + 1', () => {
    const s = base({ lastActiveDay: '2026-05-18', current: 4 });
    const next = recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(next.current).toBe(5);
    expect(next.lastActiveDay).toBe('2026-05-19');
    expect(next.longest).toBe(5); // matched previous longest (5)
  });

  it('next day updates longest when surpassed', () => {
    const s = base({ lastActiveDay: '2026-05-18', current: 5, longest: 5 });
    const next = recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(next.current).toBe(6);
    expect(next.longest).toBe(6);
  });

  it('skipped 1 day with freeze available → consumes freeze, preserves & extends streak', () => {
    const s = base({
      lastActiveDay: '2026-05-17',
      current: 7,
      longest: 8,
      freezesAvailable: 2,
    });
    const next = recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(next.current).toBe(8);
    expect(next.freezesAvailable).toBe(1);
    expect(next.lastActiveDay).toBe('2026-05-19');
  });

  it('skipped 1 day with no freeze → resets to 1', () => {
    const s = base({
      lastActiveDay: '2026-05-17',
      current: 7,
      longest: 9,
      freezesAvailable: 0,
    });
    const next = recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(next.current).toBe(1);
    expect(next.longest).toBe(9); // longest preserved
    expect(next.lastActiveDay).toBe('2026-05-19');
  });

  it('skipped >1 day → resets to 1 regardless of freezes', () => {
    const s = base({
      lastActiveDay: '2026-05-10',
      current: 7,
      longest: 9,
      freezesAvailable: 2,
    });
    const next = recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(next.current).toBe(1);
    expect(next.freezesAvailable).toBe(2); // freezes not consumed
    expect(next.lastActiveDay).toBe('2026-05-19');
  });

  it('does not mutate input state', () => {
    const s = base({ lastActiveDay: '2026-05-18', current: 4 });
    const snapshot = { ...s };
    recordActivity({ state: s, todayLocalDay: '2026-05-19' });
    expect(s).toEqual(snapshot);
  });

  it('throws on malformed local-day input', () => {
    expect(() =>
      recordActivity({ state: base(), todayLocalDay: '2026/05/19' as unknown as string }),
    ).toThrow();
  });
});

describe('grantWeeklyFreeze', () => {
  it('+1 freeze when below cap', () => {
    const s = base({ freezesAvailable: 0 });
    const next = grantWeeklyFreeze({ state: s, mondayLocalDay: '2026-05-18' });
    expect(next.freezesAvailable).toBe(1);
  });

  it('+1 freeze stacks up to cap of 2', () => {
    const s = base({ freezesAvailable: 1 });
    const next = grantWeeklyFreeze({ state: s, mondayLocalDay: '2026-05-18' });
    expect(next.freezesAvailable).toBe(2);
    expect(STREAK_MAX_FREEZES).toBe(2);
  });

  it('no-op when at cap', () => {
    const s = base({ freezesAvailable: 2 });
    const next = grantWeeklyFreeze({ state: s, mondayLocalDay: '2026-05-18' });
    expect(next.freezesAvailable).toBe(2);
  });

  it('does not mutate input state', () => {
    const s = base({ freezesAvailable: 0 });
    const snapshot = { ...s };
    grantWeeklyFreeze({ state: s, mondayLocalDay: '2026-05-18' });
    expect(s).toEqual(snapshot);
  });
});
