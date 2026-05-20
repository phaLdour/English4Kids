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
 * On the Capacitor build the same handlers are pre-rendered at build time
 * (each route file declares `dynamic = 'force-static'` + `dynamicParams
 * = false` + `generateStaticParams` so the export contains a file per ID).
 * Next 14/15 writes these as the literal path with no extension when served
 * from the dev server, but the static export emits the body next to a sibling
 * descriptor; in practice Capacitor's WebView (capacitor://localhost) maps
 * `/api/content/foo` to the static file via its built-in path resolver, so
 * the same URL works in both contexts.
 *
 * The branch below remains so a sideloaded-content adapter (reading via
 * `@capacitor/filesystem`) can swap in later without changing call sites.
 */
function endpoint(pathTail: string): string {
  // Identical URL on both runtimes today; the indirection is the swap point
  // for a real native FS adapter (Sprint 6+).
  return `/api/content/${pathTail}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  // First try the canonical URL.
  const primary = await fetch(url, init);
  if (primary.ok) return primary.json();

  // Capacitor / static-export fallback: some Next versions emit the route
  // body at a `.txt` sibling. We probe it ONLY when the runtime is Capacitor
  // so we don't waste a request on the web. This makes the branch in
  // `endpoint()` testable and gives us a robust degradation if Next changes
  // its export filename convention between releases.
  if (isCapacitor()) {
    const txtUrl = `${url}.txt`;
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
  const raw = await fetchJson(endpoint(encodeURIComponent(unitId)));
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
