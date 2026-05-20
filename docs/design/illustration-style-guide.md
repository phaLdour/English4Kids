# Illustration Style Guide

This document captures the locked illustration style for English4Kids vocabulary, story, and activity art, agreed for Sprint 4 (Wave A) by the Illustrator Agent, Design Lead, and Safety & Privacy Officer. Every SVG under `apps/web/public/img/` must conform.

## 1. Style decision (locked)

**Lingokids style** — bold outline, flat saturated fills, cartoonish geometry. The art has to read for ages 6-12 across both bands and at 120 px tap-target size. We do **not** ship realistic faces, painterly shading, or "cute baby" pastel-only spreads.

Why this style:

- Reads instantly at small sizes (high-contrast outlines do the silhouette work).
- Trivial to keep palette-restrained, accessibility-safe, and culture-neutral.
- Composes cleanly with the Lottie mascots (Milo, Luna) which already use 240x240 viewBox and the same charcoal outline.

## 2. Locked palette

Sprint 4 illustrations use only this palette (subset of the broader design tokens, chosen for child-TV legibility). At most **5 of 9** colors per illustration to keep palette restraint.

| Token | Hex | Use |
|---|---|---|
| Sky Blue | `#3DA9FC` | Primary, sky, water |
| Meadow Green | `#5FB37C` | Leaves, success, grass |
| Sunflower | `#FFC857` | Sun, warmth, accents |
| Fox Orange | `#F08A4B` | Milo, energy, warm fruit |
| Owl Lavender | `#9D8DF1` | Luna, evening sky, soft accent |
| Coral Peach | `#FFB5A7` | Soft accent, cheeks, blush |
| Cream | `#FFF8EE` | Default background fill |
| Charcoal | `#1F2933` | **Outline only — never fill** |
| Pure White | `#FFFFFF` | Highlights, sclera-equivalents |

When a concept needs a non-palette shade (e.g. brown for `img.color.brownLeaf`), use these inclusive-extension swatches sparingly and never on faces:

| Token | Hex | Use |
|---|---|---|
| Soft Brown | `#A06A3F` | Wood, brown leaves, "brown" color concepts |
| Medium Warm Skin | `#C68863` | Inclusive skin tone (mid) |
| Deep Warm Skin | `#8B5A3C` | Inclusive skin tone (deep) |
| Warm Pink | `#E26F8E` | "Pink" color concepts (not faces) |
| Soft Grey | `#B7BEC9` | "Grey" color concepts (clouds) |
| Plum | `#7A4CA0` | "Purple" deep fills when lavender is too light |

> **Charcoal is outline-only.** It must not be used as a fill except for tiny dot details (eyes, period markers). This keeps the visual identity readable and prevents heavy black-fill silhouettes that look threatening to younger learners.

## 3. Geometry rules

| Rule | Value | Why |
|---|---|---|
| viewBox | `0 0 240 240` | Matches Lottie viewBox — identical scaling |
| Primary stroke | `2.5` | Bold outline, reads at 120 px |
| Detail stroke | `1.5` | Eyes, whiskers, small lines |
| Line-join | `round` | Friendly, no sharp corners |
| Line-cap | `round` | Friendly caps |
| Subject fill area | ~80% of viewBox | No dead space; readable thumb |
| Eyes | Two dots / small ovals | NEVER realistic; safety constraint |
| Mouths | Single curve | Smile arc, neutral line, gentle "o" |
| Outline color | `#1F2933` (Charcoal) | Single outline color for whole set |

### SVG root template

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none" stroke="#1F2933" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
  <title>{concept short description}</title>
  ...shapes...
</svg>
```

Set root `fill="none"` and `stroke="#1F2933"` so every shape gets a charcoal outline by default and you only set `fill="..."` per shape. Override `stroke-width="1.5"` on detail shapes.

### Title element

Every SVG includes a `<title>` element as the first child of the root for screen reader support. The title is a short noun-phrase description ("A red apple with a green leaf"), not the concept ID.

## 4. Primitive composition workflow

We build illustrations from a small set of **primitives** — reusable shape templates that cover the common silhouettes. See `apps/web/public/img/_primitives/README.md` for the full list and code snippets.

Primitives (Sprint 4 set):

1. `face-round` — circle head + two dot eyes + smile arc.
2. `body-oval` — vertical-ellipse torso with two arms.
3. `body-quadruped` — rounded rectangle body + four legs.
4. `fruit-ovoid` — vertical ovoid + leaf + stem.
5. `object-base` — rounded-square base for furniture / objects.
6. `numeral-card` — oversized digit + countable cluster.
7. `swatch-card` — square color chip with white highlight.
8. `panel-frame` — story-panel frame with title strip and scene area.
9. `animal-cat` — pointed ears + whiskers head.
10. `animal-dog` — floppy ears + tongue head.
11. `animal-fox` — triangular ears + pointy snout (Milo lineage).
12. `animal-owl` — big-eye round head + ear tufts (Luna lineage).
13. `cloud` — three-bump cloud (`white-cloud`, `pink-cloud`, etc.).
14. `sun` — sun disk + 8 rays.
15. `wave-hand` — hand silhouette in wave pose.

Composition rule of thumb: pick one primitive, add 3-10 distinguishing shapes (the defining detail), pick 3-5 palette colors. Stop.

## 5. Tier prioritization (Sprint 4)

| Tier | Scope | Status |
|---|---|---|
| **Tier 1 — must-ship Sprint 4 Wave A** | Unit 1: greetings, family, colors (swatches + color-noun activity items), numerals, expressions, Unit 1 stories (Milo Hello, Family Picnic, Ten Little Ducks), counting ducks 1-10 | Production |
| **Tier 2 — Sprint 4 Wave B** | Unit 2: rooms, furniture, fruit, meals, drinks, Unit 2 stories, expression-with-food | Production (best effort), placeholder fallback |
| **Tier 3 — likely slip to Sprint 5** | Unit 3: pets, farm, actions, abilities, mixed, minimal pairs, Unit 3 stories, color-noun combos that re-use animals | Labelled placeholder OK |

A **labelled placeholder** is a 240x240 cream-filled rounded rectangle with the concept slug centered in 18pt Charcoal. It is valid SVG, under 1 KB raw, and prevents 404s in the renderer. It is **never** considered production art and must be replaced before public launch.

## 6. Safety constraints

- No realistic human faces — eyes are dots/ovals, never lashes/pupils/iris.
- Inclusive skin tones from the extended palette when humans appear; default to non-human (animal/object) representations where the concept allows.
- No scary expressions, no weapons, no blood-equivalent reds.
- No body/food shaming — `img.expression.gentleShake` is a polite head-shake, not disgust.
- No religious, political, or culturally divisive imagery.

## 7. Size budget

Each SVG must be **≤ 25 KB raw** and target **≤ 8 KB gzipped**. Empirically, hand-authored SVGs with 5-15 paths sit around 1.5-3 KB raw — well under budget. Use the primitives, avoid `<filter>` and `<mask>` (they bloat fast), avoid embedded base64 raster (forbidden anyway).

## 8. Naming convention

- File path: `apps/web/public/img/<unit-slug>/<concept-slug>.svg`
- `<unit-slug>` is the directory name (`01-me-and-my-world`, `02-home-and-food`, `03-animals-and-actions`).
- `<concept-slug>` is the part of the concept ID after `img.`, with dots replaced by hyphens and camelCase split to kebab-case.
  - `img.fruit.apple` -> `fruit-apple.svg`
  - `img.color.blackSwatch` -> `color-black-swatch.svg`
  - `img.story.miloHello.p1` -> `story-milo-hello-p1.svg`
- The resolver (`apps/web/src/lib/image-resolver.ts`) encodes the category-to-unit map; updating the map is required when new categories appear.

## 9. Adding a new illustration

1. Confirm the concept ID exists in a content file (vocab, manifest, or story).
2. Pick the primitive base (`face-round`, `fruit-ovoid`, etc.).
3. Compose with ≤ 5 palette colors and ≤ 15 path-equivalents.
4. Include a `<title>`.
5. Save to the correct unit folder using the slug rule above.
6. Run `pnpm dev` and verify the asset renders inside ListenAndTap / WordBuilder / StoryTime.
7. If the concept is brand new, update the resolver's category map.
8. Update PROVENANCE with a row for the batch.

## 10. Open follow-ups

Concepts where the locked palette does not map cleanly (flagged for designer revisit in Sprint 5):

- `img.color.brownLeaf`, `img.color.bearBrown`, `img.color.orangeBear` — uses Soft Brown extension; consider promoting Soft Brown to first-class palette.
- `img.color.pinkSky`, `img.color.pinkCloud` — Coral Peach reads more salmon; Warm Pink is closer to "pink" semantics, currently flagged for review.
- `img.color.grayCloud`, `img.color.graySky` — Soft Grey extension used.
- `img.color.purpleGrape`, `img.color.purpleTape` — Owl Lavender is too light for "purple"; we use Plum extension.
- Any of `img.color.queenLeaf`, `img.color.yellowSon`, `img.color.whiteCrowd`, `img.color.blueShoe` — content engineer likely typos; recommend fixing the concept IDs before final art.
