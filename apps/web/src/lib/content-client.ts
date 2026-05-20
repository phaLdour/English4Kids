'use client';

/**
 * content-client — adapter that fetches authored content (units, songs,
 * stories, audio-asset maps, phoneme maps) regardless of whether the bundle
 * is running on the web (where Next.js serves `/api/content/...`) or inside
 * the Capacitor WebView (where the same routes have been baked into the
 * static export as `/api/content/<id>/route.json` files via Next's
 * `output: 'export'`).
 *
 * Sprint 4 — S4-10 (Capacitor static export compatibility).
 *
 * Why this exists:
 *   `apps/web/next.config.ts` toggles `output: 'export'` when `E4K_TARGET=mobile`.
 *   In that mode, the App Router pre-renders each `/api/content/<id>` route
 *   to a static asset at build time (we set `generateStaticParams` +
 *   `dynamic = 'force-static'` + `dynamicParams = false` on each route).
 *
 *   At runtime on the device, the WebView can fetch those static JSON files
 *   directly — no Node server is on the box. We use a single `fetch()` here
 *   because:
 *     • on web, it talks to the live route handler;
 *     • on Capacitor, it reads the bundled static export over the WebView's
 *       `file://` or Capacitor scheme — same shape of request.
 *
 *   The `isCapacitor()` branch is currently a no-op in terms of the URL
 *   path, but the indirection lets us swap in a `Filesystem.readFile()`
 *   adapter later (e.g. for sideloaded packs) without touching every
 *   call-site.
 *
 * Refactor target: existing consumers (lesson player, story/song
 * components) should call these helpers instead of raw `fetch`. That keeps
 * the static-export contract verifiable in one place.
 */

import {
  type AudioAssetMap,
  AudioAssetMapSchema,
  type SongLyric,
  SongLyricSchema,
  type Unit,
  UnitSchema,
} from '@e4k/content-schema';
import { z } from 'zod';
import { isCapacitor } from './runtime-adapter';
import { StoryPanelSchema, StoryQuestionSchema } from '@e4k/content-schema';

const StoryDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  ageBand: z.enum(['6-8', '9-12']),
  panels: z.array(StoryPanelSchema),
  questions: z.array(StoryQuestionSchema),
});
export type StoryDoc = z.infer<typeof StoryDocSchema>;

export type PhonemeMap = Record<string, string[]>;

/**
 * Resolve the content endpoint URL.
 *
 * On the web build, Next's App Router serves `/api/content/<id>` from the
 * route handlers in `src/app/api/content/*`.
 *
 * On the Capacitor build (`output: 'export'` + `trailingSlash: true`) each
 * route handler is pre-rendered at build time. Trailing-slash mode is
 * required because the unit endpoint and its `audio` / `phonemes` siblings
 * share the same parent segment — without it the export would collide a
 * file (`<unitId>`) with a directory (`<unitId>/audio/`). The static export
 * lives at `out/api/content/<unitId>/` so we hit that directory with the
 * trailing-slash URL.
 *
 * The Capacitor branch is also the swap point for a future native FS
 * adapter (e.g. sideloaded `@capacitor/filesystem` reads), should we
 * decide to bypass `fetch` entirely for content packs.
 */
function endpoint(pathTail: string): string {
  // Mobile / Capacitor build needs the trailing-slash form so it resolves
  // to the exported directory's body file. The web build accepts both
  // forms (Next handles the trailing slash transparently).
  if (isCapacitor()) {
    return `/api/content/${pathTail}/`;
  }
  return `/api/content/${pathTail}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  // First try the canonical URL.
  const primary = await fetch(url, init);
  if (primary.ok) return primary.json();

  // Capacitor / static-export fallback: some Next versions emit the route
  // body at a `.txt` sibling. We probe it ONLY when the runtime is Capacitor
  // so we don't waste a request on the web. This gives us a robust
  // degradation if Next changes its export filename convention between
  // releases. The trailing slash form in `endpoint()` is the primary path;
  // `.txt` is the legacy fallback.
  if (isCapacitor()) {
    const txtUrl = `${url.replace(/\/$/, '')}.txt`;
    const fallback = await fetch(txtUrl, init);
    if (fallback.ok) return fallback.json();
    throw new Error(
      `content-client: ${url} (and ${txtUrl}) returned ${primary.status} / ${fallback.status}`,
    );
  }

  throw new Error(`content-client: ${url} returned ${primary.status}`);
}

/** Load a unit's `manifest.json` (lessons + activity tree). */
export async function getUnit(unitId: string): Promise<Unit> {
  // Sprint 6 / Iteration 3 (QA-Lead): the Next App Router exporter rejects
  // a `[unitId]` route handler that has `[unitId]/audio` + `[unitId]/
  // phonemes` siblings under `output: 'export'` — same segment can't be
  // both a file and a directory. We moved the unit endpoint to
  // `[unitId]/manifest/route.ts` so all three siblings live under the
  // `[unitId]/` directory.
  const raw = await fetchJson(endpoint(`${encodeURIComponent(unitId)}/manifest`));
  return UnitSchema.parse(raw);
}

/** Load a song's lyrics + timing. */
export async function getSong(songId: string): Promise<SongLyric> {
  const raw = await fetchJson(endpoint(`songs/${encodeURIComponent(songId)}`));
  return SongLyricSchema.parse(raw);
}

/** Load a story's panels + questions. */
export async function getStory(storyId: string): Promise<StoryDoc> {
  const raw = await fetchJson(endpoint(`stories/${encodeURIComponent(storyId)}`));
  return StoryDocSchema.parse(raw);
}

/**
 * Load the audio-asset map for a unit. The handler returns `{}` for unknown
 * unit IDs (intentional — see `route.ts`), so the parsed result may be empty.
 */
export async function getAudioMap(unitId: string): Promise<AudioAssetMap> {
  try {
    const raw = await fetchJson(endpoint(`${encodeURIComponent(unitId)}/audio`), {
      cache: 'no-store',
    });
    const parsed = AudioAssetMapSchema.safeParse(raw);
    if (!parsed.success) return {};
    return parsed.data;
  } catch {
    return {};
  }
}

/**
 * Load the phoneme map for a unit. The handler returns `{}` for missing maps
 * to keep speech activities non-blocking; we mirror that contract here.
 */
export async function getPhonemeMap(unitId: string): Promise<PhonemeMap> {
  try {
    const raw = await fetchJson(
      endpoint(`${encodeURIComponent(unitId)}/phonemes`),
    );
    if (typeof raw !== 'object' || raw === null) return {};
    return raw as PhonemeMap;
  } catch {
    return {};
  }
}
