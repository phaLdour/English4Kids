import { describe, expect, it } from 'vitest';
import { BANNED_PHRASINGS, containsBannedPhrasing } from './banned-words';

describe('containsBannedPhrasing', () => {
  it('exposes the full banned list', () => {
    expect(BANNED_PHRASINGS).toContain('wrong');
    expect(BANNED_PHRASINGS).toContain("you're smart");
  });

  it('returns no matches for empty / clean text', () => {
    expect(containsBannedPhrasing('')).toEqual({ found: false, matches: [] });
    expect(containsBannedPhrasing('You got it! Great job!').found).toBe(false);
    expect(containsBannedPhrasing('Let us try one more.').found).toBe(false);
  });

  it('catches "Wrong!" (case-insensitive, trailing punctuation)', () => {
    const r = containsBannedPhrasing('Wrong!');
    expect(r.found).toBe(true);
    expect(r.matches).toContain('wrong');
  });

  it('catches "no!" but not "no thanks"', () => {
    expect(containsBannedPhrasing('No!').matches).toContain('no!');
    expect(containsBannedPhrasing('no, try again').matches).not.toContain('no!');
  });

  it('catches "you are smart!" via alt-form mapping', () => {
    // The canonical entry is "you're smart"; the alt-matcher catches
    // the expanded form and reports it under the canonical phrase.
    const r = containsBannedPhrasing('You are smart!');
    expect(r.found).toBe(true);
    expect(r.matches).toContain("you're smart");
  });

  it('passes "you got it"', () => {
    expect(containsBannedPhrasing('you got it').found).toBe(false);
  });

  it('does not flag substrings inside larger words', () => {
    // "wrongful" should not trigger the "wrong" phrasing.
    expect(containsBannedPhrasing('a wrongful event').matches).not.toContain('wrong');
    // "badge" should not trigger "bad".
    expect(containsBannedPhrasing('Earn a badge!').matches).not.toContain('bad');
  });

  it('catches "incorrect" and "failed"', () => {
    expect(containsBannedPhrasing('That is incorrect.').matches).toContain('incorrect');
    expect(containsBannedPhrasing('You failed.').matches).toContain('failed');
  });

  it('catches "easy!" but not "easygoing"', () => {
    expect(containsBannedPhrasing('Easy!').matches).toContain('easy!');
    expect(containsBannedPhrasing('She is easygoing').found).toBe(false);
  });
});
