import { describe, expect, it } from 'vitest';
import {
  WordBuilderItemSchema,
  UnitSchema,
  checkWordBuilderConsistency,
  type WordBuilderItem,
} from './schemas';

const baseItem = {
  id: 'wb-test',
  type: 'word_builder' as const,
  ageBand: '9-12' as const,
  targetWord: 'cat',
  promptAudio: 'prompt.cat',
  promptTranscript: 'Spell: cat.',
};

describe('WordBuilderItemSchema', () => {
  it('accepts a well-formed letter_spell item with single-char pool', () => {
    const item = {
      ...baseItem,
      variant: 'letter_spell' as const,
      letterPool: ['c', 'a', 't', 'p', 'o'],
    };
    const parsed = WordBuilderItemSchema.parse(item);
    expect(parsed.variant).toBe('letter_spell');
    expect(checkWordBuilderConsistency(parsed)).toEqual([]);
  });

  it('accepts a sentence_chunks item whose pool covers every target token', () => {
    const item = {
      ...baseItem,
      variant: 'sentence_chunks' as const,
      targetWord: 'a bird can fly',
      letterPool: ['a', 'bird', 'can', 'fly', 'fish', 'swim', 'walk'],
    };
    const parsed = WordBuilderItemSchema.parse(item);
    expect(parsed.variant).toBe('sentence_chunks');
    expect(checkWordBuilderConsistency(parsed)).toEqual([]);
  });

  it('the object schema alone does not enforce cross-field rules (kept simple for discriminatedUnion)', () => {
    // The object schema parses successfully; the consistency check is what catches the bug.
    const bad: WordBuilderItem = {
      ...baseItem,
      variant: 'letter_spell',
      targetWord: 'a bird can fly',
      letterPool: ['a', 'bird', 'can', 'fly'],
    };
    expect(() => WordBuilderItemSchema.parse(bad)).not.toThrow();
    const issues = checkWordBuilderConsistency(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/single characters only/);
  });

  it('checkWordBuilderConsistency rejects sentence_chunks missing a required token', () => {
    const bad: WordBuilderItem = {
      ...baseItem,
      variant: 'sentence_chunks',
      targetWord: 'a bird can fly',
      letterPool: ['a', 'bird', 'can'],
    };
    const issues = checkWordBuilderConsistency(bad);
    expect(issues.some((m) => m.includes('"fly"'))).toBe(true);
  });
});

describe('UnitSchema cross-item refinement (CI lint)', () => {
  function unitWithItem(item: unknown): unknown {
    return {
      id: 'u-test',
      title: 'Test Unit',
      theme: 'test',
      cefr: 'A1',
      orderIndex: 0,
      lessons: [
        {
          id: 'l1',
          title: 'L1',
          miniTheme: 'm',
          orderIndex: 0,
          vocabRefs: [],
          activities: [
            { id: 'a1', type: 'word_builder', title: 'WB', items: [item] },
          ],
        },
      ],
    };
  }

  it('fails a unit whose word_builder mixes letter_spell with multi-char tokens', () => {
    const unit = unitWithItem({
      ...baseItem,
      variant: 'letter_spell',
      targetWord: 'a bird can fly',
      letterPool: ['a', 'bird', 'can', 'fly'],
    });
    expect(() => UnitSchema.parse(unit)).toThrow(/single characters only/);
  });

  it('accepts a unit whose word_builder uses sentence_chunks correctly', () => {
    const unit = unitWithItem({
      ...baseItem,
      variant: 'sentence_chunks',
      targetWord: 'a bird can fly',
      letterPool: ['a', 'bird', 'can', 'fly', 'fish', 'swim'],
    });
    expect(() => UnitSchema.parse(unit)).not.toThrow();
  });
});
