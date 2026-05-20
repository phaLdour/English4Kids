/**
 * Sentry client entrypoint.
 *
 * Sprint 4 (Critic Wave-2 §4.4): the SDK is now dynamic-imported behind the
 * DSN gate. When `NEXT_PUBLIC_SENTRY_DSN` is unset (dev, preview, child-only
 * deployments) the `@sentry/nextjs` chunk is never loaded — webpack treats
 * the import as a separate chunk and skips it from the initial bundle. That
 * saves ~40-50 KB gzipped on first paint for the kid-facing pages.
 *
 * Scrubbing rules live in `src/lib/sentry-init.ts` so the same `beforeSend`
 * implementation covers client / server / edge runtimes and is unit-tested
 * once.
 */

import { scrubSentryEvent } from '@/lib/sentry-init';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: DSN,
      enabled: true,
      environment: process.env.NEXT_PUBLIC_E4K_ENV ?? 'development',
      // See `src/lib/sentry-init.ts` and ADR-0014 §"Sentry source-map upload"
      // — release is the git SHA in CI, "dev" otherwise.
      release: process.env.NEXT_PUBLIC_E4K_RELEASE ?? 'dev',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend(event) {
        return scrubSentryEvent(event);
      },
    });
  });
}
