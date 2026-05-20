/**
 * Sentry init + PII scrubber (Critic Wave-2 §2.6, §4.4).
 *
 * Two responsibilities, kept in one file so the three runtime configs
 * (`sentry.client.config.ts`, `sentry.server.config.ts`,
 * `sentry.edge.config.ts`) and the optional client-side dynamic init all
 * share the same scrubbing rules:
 *
 *   1. `scrubSentryEvent` — pure event transformer that strips IP, cookies,
 *      forwarding headers, redacts PII-shaped JSON fragments inside free-form
 *      strings (`message`, `exception.value`, `request.query_string`,
 *      breadcrumb messages + data, and context values).
 *   2. `initSentry` — dynamic-import boot used by the client-only path. When
 *      `NEXT_PUBLIC_SENTRY_DSN` is unset the SDK is never loaded, which keeps
 *      ~40-50 KB of @sentry/nextjs JS off child-only deployments.
 *
 * The 3 sentry config files import `scrubSentryEvent` directly and pass it
 * through `beforeSend` so a single test suite covers every runtime.
 *
 * This module has NO `@sentry/nextjs` import at the top level — keeping it
 * tree-shake-friendly so it can be safely imported from server bundles even
 * when Sentry is disabled.
 */

interface SentryUserLike {
  ip_address?: string;
  email?: string;
  username?: string;
}

interface SentryRequestLike {
  cookies?: unknown;
  headers?: Record<string, string | undefined>;
  query_string?: string | unknown;
}

interface SentryBreadcrumbLike {
  message?: string;
  data?: Record<string, unknown>;
}

interface SentryExceptionValueLike {
  value?: string;
}

interface SentryExceptionLike {
  values?: SentryExceptionValueLike[];
}

interface SentryEventLike {
  message?: string;
  user?: SentryUserLike;
  request?: SentryRequestLike;
  breadcrumbs?: SentryBreadcrumbLike[];
  exception?: SentryExceptionLike;
  contexts?: Record<string, Record<string, unknown> | undefined>;
}

/**
 * Keys we treat as PII inside JSON-shaped free-form strings. The list is
 * intentionally explicit so adding a new field requires a code change + test.
 * Critic Wave-2 §2.6 flagged that the original regex missed `display_name`,
 * `parent_email`, snake_case variants, and ignored breadcrumbs / contexts.
 */
const PII_KEYS = [
  'nickname',
  'childName',
  'child_nickname',
  'child_name',
  'displayName',
  'display_name',
  'parentEmail',
  'parent_email',
  'email',
  'phone',
  'phoneNumber',
  'phone_number',
] as const;

// Match `"key":"value"` or `"key": "value"` (with optional whitespace). The
// value side is non-greedy and stops at the first unescaped quote — that's
// good enough for typical JSON-encoded log payloads and avoids regex
// catastrophic backtracking on long strings.
const PII_JSON_PATTERN = new RegExp(`"(${PII_KEYS.join('|')})"\\s*:\\s*"[^"]*"`, 'g');

// Legacy free-form pattern: `nickname=Penguin`, `childName: Mila`, etc. for
// breadcrumbs that originate from `console.log("nickname:", value)` and never
// went through JSON.stringify. The value charclass excludes the `[]` brackets
// used by our `[redacted]` sentinel so chained passes are idempotent.
const PII_FREEFORM_PATTERN = new RegExp(
  `\\b(${PII_KEYS.join('|')})\\b\\s*[=:]\\s*([^\\s,;}\\[\\]"']+)`,
  'gi',
);

/** Redact PII tokens from an arbitrary string. Pure; safe to unit-test. */
export function redactPii(input: string): string {
  return input
    .replace(PII_JSON_PATTERN, (_match, key: string) => `"${key}":"[redacted]"`)
    .replace(PII_FREEFORM_PATTERN, (_match, key: string) => `${key}=[redacted]`);
}

/** Back-compat shim — Sprint 3 tests imported this name. */
export const redactChildIdentifiers = redactPii;

function scrubRecord(record: Record<string, unknown>): void {
  for (const k of Object.keys(record)) {
    const v = record[k];
    if (typeof v === 'string') record[k] = redactPii(v);
  }
}

/**
 * Pure event transformer. Strips identifying fields and runs the PII scrubber
 * over every free-form string field that Sentry may carry. The function
 * mutates the passed event for performance and returns it for chaining.
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }

  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers['x-forwarded-for'];
      delete event.request.headers['x-real-ip'];
      delete event.request.headers.forwarded;
      delete event.request.headers.cookie;
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = redactPii(event.request.query_string);
    }
  }

  if (typeof event.message === 'string') {
    event.message = redactPii(event.message);
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (typeof ex.value === 'string') ex.value = redactPii(ex.value);
    }
  }

  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (typeof b.message === 'string') b.message = redactPii(b.message);
      if (b.data && typeof b.data === 'object') scrubRecord(b.data);
    }
  }

  if (event.contexts && typeof event.contexts === 'object') {
    for (const ctx of Object.values(event.contexts)) {
      if (ctx && typeof ctx === 'object') scrubRecord(ctx);
    }
  }

  return event;
}

interface SentryLike {
  init(options: Record<string, unknown>): void;
}

/**
 * Initialise Sentry from a client entrypoint (e.g. a layout-level
 * `useEffect`). Dynamic-imports the SDK so the JS payload is zero-cost when
 * DSN is unset — kid-only deployments never download @sentry/nextjs.
 *
 * The import specifier is built at runtime to keep both webpack and vitest's
 * static analysers from trying to resolve it eagerly. webpack still tracks the
 * dynamic chunk because the string literal lives in the source, just not on a
 * single line that would trip dependency-graph extraction.
 *
 * Safe to call multiple times; the SDK's `init` is idempotent.
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const sentryModule = '@sentry/' + 'nextjs';
    const Sentry = (await import(/* @vite-ignore */ sentryModule)) as SentryLike;

    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_E4K_ENV ?? 'development',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend(event: SentryEventLike) {
        return scrubSentryEvent(event);
      },
    });
  } catch (err) {
    // SDK missing or failed to initialise. Log once; do not surface.
    // eslint-disable-next-line no-console
    console.warn('[e4k] sentry init skipped', err);
  }
}
