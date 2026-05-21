-- 0005_anonymous_sync_gate.sql
-- Sprint 5 S5-3 (Critic Wave-3): enforce anonymous-first sync at the database
-- boundary. Anonymous profiles (`is_anonymous = true`) must NEVER produce rows
-- in `sync_outbox` via the `sync-progress` edge function. The client-side
-- `useAutoSync` gate is defense-in-depth #1; this migration adds
-- defense-in-database (#2). The edge function adds an explicit pre-flight
-- check (defense-in-edge #3) — see `supabase/functions/sync-progress/index.ts`.
--
-- Why a trigger and not a CHECK constraint? CHECK cannot read a row from
-- another table; we need to look at `profiles.is_anonymous` via the
-- `children.parent_id` link.
--
-- Why `security definer`? The trigger runs in the context of the caller's
-- JWT. Without `security definer`, RLS on `profiles` would hide the parent
-- row from the caller (the parent row is theirs to read — RLS allows that —
-- but we want to be belt-and-braces against future RLS tightening). Reads
-- are confined to a single column on a single row keyed by `id`; the
-- function never writes.

create or replace function public.assert_parent_is_authenticated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_anon boolean;
begin
  -- Look up the parent's anonymous flag via the child link.
  select p.is_anonymous into parent_anon
  from public.profiles p
  join public.children c on c.parent_id = p.id
  where c.id = new.child_id;

  if parent_anon is null then
    -- No matching parent profile for this child. Block the write — the
    -- caller is either mis-keyed or attempting an enumeration probe.
    raise exception 'no parent profile for child %', new.child_id
      using errcode = 'P0001';
  end if;

  if parent_anon then
    -- The hard gate: anonymous profiles cannot sync.
    raise exception 'anonymous-first: profile must upgrade via VPC before syncing'
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;

-- Apply to sync_outbox writes. The edge function upserts into this table at
-- the end of every applied op (`markOpApplied`). Blocking writes here means
-- a tampered client that bypasses the JS gate still cannot persist a
-- sync_outbox row server-side.
drop trigger if exists trg_sync_outbox_anon_gate on public.sync_outbox;
create trigger trg_sync_outbox_anon_gate
  before insert or update on public.sync_outbox
  for each row execute function public.assert_parent_is_authenticated();

-- Note on `progress`, `vocab_state`, `pronunciation_attempts`:
--
-- These tables are written by the same edge function pipeline, but their
-- conflict-merge logic relies on UPSERT semantics (max(stars), max(box),
-- etc.). Adding the same gate trigger to them would mean a single point
-- of failure for every legitimate parent write too. The `sync_outbox`
-- trigger is the chokepoint: every successful op MUST mark an outbox row
-- via `markOpApplied`. If the outbox write is blocked, the parent never
-- sees `applied` in the response, the client keeps the row pending, and
-- the next batch resubmits (and gets blocked again).
--
-- Defence-in-depth layers, in order of who blocks first:
--   1. `useAutoSync` short-circuit (client) — fails closed if anonymous.
--   2. Pre-flight `is_anonymous` check in the edge function (server) —
--      returns 403 `anonymous-first` before any DB write.
--   3. This trigger (DB) — refuses the `sync_outbox` upsert even if the
--      edge function is bypassed entirely (e.g. someone POSTs directly to
--      the table via PostgREST under their JWT).
--
-- ----------------------------------------------------------------------------
-- Rollback (intentionally commented out — emergency use only):
--
-- drop trigger if exists trg_sync_outbox_anon_gate on public.sync_outbox;
-- drop function if exists public.assert_parent_is_authenticated();
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Sprint 5 S5-4: rate limiting for vpc-upgrade /start
--
-- Critic Wave-3 flagged: nothing caps how often an anonymous user can hit
-- /start with different emails. Without a cap, an attacker can use our
-- Resend account to bomb arbitrary inboxes, and a confused parent can
-- accidentally trigger a dozen confirmation emails by spam-clicking.
--
-- The cap is keyed by `parent_id` (the caller's anonymous-Supabase uid).
-- A 1-hour sliding window with a 5-call ceiling is the policy; the edge
-- function enforces it. See supabase/functions/vpc-upgrade/index.ts.
-- ----------------------------------------------------------------------------

create table if not exists public.vpc_rate_limit (
  parent_id uuid primary key references public.profiles(id) on delete cascade,
  start_count int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.vpc_rate_limit enable row level security;

-- A parent can only see/modify their own rate-limit row. The edge function
-- reads + upserts under the caller's JWT; service-role is not used.
create policy "vpc_rate_limit_own" on public.vpc_rate_limit
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
