# Pronunciation Scoring

## Goal

Give a child encouraging, age-appropriate feedback on how close their spoken attempt is to a target word, **without** ever shipping their audio off-device (ADR 0002) and **without** crushing them with a harsh "wrong" verdict.

## Algorithm

1. The Web Speech API (default) or whisper.cpp WASM (opt-in) returns a **transcript** (text) for the child's utterance.
2. We tokenise both the **target word** and the **transcript** into phoneme sequences using the **build-time precomputed phoneme JSON** at `content/phonemes/<unit>.json`. No runtime g2p, no CMU dict at runtime.
3. We compute a **weighted phoneme Levenshtein distance** between the target and transcript phoneme sequences.
4. We convert the distance into a normalised score (0–100) where 100 = exact match.
5. We bucket the score into one of three feedback tiers using **age-banded thresholds**.

## Weighted Levenshtein details

- Standard Levenshtein with three operations: insert, delete, substitute.
- Substitution cost is weighted by **phonetic distance** in a small built-in confusion matrix:
  - Common kid substitutions (`r/w`, `th/f`, `th/d`, `s/sh`) cost **0.5** instead of 1.
  - Vowel confusions (`ɛ/æ`, `ɪ/i`) cost **0.5**.
  - Voicing-only swaps (`p/b`, `t/d`, `s/z`) cost **0.6**.
  - Anything else costs **1.0**.
- Insertions and deletions cost **1.0**.
- The matrix is in `packages/audio/src/scoring/confusion.ts`.

## Age-banded thresholds (default strictness)

| Age band | Excellent (1st star) | Good (passes) | Below = "try again" |
|---|---|---|---|
| 6–8 | ≥ 70 | ≥ 55 | < 55 |
| 9–12 | ≥ 85 | ≥ 70 | < 70 |

> The "pass" threshold is what unlocks the next item in Speak It!. The "excellent" threshold awards the bonus star.

Wait — restated to match the user-spec exactly (Pedagogy Lead's numbers):

| Age band | Excellent | Pass | Below |
|---|---|---|---|
| 6–8 | ≥ 55 | n/a | < 35 |
| 9–12 | ≥ 70 | n/a | < 50 |

In other words: pass = "above the floor"; excellent = "above the high bar"; in between = "good try, gentle nudge."

## Strictness shift (parent control)

Parents can shift the strictness in the Settings Panel:

- **Gentle** (default for age 6–8): -15 to both thresholds.
- **Standard** (default for age 9–12): published numbers.
- **Stricter** (opt-in): +10 to both thresholds.

The shift never moves into the "harsh" zone — even at Stricter, the 6–8 floor is still below 50.

## Auto-pass safeguard

After **3 attempts** on the same item, regardless of score, the activity:

1. Awards 1 star (the participation star).
2. Marks the item correct for the purpose of progressing.
3. Logs a "needs review" flag to surface in the Parent Dashboard (not to the child).

Rationale: kids who can't physically make the sound for developmental reasons must not be locked out.

## What we record

- `attempt.transcript` — the recognised text (not audio).
- `attempt.score` — the 0–100 number.
- `attempt.tier` — `excellent | pass | below`.
- `attempt.timestamp`.

Audio bytes are never recorded.

## What we do not do

- No server-side scoring.
- No comparison against a reference audio waveform (we don't have audio).
- No cross-child comparison or leaderboards.
- No diagnostic claims (we are not a speech therapy tool).
