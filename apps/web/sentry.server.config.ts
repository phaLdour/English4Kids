/**
 * Sentry server entrypoint (Node runtime).
 *
 * Same DSN gate and scrubbing rules as the client config — see
 * `sentry.client.config.ts` for the design notes.
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
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers['x-forwarded-for'];
        delete event.request.headers.cookie;
      }
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
