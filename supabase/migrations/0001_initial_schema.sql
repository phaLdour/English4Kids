-- 0001_initial_schema.sql
-- English4Kids initial schema.
--
-- Critic Wave-1 S0 correction: spaced repetition uses Leitner 5-box (NOT
-- SM-2). See `vocab_state` below — fields are `box`, `consecutive_correct`,
-- `due_at`, `last_result`.
--
-- Pedagogy contracts encoded here:
--   * pronunciation_attempts: score is numeric ONLY; no audio blobs, no
--     transcript longer than the recognised word.
--   * audit_log: free-form `payload jsonb` — caller MUST NOT write
--     child-authored free text here (see supabase/README.md).

-- Profiles (anonymous-first, optional account upgrade — Phase 2)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'anonymous')),
  display_name text,
  locale text not null default 'en',
  is_anonymous boolean not null default true,
  upgraded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Children — multiple per parent profile
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,  -- curated animal nickname only, no real names
  avatar_key text,
  age_band text not null check (age_band in ('6-8', '9-12')),
  birth_year smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Content metadata (immutable; content itself lives in repo JSON)
create table public.units (
  id text primary key,  -- slug, e.g. '01-me-and-my-world'
  title_key text not null,
  order_index smallint not null,
  cefr text not null
);

create table public.lessons (
  id text primary key,  -- 'u1.l1'
  unit_id text not null references public.units(id),
  title_key text not null,
  order_index smallint not null
);

-- Per-child progress
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  lesson_id text not null references public.lessons(id),
  status text not null check (status in ('locked', 'in_progress', 'completed', 'mastered')) default 'in_progress',
  stars smallint not null check (stars between 0 and 3) default 0,
  best_score numeric(5, 2),
  attempts_count int not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, lesson_id)
);

-- Leitner 5-box spaced repetition state (NOT SM-2 — Critic S0 correction)
create table public.vocab_state (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  word_key text not null,
  box smallint not null check (box between 1 and 5) default 1,
  consecutive_correct smallint not null default 0,
  last_result text check (last_result in ('correct', 'incorrect')),
  last_seen_at timestamptz,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, word_key)
);

-- Pronunciation scores (NUMERIC ONLY — no audio blobs ever)
create table public.pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  word_key text not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  band text not null check (band in ('great', 'good', 'try-again')),
  recognized_text text,
  engine text not null check (engine in ('web-speech', 'whisper-wasm')),
  attempted_at timestamptz not null default now()
);

-- Audit log (parent transparency)
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  child_id uuid references public.children(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Sync outbox (offline → online reconciliation)
create table public.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  client_op_id text not null unique,  -- idempotency
  op_type text not null,
  op_payload jsonb not null,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indices
create index idx_progress_child on public.progress(child_id);
create index idx_vocab_state_due on public.vocab_state(child_id, due_at);
create index idx_pronunciation_child_word on public.pronunciation_attempts(child_id, word_key);
create index idx_audit_child on public.audit_log(child_id, occurred_at desc);
create index idx_sync_pending on public.sync_outbox(child_id) where applied_at is null;

-- Updated-at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_children_updated before update on public.children for each row execute function public.set_updated_at();
create trigger trg_progress_updated before update on public.progress for each row execute function public.set_updated_at();
create trigger trg_vocab_state_updated before update on public.vocab_state for each row execute function public.set_updated_at();
