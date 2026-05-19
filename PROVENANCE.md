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

## Audit Trail

Quarterly audit by the Safety & Privacy Officer; archived license HTML stored under `LICENSES/` for each CC-BY-attributed source.
