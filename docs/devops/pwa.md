# PWA setup — Serwist offline cache

Sprint 3 ships an offline-capable PWA. This doc explains the moving parts.

## Pieces

- `apps/web/next.config.ts` wraps the Next config with `@serwist/next`.
- `apps/web/src/app/sw.ts` is the service worker entry. It is precompiled by
  Serwist at `pnpm build` into `apps/web/public/sw.js`.
- `apps/web/src/app/serwist-register.tsx` is a client component that
  registers the service worker on mount. It is mounted inside `Providers`.
- `apps/web/src/components/InstallPrompt.tsx` listens for
  `beforeinstallprompt` and surfaces a kid-friendly install card AFTER the
  child finishes their first lesson. The decision is persisted in Dexie as
  `pwa.installPromptShown`.

## Cache strategy

| Pattern                     | Strategy             | Cap          | TTL    |
|-----------------------------|----------------------|--------------|--------|
| App shell (HTML / chunks)   | precache (Serwist)   | n/a          | n/a    |
| `/audio/**`                 | CacheFirst           | 500 entries  | 30 d   |
| `/phonemes/**`              | StaleWhileRevalidate | 50 entries   | 30 d   |
| `/images/**` (any image)    | CacheFirst           | 300 entries  | 30 d   |
| `/api/content/**`           | StaleWhileRevalidate | 100 entries  | 7 d    |
| `*.supabase.co`             | NetworkFirst (4 s)   | 50 entries   | 7 d    |
| `/parent/**`, `/api/parent` | _never runtime-cached_ | — | — |

All caches use Serwist's `ExpirationPlugin` with `purgeOnQuotaError: true`,
so the SW evicts oldest entries first when the browser flags storage
pressure. The 50 MB ceiling is enforced indirectly by these caps plus the
browser quota.

## Install timing

We deliberately do NOT call `prompt()` on page load. The UX/Safety rule is:

1. Wait for the child's first lesson to complete (`stars >= 1`).
2. Surface the install card with kid-friendly copy ("Add to my home
   screen", "Maybe later").
3. Persist the decision in Dexie. We never ask again from the SW layer.

## Dev mode

In `next dev` the SW is disabled by default to avoid stale-cache surprises
during hot reload. To exercise it locally:

1. Build for production: `pnpm --filter @e4k/web build`.
2. Or in dev, set `NEXT_PUBLIC_E4K_ENV=development` and visit any page with
   `?sw=enabled` once. The registration logic in
   `serwist-register.tsx` honours that flag.

## Generating real icons

The three PNGs the manifest references are currently placeholders (`.txt`
notes describing the spec). To produce the real assets:

1. Open the Milo source illustration (Figma / Inkscape).
2. Export a 512x512 PNG with cream (#FFF8EE) full-bleed background to
   `apps/web/public/icons/icon-512.png`.
3. Export a 192x192 PNG of the same to `apps/web/public/icons/icon-192.png`
   (re-export from the vector source — do NOT bitmap-downscale).
4. Export a 512x512 maskable PNG with Milo's face inside the inner 80% safe
   zone to `apps/web/public/icons/icon-maskable-512.png`.
5. Verify with the W3C maskable.app tool.
6. Delete the placeholder `.txt` files alongside.

Without the real PNGs the SW still installs and offline still works — but
Chromium will refuse the install prompt.
