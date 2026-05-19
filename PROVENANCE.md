# Asset Provenance Log

Every audio, image, font, or code asset shipped with English4Kids is tracked here. Required by Safety & Privacy Officer policy.

## Rules

- Allowed licenses: CC0 · CC-BY · MIT · Apache-2.0 · BSD-2/3 · OFL.
- Forbidden: CC-NC · CC-ND · "royalty-free" without explicit license · AI-generated without model + prompt + date.
- CI gate (`.github/workflows/provenance-check.yml`) fails any PR that adds assets without updating this file.

## Fonts

| File / Family | Source | Author | License | Date | Notes |
|---|---|---|---|---|---|
| Fredoka (variable) | https://fonts.google.com/specimen/Fredoka | Milena Brandao + contributors | OFL 1.1 | 2026-05-19 | Display / headings — friendly rounded |
| Atkinson Hyperlegible | https://www.brailleinstitute.org/freefont | Braille Institute of America | OFL 1.1 | 2026-05-19 | Default body — dyslexia-friendly |
| Lexend (variable) | https://fonts.google.com/specimen/Lexend | Bonnie Shaver-Troup, Thomas Jockin et al. | OFL 1.1 | 2026-05-19 | Alt body (Reading Help toggle) |
| JetBrains Mono | https://www.jetbrains.com/lp/mono/ | JetBrains | OFL 1.1 | 2026-05-19 | Numeric / mono — parent dashboard data |

## Audio (Music / SFX / Narration)

| File | Source | Author | License | Date | Notes |
|---|---|---|---|---|---|
| _(none yet — Sprint 1)_ | | | | | Pre-rendered narration via Piper added in build step (Sprint 2) |

## Lottie Animations

| File | Source | Author | License | Date | Notes |
|---|---|---|---|---|---|
| `milo-idle.placeholder.json` | English4Kids team | Animation Engineer (agent) | MIT (own) | 2026-05-19 | Placeholder; production Lottie planned Sprint 2 |

## Code Dependencies

Tracked in `package.json` and audited via `pnpm licenses ls`. Any dep with a non-allowed license is rejected in CI.

## Pronunciation Dictionary

| File | Source | Author | License | Date |
|---|---|---|---|---|
| scripts/cmu-dict-mini.json | Carnegie Mellon University Pronouncing Dictionary (subset, ~120 words for MVP vocab) | CMU Speech Group | BSD-2 | 2026-05-19 |

## Content (Units / Stories / Songs)

| File | Source | Author | License | Date | Notes |
|---|---|---|---|---|---|
| content/units/01-me-and-my-world/manifest.json | English4Kids team | Content Engineer (agent) | MIT (own) | 2026-05-19 | Unit 1: greetings, family, colors, numbers |
| content/vocab/unit-01.json | English4Kids team | Content Engineer (agent) | MIT (own) | 2026-05-19 | 30 vocab entries with CMU phonemes |
| content/stories/story-milo-hello.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original story; animal characters only |
| content/stories/story-family-picnic.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original story; Bea Bunny family |
| content/stories/story-ten-little-ducks.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original; NOT derived from public-domain "Five Little Ducks" |
| content/songs/song-hello-friend.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original lyrics |
| content/songs/song-colors-all-around.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original lyrics |
| content/songs/song-count-with-me.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original lyrics; counting song |
| content/units/02-home-and-food/manifest.json | English4Kids team | Content Engineer (agent, Sprint 3) | MIT (own) | 2026-05-19 | Unit 2: rooms, furniture, fruit, meals |
| content/vocab/unit-02.json | English4Kids team | Content Engineer (agent, Sprint 3) | MIT (own) | 2026-05-19 | 25 vocab entries with CMU phonemes |
| content/stories/story-house-tour.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original story; Bea Bunny's house tour |
| content/stories/story-bea-tries-pear.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original story; gentle "new food" theme, no food shaming |
| content/stories/story-three-meals.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original story; daily meal routine |
| content/songs/song-fruit-salad-friends.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-19 | Original lyrics; fruit + I-like song |

## Audit Trail

Quarterly audit by the Safety & Privacy Officer; archived license HTML stored under `LICENSES/` for each CC-BY-attributed source.
