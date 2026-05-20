import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

/**
 * `@next/bundle-analyzer` only wires up its webpack plugin when `ANALYZE=true`
 * is passed at build time (see the `analyze` script in `apps/web/package.json`).
 * In normal builds it short-circuits to an identity wrapper, so we can leave it
 * in the production pipeline without affecting bundle output.
 */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

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
  // STT Agent (S4-3): keep the ~39 MB whisper.cpp model + WASM runtime out
  // of the initial precache. They lazy-load on first Speak It! opt-in via
  // `whisper-loader.ts` and live in a separate runtime cache instead.
  exclude: [/^\/whisper\//, /\/whisper\/.*\.(bin|wasm|js)$/],
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
  // Resolve `*.js` imports inside our `@e4k/*` packages to the matching `*.ts`
  // source. Each package's `src/` uses TypeScript-style `.js` specifiers (so
  // `tsc --moduleResolution=Bundler` resolves them) but Webpack's default
  // resolver does not perform the `.js → .ts` rewrite that TS does. The
  // `tsconfig` `paths` map redirects the package entry to `src/index.ts`,
  // so the rest of the tree needs the `.js → .ts` alias to chain through.
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
  ...(isMobileTarget
    ? {
        output: 'export' as const,
        images: { unoptimized: true },
        // Trailing slash mode forces every route to export as a directory
        // (e.g. `/api/content/01-me-and-my-world/index.body`) so the unit
        // JSON does not collide with the `[unitId]/audio` + `[unitId]/
        // phonemes` sibling routes (which DO require the segment to be a
        // directory). Without this Next 15 throws EISDIR mid-export.
        trailingSlash: true,
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

// Conditional Sentry wrap: only enabled when ALL of org / project / auth-token
// env are present, so dev and child-only deployments stay free of Sentry's
// webpack plugin. ADR-0014 §"Sentry source-map upload" for why we require the
// auth token now: a partial config (org+project, no token) used to silently
// emit maps without uploading — that produced misleading "release found, no
// maps" warnings in the Sentry UI and confused on-call.
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const sentryEnabled = Boolean(SENTRY_ORG && SENTRY_PROJECT && SENTRY_AUTH_TOKEN);

const wrapped = withSerwist(nextConfig);

const sentryWebpackPluginOptions = {
  org: SENTRY_ORG,
  project: SENTRY_PROJECT,
  authToken: SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Hide the maps from the public-facing bundle (Sentry still gets them via
  // upload). The full path of the map is rewritten to a sentry:// URL so a
  // determined visitor can't pull the originals from /_next/static.
  hideSourceMaps: true,
  // Upload server- + edge-runtime maps too. The kid bundle stays small at
  // runtime; this only affects what the build uploads to Sentry, not what
  // ships to the browser.
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
};

const sentryWrapped = sentryEnabled
  ? withSentryConfig(wrapped, sentryWebpackPluginOptions)
  : wrapped;

export default withBundleAnalyzer(sentryWrapped);
