'use client';

import { useEffect } from 'react';

/**
 * Registers `/sw.js` (emitted by Serwist) on mount.
 *
 * Gating logic:
 *   - In production, register unconditionally.
 *   - In development, only register if `NEXT_PUBLIC_E4K_ENV=development`
 *     AND the URL carries `?sw=enabled`. This lets us test offline behaviour
 *     locally without burning ourselves with stale-cache surprises during
 *     hot-reload.
 *
 * No telemetry. No third-party calls. The registration is silent so a kid
 * never sees a console error — failures are caught and logged once.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const isProd = process.env.NODE_ENV === 'production';
    const env = process.env.NEXT_PUBLIC_E4K_ENV ?? 'development';
    const params = new URLSearchParams(window.location.search);
    const devOptIn = env === 'development' && params.get('sw') === 'enabled';

    if (!isProd && !devOptIn) return;

    const register = async (): Promise<void> => {
      try {
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // updateViaCache: 'none' would re-fetch the SW on every nav; default
          // (imports-only) is safer for low-bandwidth devices.
        });
      } catch (err) {
        // Log once; do not surface a UI error — the app must still work
        // without a SW (no-offline mode).
        // eslint-disable-next-line no-console
        console.warn('[e4k] service worker registration failed', err);
      }
    };

    void register();
  }, []);

  return null;
}
