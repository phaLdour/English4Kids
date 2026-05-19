/**
 * Banned phrasings from the Pedagogy doc.
 *
 * Authoring red lines: kids hear encouragement, never judgment.
 * The validator CLI scans every prompt transcript, story narration, and
 * encouragement set to enforce this.
 */

export const BANNED_PHRASINGS = [
  'wrong',
  'no!',
  "you're wrong",
  'incorrect',
  'failed',
  'you failed',
  'try harder',
  "you're smart",
  "you're clever",
  "you're a genius",
  'easy!',
  'bad',
  'stupid',
  'yucky',
  'disgusting',
] as const;

export type BannedPhrasing = (typeof BANNED_PHRASINGS)[number];

/** Escape a string for safe use inside a RegExp source. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a phrase boundary-aware matcher.
 *
 * Strategy: treat the haystack as a whitespace/punct-separated token stream
 * and match the phrase tokens with boundary checks at both ends so that
 * "wrong" hits in "Wrong!" / "wrong." / "wrong " / leading-of-string, but
 * "wrongful" does NOT hit (must be a whole word/phrase).
 *
 * We special-case phrases that contain non-word punctuation (e.g. "no!")
 * by relaxing the right boundary to allow the trailing punctuation to be
 * the punctuation char itself.
 */
function makeMatcher(phrase: string): RegExp {
  // Tokens like "no!" already include their own punctuation — we want a
  // word boundary before, and an end-of-input / non-letter after the '!'.
  // Tokens like "wrong" need word boundaries on both ends.
  const source = escapeRegex(phrase);
  const lastChar = phrase[phrase.length - 1];
  const lastIsWord = lastChar !== undefined && /\w/.test(lastChar);
  const firstChar = phrase[0];
  const firstIsWord = firstChar !== undefined && /\w/.test(firstChar);

  const left = firstIsWord ? '(?:^|\\W)' : '(?:^|\\s)';
  const right = lastIsWord ? '(?:$|\\W)' : '(?:$|\\W|\\s)';
  return new RegExp(`${left}${source}${right}`, 'i');
}

const MATCHERS: ReadonlyArray<{ phrase: BannedPhrasing; re: RegExp }> = BANNED_PHRASINGS.map(
  (phrase) => ({ phrase, re: makeMatcher(phrase) }),
);

/**
 * Alternate-form patterns — same intent as a banned phrasing but with a
 * different surface form (e.g. "you are smart" vs "you're smart"). We map
 * each match back to its canonical banned phrasing for reporting.
 */
const ALT_MATCHERS: ReadonlyArray<{ phrase: BannedPhrasing; re: RegExp }> = [
  { phrase: "you're smart", re: /(?:^|\W)you\s+are\s+smart(?:$|\W)/i },
  { phrase: "you're clever", re: /(?:^|\W)you\s+are\s+clever(?:$|\W)/i },
  { phrase: "you're a genius", re: /(?:^|\W)you\s+are\s+a\s+genius(?:$|\W)/i },
  { phrase: "you're wrong", re: /(?:^|\W)you\s+are\s+wrong(?:$|\W)/i },
];

export interface BannedScanResult {
  found: boolean;
  matches: string[];
}

/**
 * Case-insensitive whole-word/phrase match for banned phrasings.
 * Returns the de-duplicated list of phrases that matched.
 */
export function containsBannedPhrasing(text: string): BannedScanResult {
  if (!text) return { found: false, matches: [] };
  const matches = new Set<string>();
  for (const { phrase, re } of MATCHERS) {
    if (re.test(text)) matches.add(phrase);
  }
  for (const { phrase, re } of ALT_MATCHERS) {
    if (re.test(text)) matches.add(phrase);
  }
  return { found: matches.size > 0, matches: [...matches] };
}
