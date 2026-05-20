import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory mock for the Dexie-backed settings layer. The test mutates this
// map between cases to exercise each `mascot.choice` branch.
const settings = new Map<string, unknown>();

vi.mock('@e4k/db', () => ({
  getSetting: async <T,>(key: string, fallback: T): Promise<T> => {
    if (settings.has(key)) return settings.get(key) as T;
    return fallback;
  },
  setSetting: async (key: string, value: unknown): Promise<void> => {
    settings.set(key, value);
  },
}));

import {
  __hashForTests,
  getActiveMascot,
  resolveNarrationAsset,
} from './mascot-voice';

describe('mascot-voice', () => {
  beforeEach(() => {
    settings.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveMascot', () => {
    it("returns 'milo' when the setting is 'milo'", async () => {
      settings.set('mascot.choice', 'milo');
      await expect(getActiveMascot('any-activity')).resolves.toBe('milo');
    });

    it("returns 'luna' when the setting is 'luna'", async () => {
      settings.set('mascot.choice', 'luna');
      await expect(getActiveMascot('any-activity')).resolves.toBe('luna');
    });

    it("defaults to 'milo' when the setting is unset", async () => {
      await expect(getActiveMascot('any-activity')).resolves.toBe('milo');
    });

    it("with 'both' is deterministic for a given activity id across calls", async () => {
      settings.set('mascot.choice', 'both');
      const id = 'unit-1-activity-3';
      const first = await getActiveMascot(id);
      const second = await getActiveMascot(id);
      const third = await getActiveMascot(id);
      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it("with 'both' alternates across at least some activity ids", async () => {
      settings.set('mascot.choice', 'both');
      const candidates = Array.from({ length: 30 }, (_, i) => `act-${i}`);
      const results = await Promise.all(candidates.map((id) => getActiveMascot(id)));
      // Confirm we actually see both — not all-milo or all-luna.
      expect(results).toContain('milo');
      expect(results).toContain('luna');
    });

    it("with 'both' and no activity id returns 'milo' (stable default)", async () => {
      settings.set('mascot.choice', 'both');
      await expect(getActiveMascot()).resolves.toBe('milo');
    });
  });

  describe('resolveNarrationAsset', () => {
    it('swaps vo.milo.* to vo.luna.* when active mascot is luna and the variant exists', () => {
      const map = {
        'vo.luna.greet': {
          src: '/audio/vo-luna-greet.opus',
          lang: 'en-GB',
          durationSec: 1.2,
          transcript: 'Hello.',
          type: 'narration' as const,
          license: 'CC0' as const,
        },
      };
      expect(resolveNarrationAsset('vo.milo.greet', 'luna', map)).toBe('vo.luna.greet');
    });

    it('swaps vo.luna.* to vo.milo.* when active mascot is milo and the variant exists', () => {
      const map = {
        'vo.milo.greet': {
          src: '/audio/vo-milo-greet.opus',
          lang: 'en-US',
          durationSec: 1.1,
          transcript: 'Hello.',
          type: 'narration' as const,
          license: 'CC0' as const,
        },
      };
      expect(resolveNarrationAsset('vo.luna.greet', 'milo', map)).toBe('vo.milo.greet');
    });

    it('falls back to the original id when the swapped variant is missing', () => {
      // Only the Milo asset exists; requesting Luna should not invent an id.
      const map = {
        'vo.milo.greet': {
          src: '/audio/vo-milo-greet.opus',
          lang: 'en-US',
          durationSec: 1.1,
          transcript: 'Hello.',
          type: 'narration' as const,
          license: 'CC0' as const,
        },
      };
      expect(resolveNarrationAsset('vo.milo.greet', 'luna', map)).toBe('vo.milo.greet');
    });

    it('returns the input unchanged when the asset id is not a mascot voiceover', () => {
      expect(resolveNarrationAsset('sfx.tap', 'luna')).toBe('sfx.tap');
      expect(resolveNarrationAsset('song.greetings', 'milo')).toBe('song.greetings');
    });

    it('returns the input unchanged when the active mascot already matches the namespace', () => {
      expect(resolveNarrationAsset('vo.milo.greet', 'milo')).toBe('vo.milo.greet');
      expect(resolveNarrationAsset('vo.luna.greet', 'luna')).toBe('vo.luna.greet');
    });

    it('without an audio map, always attempts the swap (no fallback)', () => {
      expect(resolveNarrationAsset('vo.milo.greet', 'luna')).toBe('vo.luna.greet');
      expect(resolveNarrationAsset('vo.luna.greet', 'milo')).toBe('vo.milo.greet');
    });
  });

  describe('hash determinism', () => {
    it('produces the same value for the same input', () => {
      expect(__hashForTests('unit-1-activity-3')).toBe(__hashForTests('unit-1-activity-3'));
    });
    it('produces different values for different inputs (smoke)', () => {
      expect(__hashForTests('a')).not.toBe(__hashForTests('b'));
    });
  });
});
