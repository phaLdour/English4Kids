/**
 * Sentry client entrypoint.
 *
 * Auto-discovered by `@sentry/nextjs` when the SDK is installed and a DSN is
 * configured. Until then this module is a no-op safety net.
 *
 * Sprint 3 compromise (see docs/safety/coppa-gdpr-k.md): the SDK loads on
 * every route, but with no DSN configured in child-only deployments it is a
 * no-op. The parent-dashboard deployment provides the DSN via env.
 */
import { initSentry } from './src/lib/sentry-init';

void initSentry();
