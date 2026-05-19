-- 0002_rls_policies.sql
-- Row-Level Security: every user-data row is keyed to a child whose
-- parent_id must equal auth.uid().
--
-- Content (units, lessons) is public-read; only the service role can write.

-- Enable RLS on all user-data tables
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.progress enable row level security;
alter table public.vocab_state enable row level security;
alter table public.pronunciation_attempts enable row level security;
alter table public.audit_log enable row level security;
alter table public.sync_outbox enable row level security;

-- Content tables are public-read, service-role-write
alter table public.units enable row level security;
alter table public.lessons enable row level security;

create policy "units_public_read" on public.units for select using (true);
create policy "lessons_public_read" on public.lessons for select using (true);

-- Profiles: a user can only see/edit their own profile
create policy "profiles_own_select" on public.profiles for select using (id = auth.uid());
create policy "profiles_own_update" on public.profiles for update using (id = auth.uid());
create policy "profiles_own_insert" on public.profiles for insert with check (id = auth.uid());

-- Children: only the parent can see/manage their children
create policy "children_parent_select" on public.children for select using (parent_id = auth.uid());
create policy "children_parent_modify" on public.children for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- Progress: only readable/writable by the parent of the child
create policy "progress_parent_access" on public.progress for all
  using (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));

-- Same pattern for vocab_state, pronunciation_attempts, audit_log, sync_outbox
create policy "vocab_state_parent_access" on public.vocab_state for all
  using (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));

create policy "pronunciation_parent_access" on public.pronunciation_attempts for all
  using (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));

create policy "audit_log_parent_select" on public.audit_log for select
  using (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));

create policy "sync_outbox_parent_access" on public.sync_outbox for all
  using (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()))
  with check (exists (select 1 from public.children c where c.id = child_id and c.parent_id = auth.uid()));
