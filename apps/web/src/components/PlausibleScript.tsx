'use client';

/**
 * Plausible analytics loader — PARENT ROUTES ONLY.
 *
 * Sprint 5 S5-5. This component is mounted from `/parent/layout.tsx` so it
 * loads on every parent route (including the math gate itself) but never on
 * any child-facing route (`/play/*`, `/garden`, `/onboarding`, `/settings`,
 * `/`, `/privacy`).
 *
 * Activation: the script is only emitted when
 * `process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set at build time. Until the
 * user creates a Plausible account and configures the domain, this component
 * renders nothing — keeping the codebase Plausible-ready without leaking any
 * tracking traffic.
 *
 * Variant: we use the `tagged-events` build so individual buttons can declare
 * custom event names via `className="plausible-event-name=..."`. Programmatic
 * events go through `apps/web/src/lib/plausible-events.ts` which wraps the
 * `window.plausible(...)` global.
 *
 * Privacy posture:
 *   - Cookieless by default (no consent banner required).
 *   - No PII captured — only parent's URL, referrer, user agent.
 *   - EU-hosted (Plausible Cloud) — see `docs/safety/coppa-gdpr-k.md`.
 *   - Disclosed in `/privacy` under the "Parent Dashboard Analytics" section.
 *
 * SAFETY INVARIANT: this file MUST only be imported from `/parent/layout.tsx`.
 * The E2E test `tests/e2e/plausible-child-isolation.spec.ts` enforces that
 * no `<script src="*plausible*">` ever appears on a child-facing route.
 */
import Script from 'next/script';

export function PlausibleScript(): React.JSX.Element | null {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  return (
    <Script
      src="https://plausible.io/js/script.tagged-events.js"
      data-domain={domain}
      strategy="afterInteractive"
      defer
    />
  );
}
