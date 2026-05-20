import { describe, expect, it } from 'vitest';
import { gardenSummary, wordGardenStage } from './garden';

describe('wordGardenStage', () => {
  it('maps each Leitner box to its stage', () => {
    expect(wordGardenStage(1)).toBe('seed');
    expect(wordGardenStage(2)).toBe('sprout');
    expect(wordGardenStage(3)).toBe('bud');
    expect(wordGardenStage(4)).toBe('bloom');
    expect(wordGardenStage(5)).toBe('star');
  });
});

describe('gardenSummary', () => {
  it('returns zeros for empty input', () => {
    expect(gardenSummary([])).toEqual({
      seed: 0,
      sprout: 0,
      bud: 0,
      bloom: 0,
      star: 0,
    });
  });

  it('aggregates correctly across stages', () => {
    expect(
      gardenSummary([
        { word: 'cat', box: 1 },
        { word: 'dog', box: 1 },
        { word: 'fish', box: 2 },
        { word: 'apple', box: 4 },
        { word: 'banana', box: 4 },
        { word: 'mom', box: 5 },
      ]),
    ).toEqual({
      seed: 2,
      sprout: 1,
      bud: 0,
      bloom: 2,
      star: 1,
    });
  });
});
