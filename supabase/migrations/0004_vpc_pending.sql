-- 0004_vpc_pending.sql
-- Email-plus Verifiable Parental Consent (COPPA) pending tokens.
--
-- Two-step double opt-in: a parent submits an email, gets a confirmation link
-- ("first" confirmation), then must return >= 24h later to confirm a second
-- time. Only after both confirmations may the anonymous profile be upgraded
-- to a real account with a linked email. See docs/adr/0007-phase-2-cloud-sync-and-vpc.md.
--
-- Retention: rows expire 7 days after `requested_at`. A scheduled prune is
-- intentionally OUT of scope for this migration — the `expires_at` column is
-- the contractual ceiling we rely on; an Edge Function cron may be added in a
-- later migration.

create table public.vpc_pending (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token text not null unique,
  requested_at timestamptz not null default now(),
  first_confirmed_at timestamptz,
  second_confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index idx_vpc_pending_parent on public.vpc_pending(parent_id);
create index idx_vpc_pending_token on public.vpc_pending(token);

alter table public.vpc_pending enable row level security;

-- A parent may only see/manage their own pending VPC rows. Anonymous Supabase
-- users (pre-upgrade) qualify here: their `auth.uid()` matches the `parent_id`
-- of the row they created. RLS does the rest.
create policy "vpc_pending_own" on public.vpc_pending
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- COPPA retention: expired rows auto-rotate.
-- (Cron job out of scope; the seven-day expires_at is the contractual ceiling.)
