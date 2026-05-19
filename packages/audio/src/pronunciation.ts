// Pronunciation scoring — weighted phoneme Levenshtein with kid-friendly
// tolerances and age-banded thresholds.
//
// Design notes:
//   * No runtime g2p or CMU dict lookup. Phoneme arrays are pre-computed at
//     build time and shipped as JSON, then handed to this function as
//     `phonemeMap`.
//   * If a target word is not in the map we deliberately award 100 / 'great'.
//     Pedagogy red line: never punish a child for a missing dictionary entry.
//   * Strictness shift cannot push the try-again threshold above 60 (6-8) or
//     70 (9-12) — the rubric must always allow a passing band after 3
//     attempts.

export type AgeBand = "6-8" | "9-12";
export type Strictness = "easy" | "normal" | "strict";
export type PronunciationBand = "great" | "good" | "try-again";
export type PhonemeMap = Record<string, string[]>;

export interface PronunciationScoreResult {
  score: number; // 0..100
  band: PronunciationBand;
}

// Simplified phonological families (Arpabet-ish, no stress digits).
const VOWELS = new Set([
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "EH",
  "ER",
  "EY",
  "IH",
  "IY",
  "OW",
  "OY",
  "UH",
  "UW",
]);
const PLOSIVES = new Set(["P", "B", "T", "D", "K", "G"]);
const FRICATIVES = new Set(["F", "V", "S", "Z", "SH", "ZH", "TH", "DH", "HH"]);
const NASALS = new Set(["M", "N", "NG"]);
const LIQUIDS = new Set(["L", "R"]);
const GLIDES = new Set(["W", "Y"]);
const AFFRICATES = new Set(["CH", "JH"]);

const FAMILIES: ReadonlyArray<ReadonlySet<string>> = [
  VOWELS,
  PLOSIVES,
  FRICATIVES,
  NASALS,
  LIQUIDS,
  GLIDES,
  AFFRICATES,
];

function familyOf(p: string): ReadonlySet<string> | null {
  // Strip stress markers (e.g. "AA1" -> "AA") so the families table stays
  // compact.
  const clean = p.replace(/[0-9]+$/, "").toUpperCase();
  for (const fam of FAMILIES) {
    if (fam.has(clean)) return fam;
  }
  return null;
}

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  const fa = familyOf(a);
  const fb = familyOf(b);
  // Same recognised family → kid-friendly half-cost.
  if (fa && fb && fa === fb) return 0.5;
  // Both unknown — treat as full cross-family substitution.
  return 1.0;
}

/** Weighted Levenshtein over phoneme arrays. */
function phonemeDistance(target: ReadonlyArray<string>, recog: ReadonlyArray<string>): number {
  const n = target.length;
  const m = recog.length;
  if (n === 0) return m;
  if (m === 0) return n;

  // Rolling two-row DP for memory; n and m are small (single words).
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    const ti = target[i - 1] ?? "";
    for (let j = 1; j <= m; j++) {
      const rj = recog[j - 1] ?? "";
      const sub = (prev[j - 1] ?? 0) + substitutionCost(ti, rj);
      const del = (prev[j] ?? 0) + 1.0;
      const ins = (curr[j - 1] ?? 0) + 1.0;
      curr[j] = Math.min(sub, del, ins);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m] ?? 0;
}

/**
 * Phonemise a free-form recognised utterance. We split on whitespace,
 * look up each word in the provided map, and for OOV (out-of-vocabulary)
 * words fall back to treating each letter as a phoneme. This is intentionally
 * crude — it gives us a usable comparison signal without runtime g2p.
 */
function phonemiseRecognized(text: string, phonemeMap: PhonemeMap): string[] {
  const out: string[] = [];
  for (const w of text.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const hit = phonemeMap[w];
    if (hit && hit.length > 0) {
      out.push(...hit);
    } else {
      // OOV heuristic: per-character.
      for (const ch of w) out.push(ch.toUpperCase());
    }
  }
  return out;
}

interface BandThresholds {
  great: number; // score >= great → 'great'
  good: number; // score >= good (and < great) → 'good'; below → 'try-again'
}

function baseThresholds(ageBand: AgeBand): BandThresholds {
  return ageBand === "6-8" ? { great: 55, good: 35 } : { great: 70, good: 50 };
}

/**
 * Apply strictness as a shift on both thresholds, then cap the try-again
 * threshold (`good`) so a passing band is always reachable.
 *
 * Caps (Pedagogy red line):
 *   - 6-8 : good ≤ 60
 *   - 9-12: good ≤ 70
 */
function adjustedThresholds(ageBand: AgeBand, strictness: Strictness): BandThresholds {
  const base = baseThresholds(ageBand);
  const shift = strictness === "easy" ? -10 : strictness === "strict" ? 10 : 0;
  const cap = ageBand === "6-8" ? 60 : 70;
  const good = Math.min(cap, base.good + shift);
  // `great` only needs to stay above `good`; we shift it by the same amount
  // and never let it fall below `good + 1`.
  const great = Math.max(good + 1, base.great + shift);
  return { great, good };
}

function bandFor(score: number, t: BandThresholds): PronunciationBand {
  if (score >= t.great) return "great";
  if (score >= t.good) return "good";
  return "try-again";
}

export function scorePronunciation(
  targetWord: string,
  recognized: string,
  phonemeMap: PhonemeMap,
  opts: { ageBand: AgeBand; strictness: Strictness },
): PronunciationScoreResult {
  const key = targetWord.trim().toLowerCase();
  const targetPhonemes = phonemeMap[key];

  // No phoneme entry → award full credit. We never punish kids for missing
  // dictionary data.
  if (!targetPhonemes || targetPhonemes.length === 0) {
    return { score: 100, band: "great" };
  }

  const recogText = recognized.trim();
  const thresholds = adjustedThresholds(opts.ageBand, opts.strictness);

  if (recogText.length === 0) {
    return { score: 0, band: bandFor(0, thresholds) };
  }

  const recogPhonemes = phonemiseRecognized(recogText, phonemeMap);
  const distance = phonemeDistance(targetPhonemes, recogPhonemes);
  const denom = Math.max(targetPhonemes.length, 1);
  const raw = 100 - (distance / denom) * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
  return { score, band: bandFor(score, thresholds) };
}
