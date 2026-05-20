/**
 * Sentry server entrypoint (Node runtime).
 *
 * Same DSN gate and shared scrubber as the client config. Server bundles do
 * not impact kid-device JS payload, so the SDK is imported eagerly — but
 * `enabled` still gates network egress when DSN is unset.
 */

import { scrubSentryEvent } from '@/lib/sentry-init';
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: DSN,
  enabled: Boolean(DSN),
  environment: process.env.NEXT_PUBLIC_E4K_ENV ?? 'development',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
