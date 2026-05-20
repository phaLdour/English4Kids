# ADR 0011 — Sprint 5: server-side anonymous-first gate and Resend integration

- **Status:** Accepted
- **Date:** 2026-05-20
- **Deciders:** Backend Engineer, Safety & Privacy Officer, Product Architect
- **Supersedes:** —
- **Related:** ADR-0007 (Phase 2 cloud sync + VPC), ADR-0003 (Supabase),
  Critic Wave-2 and Wave-3 findings.

## Context

ADR-0007 §risk §1 acknowledged a real defence-in-depth gap: the
`sync-progress` Edge Function accepted ops from anonymous users because
the only activation gate was the **client-side** `useAutoSync` check. A
tampered build could bypass the JS guard and post arbitrary ops as an
anonymous Supabase user; RLS would still allow writes scoped to the
caller's own child, so a determined attacker could exfiltrate progress
to our cloud against the anonymous-first promise.

Sprint 4 added the email-plus VPC flow but never wired SMTP — production
sends were stubbed with a `console.log` confirmation link and a
`devToken` returned in the `/start` JSON response. Sprint 5 closes both
gaps without breaking the dev-mode E2E loop.

The user's constraint for Sprint 5: ship the code in a
Resend-API-ready / DNS-docs-ready state. The Resend account, DNS
records, and Supabase secret values are configured by the human
operator at the end; the codebase must work the moment those secrets
arrive.

## Decisions

### 1. Three-layer anonymous-first gate

The `sync-progress` path now refuses anonymous users at three
independent layers. Any single layer is sufficient; all three exist
because the failure mode of each is different.

| Layer        | Location                                                                | Mechanism                                                                                                                                                            | Bypass cost                                                                                                       |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Client       | `apps/web/src/lib/sync-client.ts` (`useAutoSync`)                       | Skips `flushSyncOutbox` if the Dexie profile row has `is_anonymous !== false`.                                                                                       | Edit + rebuild the bundle, or post directly to the function with a custom client.                                 |
| Edge function | `supabase/functions/sync-progress/index.ts` (after the JWT check)        | Looks up `profiles.is_anonymous` via the caller's JWT and returns `403 {"error":"anonymous-first"}` if true (or if the row is missing).                              | Bypass the function entirely — i.e. post directly to PostgREST with the same JWT.                                  |
| Database     | `supabase/migrations/0005_anonymous_sync_gate.sql`                       | Trigger `trg_sync_outbox_anon_gate` on `sync_outbox` `INSERT/UPDATE` raises `P0002` if the linked parent profile is anonymous. Runs `security definer` for reliability. | Requires DB-level access (service-role key); RLS prevents normal callers from touching the trigger logic.         |

The trigger fires only on `sync_outbox`, not on `progress`, `vocab_state`,
or `pronunciation_attempts`. The reason: `markOpApplied` writes a
`sync_outbox` row at the end of every successful op. If the outbox write
is refused, the edge function returns the op as `rejected` and the
client retries — so the data tables never accumulate orphaned writes.
Putting the trigger on every data table would multiply the failure
surface without adding security; the outbox is the chokepoint by
design.

Reject alternative: a CHECK constraint on `sync_outbox`. CHECK can't
read from another table, so we'd need a materialised mirror of
`profiles.is_anonymous` on `children` (or on every data table). That
duplicates state for no functional gain — the trigger is the right
shape.

### 2. Client surfacing of the 403

A 403 with `error: 'anonymous-first'` is a UX signal, not an error.
`postBatch` in `sync-client.ts` parses the body and throws a typed
`CloudSyncBlockedError`. `useAutoSync` distinguishes that error from
generic failures and exposes a new `blockedAnonymous: boolean` field,
plus a `localStorage[E4K_SYNC_BLOCKED_KEY]` mirror so the Parent
Dashboard can render the banner before re-firing a sync.

Every pending outbox row is left with `applied_at = null` so a
post-upgrade sync retries it; a per-row audit-log entry
`sync.blocked-anonymous` is appended so the parent can see why
nothing was uploaded.

### 3. Resend integration, dev-mode preserved

Production path:

1. `vpc-upgrade/start` accepts the email + caller JWT.
2. Renders `vpc-first-confirmation` from `_shared/email-templates.ts`.
3. POSTs to `https://api.resend.com/emails` with `RESEND_API_KEY`
   from the Edge Function secrets.
4. On failure, returns `502 {"error":"email-send-failed"}` with a
   generic parent-facing message. The Resend response body is logged
   server-side but never echoed to the client.

Dev path (selected when `RESEND_API_KEY` is missing OR
`EMAIL_DEV_MODE === 'true'`):

1. Logs the rendered subject (NOT body) and the confirmation link.
2. Returns the `devToken` in the response so the Parent Dashboard can
   render it inline for copy-paste. The Dashboard's render is gated on
   `NEXT_PUBLIC_E4K_ENV !== 'production'` as a second safety net.

The `?devSkipDelay=1` query param on `/confirm-second` remains gated by
`EMAIL_DEV_MODE === 'true'` AND the explicit param. Both halves of the
gate are intact; production deploys leave `EMAIL_DEV_MODE` unset.

### 4. Rate limit on `/start`

A new `vpc_rate_limit` table (Migration `0005`) caps `/start` at 5
calls per parent_id per rolling 60-minute window. The cap exists for
two reasons:

- Prevents an anonymous user from using our Resend account as an open
  relay against arbitrary inboxes (the address is supplied by the
  caller).
- Prevents a confused parent from spam-clicking through dozens of
  confirmation emails to the same inbox.

The cap is per `parent_id` (Supabase uid), not per IP. Edge Functions
don't get a stable client IP, and even if they did, NAT'd classrooms
would share one IP across many anonymous users — per-uid is the right
granularity.

Above the cap, the function returns `429` with `retry-after` seconds
and a `retryAfterSec` JSON field. The client surfaces this verbatim;
no auto-retry, no exponential backoff (the parent always re-clicks).

### 5. Email templates as a single source

`supabase/functions/_shared/email-templates.ts` exports three templates
(`vpc-first-confirmation`, `vpc-second-confirmation-reminder`,
`vpc-upgrade-complete`) plus a `renderEmailTemplate(name, data)`
dispatcher. Templates are plain template literals — Deno can't run JSX
without a bundler, and these templates need to render fast in the edge
runtime.

Each template ships HTML + plain-text variants. The plain-text variant
is sent in the `text` field of the Resend payload so screen readers,
plain-text mail clients, and spam-filter heuristics all see legible
content. Email-client compatibility constraints (inline styles only,
no external CSS, tables for layout) are encoded in the shell renderer
once.

A separate dev-only browser previewer lives at
`/dev/email-preview?template=...`. It re-implements the shapes (not a
shared import) because:

1. The edge templates use Deno-style `.ts` imports that Next strict-TS
   chokes on.
2. Marketing-copy templates should never ship in a production client
   bundle.

The Deno-runtime tests in
`supabase/functions/vpc-upgrade/email-template.test.ts` are the
source of truth for the actual copy; the previewer is for visual QA
only.

## Consequences

**Positive**

- Tampered clients can no longer leak anonymous-user progress to the
  cloud (edge layer) — and even if they bypass the edge function,
  they still can't write to `sync_outbox` (DB layer).
- Production email is wired and ready; turning it on is now a credit
  card + DNS task, not a code task.
- The Parent Dashboard gains a typed signal (`blockedAnonymous`) to
  surface a "verify your email" banner without re-firing a sync.
- Resend rate limit defends both our outbound spend and arbitrary
  third parties from spam.

**Negative / Risks**

- The DB trigger fires `security definer`, which means a future change
  to `profiles` RLS won't automatically tighten the trigger's read
  view. A reviewer must remember that the trigger always sees the
  full table — that's the point, but it's a foot-gun if anyone ever
  reuses the function for a different purpose.
- Rate-limit accounting lives in a small table writable by the caller
  via RLS. A coordinated attacker with many anonymous JWTs can still
  send up to 5 × N emails per hour. We accept this — the per-uid cap
  raises the cost meaningfully, and Resend's own account-level cap is
  the next layer of defence.
- The 24-hour COPPA gap remains unchanged; Sprint 5 explicitly does
  NOT shorten it. The dev-mode skip is unchanged from Sprint 4.
- The Parent Dashboard banner UI for `blockedAnonymous` is not yet
  visualised — the hook exposes the flag; the dashboard component
  consumes it in Sprint 6 (out of scope here, but the contract is
  pinned by `sync-client.test.ts`).

## What the human operator does at the end of Sprint 5

See `docs/devops/email-setup.md` for the full checklist. Summary:

1. Create a Resend account.
2. Add the sending domain and the three DNS records (SPF / DKIM / DMARC).
3. Set Supabase Edge Function secrets: `RESEND_API_KEY`, `EMAIL_FROM`.
   Confirm `EMAIL_DEV_MODE` is unset.
4. Smoke-test delivery and the rate limit per the doc.
5. Apply migration `0005_anonymous_sync_gate.sql` to the production
   database (`supabase db push`).
