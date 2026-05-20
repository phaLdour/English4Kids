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
 * Resolve the content endpoint URL. On Capacitor (static export) Next.js
 * writes the route handler output as a static JSON file at the same path,
 * so the URL is identical. The branch is here so that a future native
 * filesystem adapter can swap in without disturbing callers.
 */
function endpoint(pathTail: string): string {
  // Trailing-slash safety: on the web `/api/content/foo` and `/api/content/foo/`
  // both 200; on a static export the file is usually served at the trailing
  // form. Leave it unchanged — Capacitor's WebView resolves both.
  if (isCapacitor()) {
    return `/api/content/${pathTail}`;
  }
  return `/api/content/${pathTail}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`content-client: ${url} returned ${res.status}`);
  }
  return res.json();
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
