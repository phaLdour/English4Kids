/**
 * Sentry edge-runtime entrypoint (middleware, edge routes).
 *
 * Same DSN gate and shared scrubber as the client config.
 */

import { scrubSentryEvent } from '@/lib/sentry-init';
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  enabled: Boolean(DSN),
  environment: process.env.NEXT_PUBLIC_E4K_ENV ?? 'development',
  // Matches client + CI source-map upload — see ADR-0014.
  release: process.env.NEXT_PUBLIC_E4K_RELEASE ?? 'dev',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
