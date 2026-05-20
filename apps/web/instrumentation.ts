/**
 * Next.js 15 instrumentation hook.
 *
 * Loads the runtime-appropriate Sentry config. The DSN gate inside each
 * config makes this a no-op when `NEXT_PUBLIC_SENTRY_DSN` is unset.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
