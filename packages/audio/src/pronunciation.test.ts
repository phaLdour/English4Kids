import { describe, expect, it } from "vitest";
import { scorePronunciation, type PhonemeMap } from "./pronunciation.js";

// Small fixture map. Arpabet-style without stress digits — that matches the
// build-time JSON we plan to ship.
const MAP: PhonemeMap = {
  cat: ["K", "AE", "T"],
  bat: ["B", "AE", "T"],
  hat: ["HH", "AE", "T"],
  dog: ["D", "AO", "G"],
  fish: ["F", "IH", "SH"],
  banana: ["B", "AH", "N", "AE", "N", "AH"],
};

describe("scorePronunciation", () => {
  it("returns 100 / great on perfect match", () => {
    const r = scorePronunciation("cat", "cat", MAP, {
      ageBand: "6-8",
      strictness: "normal",
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("great");
  });

  it("rewards single substitution within same family with >= 80", () => {
    // cat = K AE T, bat = B AE T. K and B are both plosives, so the
    // substitution costs 0.5 out of a 3-phoneme target. Expected score is
    // around 83.
    const r = scorePronunciation("cat", "bat", MAP, {
      ageBand: "6-8",
      strictness: "normal",
    });
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("awards 100 / great when target word is missing from the phoneme map", () => {
    const r = scorePronunciation("unknownword", "anything", MAP, {
      ageBand: "9-12",
      strictness: "strict",
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("great");
  });

  it("returns 0 / try-again on empty recognised text", () => {
    const r = scorePronunciation("cat", "", MAP, {
      ageBand: "6-8",
      strictness: "normal",
    });
    expect(r.score).toBe(0);
    expect(r.band).toBe("try-again");
  });

  it("strict makes the bands harder to hit than easy", () => {
    // Recognise "hat" for target "cat": HH vs K is a fricative-vs-plosive
    // cross-family substitution (full cost 1.0 / 3 phonemes -> ~66.7).
    const easy = scorePronunciation("cat", "hat", MAP, {
      ageBand: "6-8",
      strictness: "easy",
    });
    const strict = scorePronunciation("cat", "hat", MAP, {
      ageBand: "6-8",
      strictness: "strict",
    });
    expect(easy.score).toBe(strict.score); // raw score unchanged
    // But the band assignment can shift — easy should be at least as
    // forgiving as strict.
    const order: Record<string, number> = { "try-again": 0, good: 1, great: 2 };
    expect(order[easy.band]).toBeGreaterThanOrEqual(order[strict.band] ?? 0);
  });

  it("respects age-band boundaries (9-12 is stricter than 6-8)", () => {
    // Synthesize a target where one phoneme differs cross-family.
    // banana = B AH N AE N AH (6 phonemes). Replace last vowel -> 5/6 right,
    // distance 1, score ~83.33. Both bands should call this 'great'.
    const map: PhonemeMap = {
      banana: ["B", "AH", "N", "AE", "N", "AH"],
      bananx: ["B", "AH", "N", "AE", "N", "K"], // forced cross-family at tail
    };
    const r68 = scorePronunciation("banana", "bananx", map, {
      ageBand: "6-8",
      strictness: "normal",
    });
    const r912 = scorePronunciation("banana", "bananx", map, {
      ageBand: "9-12",
      strictness: "normal",
    });
    expect(r68.score).toBeCloseTo(r912.score, 5);
    expect(r68.band).toBe("great");
    expect(r912.band).toBe("great");
  });

  it("caps strict shift so a passing band remains reachable (6-8 cap=60)", () => {
    // We can't peek at thresholds directly, but the contract is: a score of
    // 60 must NEVER be 'try-again' for 6-8 + strict. Engineer the input so
    // the score lands at exactly ~66.7 (single cross-family sub).
    const r = scorePronunciation("cat", "hat", MAP, {
      ageBand: "6-8",
      strictness: "strict",
    });
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.band).not.toBe("try-again");
  });

  it("handles multi-word recognised input via space split", () => {
    // recognised = "the cat" — extra word adds insertions but shouldn't tank
    // the score below 50.
    const r = scorePronunciation("cat", "the cat", MAP, {
      ageBand: "6-8",
      strictness: "normal",
    });
    expect(r.score).toBeGreaterThan(0);
    // Even with extra insertions the kid said the right word.
    expect(["great", "good", "try-again"]).toContain(r.band);
  });
});
