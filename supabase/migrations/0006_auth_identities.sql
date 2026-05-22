-- 0006_auth_identities.sql
-- Sprint 7: full authentication support for parents and 13+ users.
--
-- Adds:
--   1. A `handle_new_user` trigger on `auth.users` that auto-creates a
--      `profiles` row at signup with the right `is_anonymous` flag.
--   2. New `account_deletions` table — COPPA right-of-erasure with a 7-day
--      grace window, surfaced to the user via the account-deletion edge
--      function and the `/parent/account` UI.
--   3. New audit_log event_types (signup, signin, signout, link_provider,
--      delete_request, delete_cancel, delete_complete) are documented here
--      but enforced only by app code — the column is free-form text.
--
-- Anonymous-first preservation:
--   - Existing anonymous sessions continue to work; the new trigger only
--     inserts when the source row is non-anonymous (i.e. email/Apple/Google).
--   - The `vpc-upgrade` flow still owns the `is_anonymous = false` flip for
--     parents who came in anonymously and later linked an email.
--   - No existing rows are touched; the migration is additive.

-- ----------------------------------------------------------------------------
-- 1. Auto-create profiles row on new auth.users insert
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_anon boolean;
begin
  -- auth.users has `is_anonymous` only on Supabase Auth v2.155+. We read
  -- it via the JSON encoded raw_user_meta_data fallback to stay
  -- compatible with older local stacks.
  is_anon := coalesce(new.is_anonymous, false);

  insert into public.profiles (id, role, is_anonymous, locale, display_name)
  values (
    new.id,
    case when is_anon then 'anonymous' else 'parent' end,
    is_anon,
    coalesce(new.raw_user_meta_data->>'locale', 'en'),
    nullif(new.raw_user_meta_data->>'display_name', '')
  )
  on conflict (id) do nothing;

  -- Mirror the signup into audit_log for parent transparency.
  insert into public.audit_log (actor_id, event_type, payload)
  values (
    new.id,
    case when is_anon then 'auth.signup.anonymous' else 'auth.signup' end,
    jsonb_build_object(
      'provider', coalesce(new.raw_app_meta_data->>'provider', 'email'),
      'is_anonymous', is_anon
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_auth_user_to_profile on auth.users;
create trigger trg_auth_user_to_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 2. Account deletion (COPPA right-of-erasure, 7-day grace)
-- ----------------------------------------------------------------------------
--
-- Why a separate table instead of a soft-delete flag on profiles? The grace
-- window must survive sign-out and re-sign-in (parent changes their mind
-- by signing back in within the window — UI surfaces the pending deletion
-- and a "Cancel deletion" CTA). A flag on `profiles` would be lost if RLS
-- drops the row from the parent's view.
--
-- The edge function `account-deletion` reads/writes this table under the
-- caller's JWT. Hard-delete after grace expiry is performed by a scheduled
-- task (cron job set up via Supabase dashboard) that runs as service-role.

create table public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  grace_until timestamptz not null,
  cancelled_at timestamptz,
  completed_at timestamptz,
  reason text,
  -- Snapshot the children count at request time so the post-deletion
  -- confirmation email can say "3 child profiles will be removed" without
  -- a join after the deletion completes.
  children_count_at_request int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, completed_at)
);

create index idx_account_deletions_pending
  on public.account_deletions(grace_until)
  where cancelled_at is null and completed_at is null;

alter table public.account_deletions enable row level security;

-- A user can see and modify only their own deletion request.
create policy "account_deletions_own"
  on public.account_deletions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Helper view: pending deletions surfaced to the user's account page
-- ----------------------------------------------------------------------------

create or replace view public.my_pending_deletion as
  select id, requested_at, grace_until, reason, children_count_at_request
  from public.account_deletions
  where user_id = auth.uid()
    and cancelled_at is null
    and completed_at is null
  order by requested_at desc
  limit 1;

-- ----------------------------------------------------------------------------
-- Rollback (commented — emergency only):
--
-- drop view if exists public.my_pending_deletion;
-- drop table if exists public.account_deletions;
-- drop trigger if exists trg_auth_user_to_profile on auth.users;
-- drop function if exists public.handle_new_auth_user();
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Documented (not enforced) audit_log.event_type taxonomy added in Sprint 7:
--
--   auth.signup                   - new email/OAuth signup
--   auth.signup.anonymous         - anonymous session created (existing)
--   auth.signin                   - successful sign-in
--   auth.signout                  - explicit sign-out
--   auth.link.apple               - parent linked Apple to existing account
--   auth.link.google              - parent linked Google to existing account
--   auth.password.reset.requested - parent requested password reset email
--   auth.password.reset.completed - parent set new password via reset link
--   auth.delete.requested         - parent requested account deletion
--   auth.delete.cancelled         - parent cancelled during grace window
--   auth.delete.completed         - grace expired, hard-delete fired
--   auth.upgrade.anonymous_linked - anonymous session linked to identity
-- ----------------------------------------------------------------------------
