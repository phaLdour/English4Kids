/// <reference lib="webworker" />
/**
 * English4Kids Service Worker (Serwist).
 *
 * Sprint 3 — offline PWA.
 *
 * Strategy summary
 * ----------------
 *   - App shell precache: pages, manifest, common chunks (managed by
 *     `@serwist/next`'s injected `__SW_MANIFEST`).
 *   - Per-unit assets (audio, phonemes, images) — CacheFirst with an LRU cap
 *     and 30-day TTL. The cap mirrors a conservative 50 MB budget; Serwist's
 *     ExpirationPlugin will evict on quota pressure (`purgeOnQuotaError`).
 *   - API content (manifests, songs, stories) — StaleWhileRevalidate so the
 *     child sees the current version on second open but doesn't block.
 *   - Supabase REST/Realtime — NetworkFirst (Phase 2 will add sync).
 *   - Parent routes are explicitly NOT cached at the runtime layer — we don't
 *     want parent dashboard data in the SW cache (privacy compromise per
 *     docs/safety/coppa-gdpr-k.md).
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

const isParentRoute = ({ url }: { url: URL }): boolean =>
  url.pathname.startsWith('/parent') || url.pathname.startsWith('/api/parent');

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Audio — large binary, cache-first, LRU capped.
    {
      matcher: ({ url, request }) =>
        !isParentRoute({ url }) &&
        (request.destination === 'audio' || /\/audio\//.test(url.pathname)),
      handler: new CacheFirst({
        cacheName: 'e4k-audio-v1',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
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
