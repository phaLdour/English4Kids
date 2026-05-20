import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

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

/**
 * `E4K_TARGET=mobile` is set by `apps/mobile/package.json` when building the
 * static export that Capacitor bundles into the iOS / Android WebView. We
 * toggle `output: 'export'` and disable Image Optimization (incompatible
 * with static export) only in that mode so the default SSR web build is
 * unaffected.
 */
const isMobileTarget = process.env.E4K_TARGET === 'mobile';

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
  ...(isMobileTarget
    ? {
        output: 'export' as const,
        images: { unoptimized: true },
      }
    : {}),
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

// Conditional Sentry wrap: only enabled when org/project env are present, so
// dev and child-only deployments stay free of Sentry's webpack plugin.
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const sentryEnabled = Boolean(SENTRY_ORG && SENTRY_PROJECT);

const wrapped = withSerwist(nextConfig);

export default sentryEnabled
  ? withSentryConfig(wrapped, {
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      // Bundle-size matters on kid devices — keep tunnel and source-map upload
      // opt-in. Source maps are still emitted, just not auto-uploaded unless
      // an auth token is present.
      widenClientFileUpload: false,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : wrapped;
