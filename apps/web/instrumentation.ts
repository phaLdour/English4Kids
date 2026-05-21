/**
 * Next.js 15 instrumentation hook.
 *
 * Loads the runtime-appropriate Sentry config only when `NEXT_PUBLIC_SENTRY_DSN`
 * is set. The DSN gate inside each config would already no-op the SDK, but
 * skipping the import entirely keeps the @sentry/nextjs Node SDK out of
 * cold-start memory on child-only deployments.
 */

export async function register(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
