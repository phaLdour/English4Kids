/**
 * Sentry edge-runtime entrypoint (middleware, edge routes).
 *
 * Same DSN gate and scrubbing rules as the client config.
 */

import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function scrub(s: string): string {
  return s.replace(
    /"(nickname|childName|child_name|email)"\s*:\s*"[^"]*"/g,
    '"$1":"[redacted]"',
  );
}

Sentry.init({
  dsn: DSN,
  enabled: Boolean(DSN),
  environment: process.env.NEXT_PUBLIC_E4K_ENV ?? 'development',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
      delete event.user.email;
      delete event.user.username;
    }
    if (typeof event.message === 'string') {
      event.message = scrub(event.message);
    }
    if (event.exception?.values) {
      for (const e of event.exception.values) {
        if (typeof e.value === 'string') e.value = scrub(e.value);
      }
    }
    return event;
  },
});
