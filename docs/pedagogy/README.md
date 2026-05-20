# Pedagogy — one-page summary

This is the short reference. The deeper writeup lives in agent output and ADRs.

## CEFR map (MVP)

| Unit | CEFR target | Theme |
|---|---|---|
| Unit 1 | Pre-A1 → A1 | Greetings, names, "I am / you are" |
| Unit 2 | A1 | Numbers 1–20, age, "how many" |
| Unit 3 | A1 | Colors, "what color is …" |
| Unit 4 | A1 → A2 | Family + classroom objects |
| Unit 5 | A2 | Likes / dislikes, "I like / I don't like" |

Each unit has 4 lessons; each lesson has 4–6 activities.

## Age bands

| Band | Age | Reading | Tap target | Default strictness | Default captions |
|---|---|---|---|---|---|
| Young | 6–8 | Emerging | ≥ 56 px | Gentle | On |
| Older | 9–12 | Fluent | ≥ 44 px | Standard | Off |

Band is set at onboarding and is **changeable by the parent** at any time.

## Scaffolding pattern (per activity)

1. **Hear** — Milo says the word; child taps to hear again as many times as they want.
2. **Match** — child picks the image that matches the word (Listen & Tap).
3. **Build** — child assembles letters into the word (Word Builder).
4. **Speak** — child says the word (Speak It!) — *parent-gated mic*.
5. **Use** — the word appears in a Story Time or Sing Along context.

A child is **never** forced through all five — the activity author selects 2–4 per lesson based on the unit goals.

## Spaced repetition

**Modified Leitner, 5 boxes** — see ADR 0004 for the full rules. Surfaced to the child as the Word Garden (seed → sprout → bud → bloom → star). The word "box" is never shown.

## Stars (per activity)

- ★ **Participation** — finished the activity.
- ★ **Accuracy** — ≥ 80% correct on first try.
- ★ **Care** — completed without rushing (median item time ≥ 1.2 s and no double-taps).

Three stars unlocks a small confetti+chime but no other in-game economy.

## Banned phrasings (lint-enforced)

CI's `validate:content` fails the build if any copy field contains:

- `wrong` (use "not quite", "try again")
- `fail`, `failed`, `failure`
- `stupid`, `dumb`, `silly` (in a corrective context)
- `bad job`, `you can't`, `you didn't`
- `loser`, `winner` (the word "win" is fine in a song lyric context but lint flags it for review)
- exclamation strings of 3+ ("!!!")

## Red lines (Pedagogy refuses to ship)

- No timed multiple-choice that punishes slowness.
- No streak feature that **breaks** when a kid misses a day — instead, a "freeze day" auto-restores once per week.
- No leaderboards.
- No public profile, avatar uploads, or social features.
- No in-app purchases, no IAP nags.
- No "you got it wrong" dead-end screens — every wrong answer is followed by Milo's encouragement and one easier retry.
- No timed test that gates progress through the lesson.

## Mastery definition

A word is "mastered" when it reaches **Box 5 (star)** in Leitner. Surfaces as a star bloom in the Word Garden. Mastery is **per child, per device** at MVP; multi-device merge follows the monotonic-union rule (ADR 0004).
