/**
 * Privacy policy version + effective date constants.
 *
 * Sprint 5 S5-6 ships v1.0 — the first production-grade policy covering MVP
 * (anonymous local-first) plus Phase 2 (cloud sync via VPC, transactional
 * email via Resend, Sentry error logging, Plausible parent-only analytics).
 *
 * When the policy materially changes, bump `PRIVACY_VERSION` and
 * `PRIVACY_EFFECTIVE_DATE` together and add an entry in the page's change-log
 * section. Material changes (new data category, new processor, new
 * jurisdiction) MUST also trigger a re-confirmation flow at the math gate
 * per the policy's own change-management clause.
 */
export const PRIVACY_VERSION = '1.0' as const;
export const PRIVACY_EFFECTIVE_DATE = '2026-05-20' as const;
