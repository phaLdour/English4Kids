# ADR 0007 — Phase 2 cloud sync and email-plus VPC

- **Status:** Accepted
- **Date:** 2026-05-20
- **Deciders:** Product Architect, Safety & Privacy Officer, Backend Engineer
- **Supersedes:** —
- **Related:** ADR-0003 (Supabase), ADR-0004 (Leitner conflict policy)

## Context

Sprints 1–3 shipped the local-first app: progress, vocabulary, pronunciation
scores, and audit events all land in Dexie. The Supabase schema and RLS
policies were in place but nothing actually synced. Phase 2 turns sync on
for parents who have completed Verifiable Parental Consent (VPC) under COPPA,
keeps every other user fully offline, and adds production error reporting.

## Decisions

### 1. Email-plus VPC, not credit-card / video / signed-form

COPPA §312.5 enumerates several VPC methods. We choose **email-plus**:

1. Parent submits an email (`/vpc-upgrade/start`).
2. Parent clicks a confirmation link from that email (`/vpc-upgrade/confirm-first`).
3. Parent returns **≥ 24 hours later** and confirms a second time
   (`/vpc-upgrade/confirm-second`).

Email-plus is the lowest-friction COPPA-compliant method for an app where
purchases / sensitive disclosures aren't on the table; the 24-hour delay
between confirmations is what makes it a real "plus" rather than a
single-tap consent. The 7-day token expiry caps liability if the second
confirmation never happens.

Rejected alternatives:

- **Credit card $0.01 charge** — adds payment-provider scope, more PII, more
  liability. Save for if/when we add purchases.
- **Signed form upload** — too much friction for a free K-12 add-on.
- **ID upload** — disproportionate; raises new data-retention obligations.

### 2. Sync is OFF for anonymous users

Anonymous-first is the default. Cloud sync activates **only** after
`profiles.is_anonymous = false`. Three places enforce this:

1. `useAutoSync` skips the flush if the resolved parent profile is still
   anonymous (`apps/web/src/lib/sync-client.ts`).
2. The `sync-progress` Edge Function applies ops under the caller's JWT;
   RLS prevents writes to children the caller doesn't own, but the activation
   gate is the client-side `is_anonymous` check — by design, the server
   accepts ops from anonymous users too if the client somehow sends them
   (e.g. testing). The safety boundary is the **client gate**.
3. The Parent Dashboard's `/parent/account` page is the only way an
   anonymous profile ever becomes non-anonymous, and it walks through the
   24h double-opt-in.

### 3. Idempotent sync via `client_op_id`

Every Dexie `sync_outbox` row carries a `client_op_id` (UUID, generated
when the row is appended). The `sync-progress` Edge Function checks the
server-side `sync_outbox` for an existing row with the same `client_op_id`
and `applied_at IS NOT NULL` before applying — duplicates return
`status: 'duplicate'` and the client marks them as applied locally. A
unique constraint on `client_op_id` backs this up so duplicate inserts
fail loudly even under race conditions.

Batch size is capped at 50 ops per request (server accepts up to 100);
partial-failure isolation is per-op so a single rejected op doesn't tank
the batch.

### 4. Conflict policy (multi-device)

Reaffirming ADR-0003 / ADR-0004:

- **progress.upsert** — `max(stars)`, `max(best_score)`, `max(attempts_count)`
  on conflict. Gameplay is monotonic; never erase a star.
- **vocab.advance** — higher Leitner box wins (monotonic-union).
- **pronunciation.record** — insert-only, no conflict possible.
- **audit.append** — insert-only.

### 5. Anonymous → upgraded transition is atomic at the profile boundary

ADR-0003's red line was "children rows must not lose their parent_id
during upgrade". The upgrade flips
`profiles.is_anonymous = false` on a row whose `id` is **the same UUID
both before and after**. Foreign keys on `children.parent_id`,
`vpc_pending.parent_id`, etc., all continue to reference the same row.
There is no row-move and therefore no transactional risk on the data
side; the second-confirm endpoint executes the flip in a single statement
under the caller's JWT (RLS-checked).

### 6. Sentry is DSN-gated, not route-gated

The `@sentry/nextjs` SDK is now installed for real. Init still gates on
`NEXT_PUBLIC_SENTRY_DSN` being set; child-only deployments simply don't
provide the DSN and the SDK becomes a no-op. Scrubbing is unchanged from
Sprint 3 — `beforeSend` strips IP/email/username/cookies and redacts
`"nickname"|"childName"|"email"` JSON fragments from messages and
exception values.

Rejected: route-scoped init via instrumentation. Too brittle — a single
child route accidentally loading the parent layout's chunk would leak.
DSN gating + scrubbing is a simpler safety boundary.

## Consequences

**Positive**

- Anonymous users get the same UX as before; their data never leaves the
  device.
- COPPA email-plus VPC is the de-facto industry baseline; we satisfy it
  without taking on payment-provider scope.
- The sync protocol is idempotent and per-op partial-failure safe; flaky
  networks don't corrupt state.
- Sentry installed for real, with safety scrubbing intact and DSN gating
  preserved.

**Negative / Risks**

- The 24-hour second-confirmation delay is a real onboarding speed bump;
  we accept it as the cost of compliance.
- No email provider is wired in the sandbox — the function logs the
  confirmation link and returns a `devToken` for development. Production
  deploys must configure SMTP in Supabase before going live with VPC.
- `sync-progress` accepts ops from any authenticated caller (including
  anonymous ones) if the client somehow bypasses the `useAutoSync` gate.
  This is a defence-in-depth gap; a future migration may add a CHECK
  constraint that links `sync_outbox` writes to non-anonymous profiles.
- A rejected op stays in the local outbox forever until manually cleared
  or the rejection cause is fixed. Audit-log entries surface the
  rejection so the Parent Dashboard can show a "couldn't sync" banner.
