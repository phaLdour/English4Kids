# Supabase secrets + deploy runbook — Sprint 5

Backend production setup for English4Kids. Covers logging in to the
Supabase CLI, linking the local repo to the hosted project, setting
Edge Function secrets, deploying the three Sprint-5 functions, and
applying the database migrations.

Reference: `docs/devops/secrets-management.md` (backend table),
`docs/adr/0011-sprint-5-server-side-gate-and-resend.md`,
`docs/adr/0014-sprint-5-secrets-and-sentry-sourcemaps.md`.

## 1. Login + link

```bash
npx supabase login                       # opens browser, stores ~/.supabase/access-token
npx supabase link --project-ref <ref>    # ref from the Supabase dashboard URL
```

`<ref>` is the 20-character slug visible in
`https://supabase.com/dashboard/project/<ref>` and also in
`NEXT_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`).

After linking, `supabase/config.toml` is reconciled with the hosted
project. The link is per-checkout, not committed.

## 2. Set Edge Function secrets

The functions read these via `Deno.env.get(...)`. They are not the
same as the database connection envs — they live in a separate Edge
Functions secret store.

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM=noreply@english4kids.app \
  ALLOWED_ORIGIN=https://english4kids.app
```

`EMAIL_DEV_MODE` must stay **unset** in production. Setting it to
`true` bypasses the COPPA 24-hour waiting window in `vpc-upgrade` —
see ADR-0011 §"Dev mode escape hatches".

Verify:

```bash
npx supabase secrets list
```

Expected: `RESEND_API_KEY`, `EMAIL_FROM`, `ALLOWED_ORIGIN` present,
no `EMAIL_DEV_MODE`.

## 3. Deploy Edge Functions

```bash
npx supabase functions deploy sync-progress
npx supabase functions deploy vpc-upgrade
npx supabase functions deploy parent-export
```

Each call uploads the function and switches traffic atomically. Roll
back with `npx supabase functions deploy <name> --legacy-bundle false`
plus the previous revision from the dashboard.

## 4. Apply migrations

```bash
npx supabase db push
```

This applies every file in `supabase/migrations/` in lexical order.
The Sprint 5 set:

- `0001_initial_schema.sql`
- `0002_rls_policies.sql`
- `0003_seed_content.sql`
- `0004_vpc_pending.sql`
- `0005_anonymous_sync_gate.sql`

`db push` is idempotent — re-running on an already-applied DB is a
no-op. If you need to inspect what would change first:

```bash
npx supabase db diff --linked
```

## 5. Resend DNS

The Resend account ships a SPF + DKIM record set per verified domain.
Add them at the DNS provider before the first production send, then
hit **Verify** in the Resend dashboard. See
`docs/devops/email-setup.md` for the per-record details (TXT contents,
TTL recommendations).

Until DNS is verified, Resend rejects sends from the configured
`EMAIL_FROM`. The `vpc-upgrade` function falls back to its dev-mode
behaviour (log the token; do not throw) when `EMAIL_DEV_MODE=true`,
but in production it surfaces the error to the caller as HTTP 502.

## 6. Verification

End-to-end smoke from the parent dashboard:

1. Sign in to a freshly created Supabase account.
2. From `/parent/account`, request VPC upgrade.
3. Confirm the confirmation email arrives at the parent inbox within
   60 seconds.
4. Click the link, complete the second confirmation 24 hours later,
   confirm `account.coppa_status='verified'` in the DB.

The Playwright spec at `tests/e2e/parent-vpc.spec.ts` does the same
flow with the dev-mode `?devSkipDelay=1` hatch when running locally.
