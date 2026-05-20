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

All mascot Lottie files are hand-written procedural Bodymovin v5.9 JSON, 240x240 viewBox, 30fps, using only the locked Sprint 1 palette (Fox Orange `#F08A4B`, Owl Lavender `#9D8DF1`, Cream `#FFF8EE`, Charcoal `#1F2933`, Sunflower `#FFC857`). Loop semantics enforced in `MascotFrame`: idle/listening/thinking loop, all others play once. `prefers-reduced-motion` is honored at the component level (static fallback, no fetch).

| File | Source | Author | License | Date | Notes |
|---|---|---|---|---|---|
| `milo-idle.placeholder.json` | English4Kids team | Animation Engineer (agent) | MIT (own) | 2026-05-19 | Placeholder; superseded Sprint 4 |
| apps/web/public/lottie/milo-idle.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo idle — breathing scale + tail sway loop |
| apps/web/public/lottie/milo-listening.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo listening — head tilt +/-5deg, lavender mic pulse synced to mic-active |
| apps/web/public/lottie/milo-encouraging.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo encouraging — paws-up bounce, one-shot |
| apps/web/public/lottie/milo-celebrating.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo celebrating — body jump + confetti dots (sunflower + lavender) |
| apps/web/public/lottie/milo-thinking.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo thinking — paw to chin, gentle head sway loop |
| apps/web/public/lottie/milo-gentle-hmm.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo gentle-hmm — head tilt + raised brow; no frown, no red |
| apps/web/public/lottie/milo-waving.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Milo waving — tail wag + paw wave for onboarding intro |
| apps/web/public/lottie/luna-idle.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna idle — plumage breathing + slow blink |
| apps/web/public/lottie/luna-listening.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna listening — ear tufts forward, mic pulse synced to mic-active |
| apps/web/public/lottie/luna-encouraging.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna encouraging — wings up, body bob, one-shot |
| apps/web/public/lottie/luna-celebrating.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna celebrating — feather fluff scale bounce + feather puff |
| apps/web/public/lottie/luna-thinking.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna thinking — wing to beak, eyes off-center, loop |
| apps/web/public/lottie/luna-gentle-hmm.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna gentle-hmm — head tilt + slow blink; no red, no frown |
| apps/web/public/lottie/luna-waving.json | English4Kids team | Animation/Asset Engineer (agent, Sprint 4) | Original-MIT | 2026-05-19 | Luna waving — small wing wave for onboarding intro |

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
| content/units/03-animals-and-actions/manifest.json | English4Kids team | Content Engineer (agent, Sprint 4 / Phase 2) | MIT (own) | 2026-05-20 | Unit 3 (CEFR A1 entry): pets, farm animals, action verbs, can/can't |
| content/vocab/unit-03.json | English4Kids team | Content Engineer (agent, Sprint 4 / Phase 2) | MIT (own) | 2026-05-20 | 30 vocab entries with CMU phonemes (pets, farm, sounds, verbs, ability chunks) |
| content/stories/story-pip-meets-pets.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-20 | Original story; Pip the Parrot meets pets at a friendly shelter |
| content/stories/story-the-quietest-animal.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-20 | Original story; Coco the Goat farm walk; Luna narration debut |
| content/stories/story-what-can-you-do.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-20 | Original story; everyone has different strengths theme |
| content/songs/song-on-cocos-farm.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-20 | Original lyrics; 4th original song; farm animals & sounds (NOT "Old MacDonald") |
| content/songs/song-big-small-tall-short.json | English4Kids team | Content Designer + Content Engineer (agents) | MIT (own) | 2026-05-20 | Original lyrics; 5th original song; size adjectives with melodic contour |
| content/audio-assets/unit-03.json | English4Kids team | Content Engineer (agent, Sprint 4 / Phase 2) | MIT (own) | 2026-05-20 | Unit 3 audio asset map; introduces Luna (en-GB) voice actor |
| scripts/cmu-dict-mini.json (Unit 3 additions) | Carnegie Mellon University Pronouncing Dictionary (subset) + English4Kids team | CMU Speech Group + Content Engineer | BSD-2 (CMU subset) / MIT (multi-word chunks) | 2026-05-20 | Added hamster, chicken, goat, parrot, pet, small, big, tall, short, animal sounds (moo/baa/oink/neigh/quack/cluck), action verbs (climb, hop, bear), can/can't chunks |
| apps/web/public/phonemes/unit-03.json | English4Kids team | Content Engineer (agent, Sprint 4 / Phase 2, prebuild output) | MIT (own) | 2026-05-20 | Hand-written mirror of build-phonemes output for CI safety |

## Audit Trail

Quarterly audit by the Safety & Privacy Officer; archived license HTML stored under `LICENSES/` for each CC-BY-attributed source.
