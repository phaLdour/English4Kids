# ADR 0003 — Supabase (Postgres + Auth + RLS) as backend-of-record

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Product Architect, Safety & Privacy Officer, user
- **Supersedes:** —

## Context

We need:

- A backend that supports anonymous-first auth (kids should not need an account to play).
- Per-row authorization strong enough to handle child data under COPPA/GDPR-K.
- Free or near-free at MVP scale (low hundreds of users).
- Generous self-hosting / portability story so we are not locked in.
- Region pinning (EU users on EU servers).

## Decision

Adopt **Supabase** for:

- **Postgres** — single source of truth for progress, attempts, vocabulary state, parent settings.
- **Auth** — anonymous sign-in for kids; magic-link email for parents (deferred to Phase 2 — see below).
- **Row Level Security** — enforced on every table that contains child-attributable rows. RLS policies live in `supabase/migrations` and are reviewed in PR.
- **Edge Functions** (Phase 2) — for parent-dashboard CSV exports and scheduled `pronunciation_attempts` pruning.

Region selectable per deployment; the EU instance runs on `eu-central-1` (Frankfurt) by default.

### MVP is local-first

For Sprint 1–3 the app is **local-first** (Dexie). The Supabase client and migrations exist and `pnpm db:reset` works, but no production sync runs until **Phase 2** when email-plus-VPC parental verification ships. Until then, all child progress lives only in IndexedDB on the device.

### Business logic stays portable

To minimise lock-in:

- All learning logic (Leitner scheduling, scoring, mastery thresholds) lives in `packages/game-engine` as pure TypeScript with no Supabase imports.
- Database access goes through a thin `packages/data-access` repository layer that can be re-implemented on Postgres-without-Supabase if needed.

### Free-tier guardrails

Supabase free tier provides 500 MB DB. We expect `pronunciation_attempts` to be the heaviest table. Mitigation (Phase 2):

- Cap stored attempts to the **last 30 per (child, word)** via a scheduled cron-style Edge Function.
- Aggregate stats kept indefinitely; raw transcripts pruned aggressively.

## Consequences

**Positive**

- Auth + RLS + Postgres in one box; very low ops overhead at MVP scale.
- Local SDK + REST + GraphQL options — TanStack Query plugs straight in.
- Migration files in `supabase/migrations/*.sql` make schema reviewable in git.

**Negative / Risks**

- Vendor coupling at the data-access boundary — mitigated as described above.
- 500 MB free-tier cap is real; we have a pruning plan but it is not implemented at MVP.
- Anonymous auth + RLS combinations are subtle; every new table requires explicit policy review.

## Sync conflict policy (deferred)

When sync activates in Phase 2, multi-device conflicts are reconciled with **monotonic union** semantics for Leitner state (higher box wins) and **last-write-wins** for parent settings. To be revisited if it produces user-visible weirdness.

## Alternatives Rejected

| Option | Why rejected |
|---|---|
| Firebase | Google's child-data position is risk-laden; Firestore RLS is weaker than Postgres RLS; less portable. |
| Self-hosted Postgres + custom auth | Ops overhead too high for a solo/small team MVP. |
| PocketBase | Lighter, but no managed hosting story; SQLite primary store limits future scale. |
| Cloudflare D1 + Workers | Region pinning weak for GDPR-K; auth left to us. |
