import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - `connect-src` MUST only allow `'self'` and Supabase. No Google, no
//   Sentry, no Plausible on child pages. The parent dashboard owns its own
//   route-scoped header override.
// - `media-src` allows `blob:` for client-side TTS playback (Howler creates
//   blob URLs for prefetched assets), NOT for uploads. The mic policy is
//   enforced separately by the absence of MediaRecorder usage.
// - `Permissions-Policy: microphone=(self)` grants the app's own origin
//   permission to use the mic; the kid still has to consent at the OS
//   prompt. camera and geolocation are denied outright.
// - `worker-src 'self'` is required so the Serwist service worker can boot.

const CSP_VALUE = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Serwist wraps the Next config to inject the precache manifest into
 * `src/app/sw.ts` and emit `public/sw.js` at build time. See
 * docs/devops/pwa.md for cache strategy.
 *
 * Disabling the SW in dev avoids stale-asset surprises while iterating;
 * `apps/web/src/app/serwist-register.tsx` honours an explicit `?sw=enabled`
 * override for manual offline testing.
 */
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  cacheOnNavigation: true,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: [
    '@e4k/ui',
    '@e4k/audio',
    '@e4k/game-engine',
    '@e4k/content-schema',
    '@e4k/db',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP_VALUE },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), camera=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
