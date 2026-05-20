/// <reference lib="webworker" />
/**
 * English4Kids Service Worker (Serwist).
 *
 * Sprint 3 — offline PWA.
 * Sprint 4 — S4-8 adaptive bitrate + Lottie precache + per-unit eager fetch.
 *
 * Strategy summary
 * ----------------
 *   - App shell precache: pages, manifest, common chunks (managed by
 *     `@serwist/next`'s injected `__SW_MANIFEST`).
 *   - Per-unit assets (audio, phonemes, images) — CacheFirst with an LRU cap
 *     and 30-day TTL. The cap mirrors a conservative 50 MB budget; Serwist's
 *     ExpirationPlugin will evict on quota pressure (`purgeOnQuotaError`).
 *   - Lottie animations (`/lottie/*.json`) — CacheFirst, 14 entries, 30 day
 *     TTL (Critic Wave-2 §1.5 fix: SW previously fell through to the network
 *     default, leaving mascot animations broken offline).
 *   - Audio adaptive bitrate: when an `.mp3` request arrives but the sibling
 *     `.opus` is already cached, serve the cached `.opus` instead (saves
 *     ~3-4x bytes per clip). Guarded by Opus feature-detection on the
 *     client; the SW only does the swap if the browser advertised Opus in
 *     its Accept header (set by `audio-client.ts`).
 *   - API content (manifests, songs, stories) — StaleWhileRevalidate so the
 *     child sees the current version on second open but doesn't block.
 *   - Supabase REST/Realtime — NetworkFirst (Phase 2 will add sync).
 *   - Parent routes are explicitly NOT cached at the runtime layer — we don't
 *     want parent dashboard data in the SW cache (privacy compromise per
 *     docs/safety/coppa-gdpr-k.md).
 *   - `precacheUnitAudio(unitId)` is invoked via `postMessage` from the
 *     lesson player when the child opens `/play/<unitId>/...` so the runtime
 *     audio cache is warm before they hit the first prompt.
 */
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;
const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;
const NINETY_DAYS_SEC = 90 * 24 * 60 * 60;

const AUDIO_CACHE = 'e4k-audio-v1';
const LOTTIE_CACHE = 'e4k-lottie-v1';
const WHISPER_CACHE = 'whisper-runtime-cache';

const isParentRoute = ({ url }: { url: URL }): boolean =>
  url.pathname.startsWith('/parent') || url.pathname.startsWith('/api/parent');

/**
 * Adaptive bitrate: if the request is for an `.mp3` and we already have the
 * sibling `.opus` cached, return the Opus version. Saves ~3-4x bytes per
 * narration clip while still letting non-Opus browsers fall back. The
 * client opts in by setting `Accept: audio/ogg;codecs=opus, audio/mpeg`.
 */
async function adaptiveAudioHandler({ request }: { request: Request }): Promise<Response> {
  const cache = await caches.open(AUDIO_CACHE);
  const acceptsOpus = request.headers.get('accept')?.includes('audio/ogg') ?? false;

  if (acceptsOpus && /\.mp3(\?|$)/.test(request.url)) {
    const opusUrl = request.url.replace(/\.mp3(\?|$)/, '.opus$1');
    const opusHit = await cache.match(opusUrl);
    if (opusHit) return opusHit;
  }

  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh.ok) {
    await cache.put(request, fresh.clone());
  }
  return fresh;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Audio — large binary, cache-first, LRU capped, with adaptive
    //    Opus-over-MP3 substitution on cache hit.
    {
      matcher: ({ url, request }) =>
        !isParentRoute({ url }) &&
        (request.destination === 'audio' || /\/audio\//.test(url.pathname)),
      handler: {
        handle: ({ request }: { request: Request }) => adaptiveAudioHandler({ request }),
      },
    },
    // 1b. Fallback raw audio cache (used by the adaptive handler above).
    {
      matcher: ({ url }) =>
        !isParentRoute({ url }) && /\/audio\/.*\.(opus|mp3)$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: AUDIO_CACHE,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: THIRTY_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 1c. Lottie animations — Critic Wave-2 §1.5 fix. Mascot JSON is small
    //     (~20 KB each) but absolutely required for the idle/listening/
    //     celebrating animations. Without this rule the SW fell through to
    //     network default and mascots froze offline.
    {
      matcher: ({ url }) =>
        !isParentRoute({ url }) && /\/lottie\/.*\.json$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: LOTTIE_CACHE,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 14, // one per file currently shipped (7 milo + 7 luna)
            maxAgeSeconds: THIRTY_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 2. Precomputed phoneme JSON (small, hot path for Speak-It).
    {
      matcher: ({ url }) => !isParentRoute({ url }) && /\/phonemes\//.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: 'e4k-phonemes-v1',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: THIRTY_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 3. Images (illustrations, mascot frames).
    {
      matcher: ({ url, request }) =>
        !isParentRoute({ url }) &&
        (request.destination === 'image' || /\/images?\//.test(url.pathname)),
      handler: new CacheFirst({
        cacheName: 'e4k-images-v1',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: THIRTY_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 3b. Whisper offline engine artifacts (ggml model + WASM runtime).
    //     Explicitly NOT precached on install (see next.config.ts `exclude`),
    //     but once a parent opts in via Settings and the loader fetches them,
    //     the runtime cache below holds them for 90 days so subsequent loads
    //     are instant and offline-friendly. Bound to a single matching pair
    //     so the cache cannot accidentally bloat.
    {
      matcher: ({ url }) =>
        !isParentRoute({ url }) && url.pathname.startsWith('/whisper/'),
      handler: new CacheFirst({
        cacheName: WHISPER_CACHE,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 4,
            maxAgeSeconds: NINETY_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 4. Content API (manifests, songs, stories).
    {
      matcher: ({ url }) =>
        !isParentRoute({ url }) && url.pathname.startsWith('/api/content/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'e4k-content-api-v1',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: SEVEN_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 5. Supabase (Phase 2 sync placeholder). NetworkFirst keeps reads fresh
    //    but lets us survive flaky networks with a brief grace window.
    {
      matcher: ({ url }) => /supabase\.co$/.test(url.hostname),
      handler: new NetworkFirst({
        cacheName: 'e4k-supabase-v1',
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: SEVEN_DAYS_SEC,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 6. Fall-through to Serwist defaults for everything else (HTML, CSS, JS,
    //    font files). Parent routes intentionally bypass our runtime caches
    //    above and fall to the default network-first navigation handler.
    ...defaultCache,
  ],
});

serwist.addEventListeners();

/**
 * Eagerly pull every audio file for a given unit into the runtime cache.
 *
 * Invoked by the lesson player via:
 *   navigator.serviceWorker.controller?.postMessage({
 *     type: 'precache-unit-audio', unitId: 'unit-01',
 *   });
 *
 * Reads `/audio/manifest.json` (small — emitted by `build-narration.ts`),
 * filters by `unit`, and warms the audio cache in the background. Failures
 * are swallowed; the next on-demand fetch will retry naturally.
 */
async function precacheUnitAudio(unitId: string): Promise<void> {
  try {
    const manifestRes = await fetch('/audio/manifest.json', { cache: 'no-cache' });
    if (!manifestRes.ok) return;
    const manifest = (await manifestRes.json()) as {
      entries: Array<{ unit: string; srcOpus: string; srcMp3: string }>;
    };
    const cache = await caches.open(AUDIO_CACHE);
    const matching = manifest.entries.filter((e) => e.unit === unitId);
    await Promise.all(
      matching.flatMap((e) => [
        cache.add(e.srcOpus).catch(() => undefined),
        // We deliberately do NOT eagerly cache .mp3 — the adaptive handler
        // serves .opus when present, so MP3 fetches are rare fallbacks.
      ]),
    );
  } catch {
    // Background warm-up is best-effort; silently bail.
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; unitId?: string } | undefined;
  if (data?.type === 'precache-unit-audio' && typeof data.unitId === 'string') {
    event.waitUntil(precacheUnitAudio(data.unitId));
  }
});

// Exported for tests / direct invocation from non-SW contexts (e.g. when the
// app is running in dev without the SW registered yet).
export { precacheUnitAudio };
