import type { MetadataRoute } from 'next';

// Next.js requires route handlers to declare static-only output when the
// build runs in `output: 'export'` mode (the mobile target). The PWA
// manifest is fully static so we just pin it to `force-static`; this
// keeps the SSR web build untouched while the Capacitor build can serve
// the manifest as a baked file inside the WebView.
export const dynamic = 'force-static';

/**
 * PWA manifest. PNG icons are placeholders — see
 * `apps/web/public/icons/icon-*.png.txt` for the spec the Design team needs
 * to produce. Without real PNGs the "Install" prompt will be rejected by
 * Chromium; the rest of the PWA (offline cache) still works.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'English4Kids',
    short_name: 'E4K',
    description: 'Audio-rich English learning adventures for kids 6 to 12.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFF8EE',
    theme_color: '#FFF8EE',
    categories: ['education', 'kids'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
