# ADR 0004 — Modified Leitner 5-box, not SM-2

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Pedagogy Lead, Product Architect, Critic Wave-1, user
- **Supersedes:** —

## Context

Children 6–12 need spaced repetition that is **gentle and predictable**. SM-2 (the SuperMemo / Anki family) has two properties that hurt this audience:

1. Failing a card collapses the interval back to ~1 day, regardless of prior progress. For a kid, this looks like punishment ("I almost had it and the game took it away").
2. SM-2 introduces a continuous ease-factor (EF). It is opaque to children and adds tuning surface area we don't need.

Critic Wave-1 also flagged a concrete schema-design conflict: the initial draft data model leaked SM-2 fields (`ease`, `interval`, `repetitions`) into the `vocab_progress` table even though Pedagogy had specified Leitner. This ADR closes that gap and is the single source of truth going forward.

## Decision

Use **modified Leitner with 5 boxes** in `packages/game-engine/leitner`:

| Box | Display | Interval before next review | Promotion rule | Demotion rule |
|---|---|---|---|---|
| 1 | seed | 1 day | 1 correct → Box 2 | n/a (already at the bottom) |
| 2 | sprout | 2 days | 1 correct → Box 3 | wrong → Box 1 |
| 3 | bud | 5 days | 1 correct → Box 4 | wrong → Box 2 |
| 4 | bloom | 12 days | **2 consecutive correct** → Box 5 | wrong → Box 3 |
| 5 | star | 30 days | mastered (no further promotion) | wrong → Box 4 |

Key modifications versus textbook Leitner:

- **No Box-2 demotion.** A wrong answer in Box 2 sends the card to Box 1, but a wrong answer in Box 1 leaves it in Box 1 (we never drop below the floor — the message is "let's just try again").
- **Box 4 → Box 5 requires two consecutive correct.** Prevents lucky guesses from prematurely retiring a word.
- **Garden metaphor in the UI.** The child never sees "Box 3"; they see a bud growing in their Word Garden. The metaphor maps 1:1 to the box index.

Interval semantics:

- Intervals are *minimum* — the card becomes eligible after the interval and surfaces in the next review session that picks it up.
- A daily review session pulls up to **N due cards** (configurable; default 8 for ages 6–8, 12 for ages 9–12).

## Sync conflict policy (Phase 2)

When the same card has divergent box states on two devices, take the **higher box** (monotonic union). Rationale: forgetting on one device does not erase mastery shown on another.

## Consequences

**Positive**

- Algorithm is simple enough to fit on one page and to test exhaustively.
- Maps naturally to the Word Garden visual gamification (no separate progress UI needed).
- Robust against the "lucky tap" failure mode of younger learners.

**Negative / Risks**

- Less personalized than SM-2 for unusually fast/slow learners. Mitigation: age-band parameter sets give us two pre-tuned profiles for now; we can split further if data justifies it.
- Fixed intervals mean we can't react to a learner who consistently fails one card after many successes. Mitigation: track "lapses in last 14 days" as a separate signal and surface to parents in the dashboard.

## Verification

- Unit tests in `packages/game-engine/leitner/__tests__` cover every promote/demote edge case.
- Property-test (`fast-check`) verifies that no sequence of correct/wrong answers can produce a state outside the 1–5 range.

## Alternatives Rejected

| Option | Why rejected |
|---|---|
| SM-2 | Too punitive on failure; opaque EF; over-engineered for our age range. |
| FSRS (Free Spaced Repetition Scheduler) | State-of-the-art accuracy but operationally complex; needs more telemetry than COPPA permits us to gather. |
| Fixed daily review (no spacing) | Wastes the strongest pedagogical lever we have. |
