import { describe, expect, it } from 'vitest';
import { isShineReplay } from './replay-detection';

describe('isShineReplay', () => {
  it('is NOT a replay on first completion (prev 0, new 3)', () => {
    const r = isShineReplay(0, 3);
    expect(r.isReplay).toBe(false);
    expect(r.gainedStars).toBe(0);
  });

  it('is a replay when stars improved (prev 1, new 3)', () => {
    const r = isShineReplay(1, 3);
    expect(r.isReplay).toBe(true);
    expect(r.gainedStars).toBe(2);
  });

  it('is NOT a replay when stars are equal (prev 3, new 3)', () => {
    const r = isShineReplay(3, 3);
    expect(r.isReplay).toBe(false);
    expect(r.gainedStars).toBe(0);
  });

  it('is NOT a replay when stars dropped (prev 3, new 2)', () => {
    const r = isShineReplay(3, 2);
    expect(r.isReplay).toBe(false);
    expect(r.gainedStars).toBe(0);
  });

  it('counts a single-star jump (prev 1, new 2)', () => {
    const r = isShineReplay(1, 2);
    expect(r.isReplay).toBe(true);
    expect(r.gainedStars).toBe(1);
  });
});
