/**
 * Resolve a content `imageConcept` (e.g. "img.fruit.apple", "img.story.miloHello.p1")
 * to a public URL under `/img/<unit-slug>/<concept-slug>.svg`.
 *
 * Concepts use a dotted path like `img.<category>.<noun>` (Sprint 4). Each
 * category maps to one of the three production units; story concepts use
 * `img.story.<storySlug>.<panelId>` and are routed via a story-to-unit map.
 *
 * Returns `undefined` for empty input so callers (TapCard / StoryTime) can
 * fall back to an initial-letter / alt-text view. Legacy concepts that don't
 * start with `img.` fall through to the original `/content-images/<id>.svg`
 * shape for backward compatibility.
 */

const UNIT_01 = '01-me-and-my-world';
const UNIT_02 = '02-home-and-food';
const UNIT_03 = '03-animals-and-actions';

/** Category-prefix -> unit slug. */
const CATEGORY_UNIT: Record<string, string> = {
  greeting: UNIT_01,
  family: UNIT_01,
  numeral: UNIT_01,
  count: UNIT_01,
  color: UNIT_01,
  room: UNIT_02,
  furniture: UNIT_02,
  fruit: UNIT_02,
  meal: UNIT_02,
  drink: UNIT_02,
  expression: UNIT_02,
  pet: UNIT_03,
  farm: UNIT_03,
  action: UNIT_03,
  ability: UNIT_03,
  mixed: UNIT_03,
  minPair: UNIT_03,
};

/** Story slug -> unit slug. */
const STORY_UNIT: Record<string, string> = {
  miloHello: UNIT_01,
  familyPicnic: UNIT_01,
  tenLittleDucks: UNIT_01,
  houseTour: UNIT_02,
  beaTriesPear: UNIT_02,
  threeMeals: UNIT_02,
  pipMeetsPets: UNIT_03,
  theQuietestAnimal: UNIT_03,
  whatCanYouDo: UNIT_03,
};

export function resolveImage(imageConcept: string): string | undefined {
  if (!imageConcept) return undefined;

  // Legacy flat layout for non-dotted concepts (e.g. tests using "animals/cat").
  if (!imageConcept.startsWith('img.')) {
    return `/content-images/${imageConcept}.svg`;
  }

  const parts = imageConcept.split('.');
  // parts[0] === "img"
  const category = parts[1];
  if (!category) return undefined;

  // Story routing: img.story.<slug>.<panelId> -> /img/<unit>/story-<slug>-<panelId>.svg
  if (category === 'story' && parts.length >= 4) {
    const storySlug = parts[2];
    const panel = parts.slice(3).join('-');
    const unit = STORY_UNIT[storySlug];
    if (!unit) return undefined;
    return `/img/${unit}/story-${kebab(storySlug)}-${panel}.svg`;
  }

  const unit = CATEGORY_UNIT[category];
  if (!unit) return undefined;

  // Everything after `img.` becomes the file slug, with dots -> hyphens.
  const slug = parts.slice(1).map(kebab).join('-');
  return `/img/${unit}/${slug}.svg`;
}

/** camelCase / PascalCase -> kebab-case; preserves digits. */
function kebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Sprint 4 (S4-11) image-loading helpers.
 *
 * All concept images today are SVG and therefore resolution-independent —
 * a single source serves every DPR / viewport without needing `<picture>`
 * or `srcset`. The helpers below still centralise the lazy-load / decoding
 * defaults so consumers don't drift apart:
 *
 *   - `loading="lazy"` for any image below the fold (the lesson player only
 *     reveals one panel at a time, so all activity art is effectively
 *     below-the-fold once the lesson is mounted).
 *   - `loading="eager"` for mascot frames or hero illustrations rendered on
 *     first paint (onboarding welcome, /play hub).
 *   - `decoding="async"` everywhere — SVG decode is fast but `async` lets
 *     the browser parallelise with paint.
 *   - Explicit `width` / `height` attrs always, to lock CLS to zero.
 *
 * Future raster assets (audio thumbnails, parent dashboard avatars) should
 * use `<picture>` with `srcset` 1x/2x sources; the convention is documented
 * in `docs/devops/perf-budgets.md`. No raster images ship today so we keep
 * the helper SVG-focused.
 */

export type ImageLoadingMode = 'eager' | 'lazy';

export interface ImagePerfAttrs {
  loading: ImageLoadingMode;
  decoding: 'async';
  width: number;
  height: number;
}

/**
 * Default perf attributes for activity / story images. Above-the-fold callers
 * pass `loading: 'eager'`; below-the-fold defaults to `'lazy'`.
 */
export function getImagePerfAttrs(
  width: number,
  height: number,
  mode: ImageLoadingMode = 'lazy',
): ImagePerfAttrs {
  return { loading: mode, decoding: 'async', width, height };
}
