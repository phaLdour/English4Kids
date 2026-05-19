'use client';

/**
 * Sentry init with strict scrubbing.
 *
 * Sprint 3 — Critic recommendation. The DSN is only read in production via
 * `NEXT_PUBLIC_SENTRY_DSN`; in development, dev, and on child routes the DSN
 * is unset so Sentry initialises into a no-op state. We do NOT route-scope
 * the init at the layout level today — that's a deliberate Sprint 3
 * compromise documented in `docs/safety/coppa-gdpr-k.md`.
 *
 * To enable Sentry: install `@sentry/nextjs` and set `NEXT_PUBLIC_SENTRY_DSN`
 * in the parent-dashboard deployment only. The `sentry-init.ts` module then
 * dynamically imports the SDK so child-only deployments don't ship the JS.
 */

interface SentryEventLike {
  message?: string;
  user?: { ip_address?: string };
  request?: { headers?: Record<string, string | undefined> };
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown> }>;
}

const CHILD_NAME_PATTERN =
  /\b(nickname|child_nickname|childName)\s*["'=:\s]*["']?[^"'\s,}]+/gi;

/**
 * Redact obvious child-identifying tokens from a string.
 * Public so it can be unit-tested directly without booting the SDK.
 */
export function redactChildIdentifiers(input: string): string {
  return input.replace(CHILD_NAME_PATTERN, '[redacted-nickname]');
}

/**
 * Pure event transformer. Strips IP, scrubs forwarding headers, and redacts
 * any obvious child-name tokens from messages and breadcrumb text.
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  if (event.user) delete event.user.ip_address;
  if (event.request?.headers) {
    delete event.request.headers['x-forwarded-for'];
    delete event.request.headers['x-real-ip'];
    delete event.request.headers['forwarded'];
  }
  if (typeof event.message === 'string') {
    event.message = redactChildIdentifiers(event.message);
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (typeof b.message === 'string') {
        b.message = redactChildIdentifiers(b.message);
      }
      if (b.data) {
        for (const k of Object.keys(b.data)) {
          const v = b.data[k];
          if (typeof v === 'string') {
            b.data[k] = redactChildIdentifiers(v);
          }
        }
      }
    }
  }
  return event;
}

/**
 * Initialise Sentry if the DSN env var is set. Safe to call multiple times.
 * Dynamically imports the SDK so the JS payload is zero-cost when disabled.
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    // Dynamic import so the SDK is omitted from bundles when Sentry is off.
    // If `@sentry/nextjs` is not installed (e.g. child-only deployment),
    // the import will reject and we silently skip.
    const Sentry: typeof import('@sentry/nextjs') = await import(
      /* webpackIgnore: true */
      '@sentry/nextjs'
    );

    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_E4K_ENV ?? 'development',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend(event) {
        return scrubSentryEvent(event as unknown as SentryEventLike) as typeof event;
      },
    });
  } catch (err) {
    // SDK missing or failed to initialise. Log once; do not surface.
    // eslint-disable-next-line no-console
    console.warn('[e4k] sentry init skipped', err);
  }
}
