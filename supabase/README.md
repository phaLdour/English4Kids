# English4Kids — Supabase

Local Postgres + Auth + Storage for development. The schema is owned by
`migrations/`; production is applied via `supabase db push` in CI.

## Quick start

```bash
# One-time
brew install supabase/tap/supabase   # or: npm i -g supabase

# Daily
supabase start                       # boots local stack on the ports in config.toml
supabase db reset                    # re-applies every migration from scratch
supabase status                      # shows local URLs + anon/service keys
```

`supabase start` runs `migrations/*.sql` in filename order:

1. `0001_initial_schema.sql` — tables, indices, updated-at triggers.
2. `0002_rls_policies.sql` — Row-Level Security policies. All user tables are
   keyed to `auth.uid()` via the `children.parent_id` chain.
3. `0003_seed_content.sql` — units + lessons metadata for the 3 MVP units.

## Service role key

The service role key bypasses RLS. It MUST live in environment variables
(`SUPABASE_SERVICE_ROLE_KEY`) on server-side workers only. It MUST NOT be
committed to git, ever, and MUST NOT be exposed to the browser bundle.

Recommended layout:

- `.env.local` (gitignored): `SUPABASE_SERVICE_ROLE_KEY=...`
- Browser bundle reads only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Critic notes (Wave-1)

- **Leitner not SM-2.** `vocab_state` uses Leitner 5-box (`box`,
  `consecutive_correct`, `due_at`). Do not add SM-2-style `ease_factor`,
  `interval`, or `repetitions` columns without a fresh Pedagogy review.
- **No audio blobs.** `pronunciation_attempts` stores only numeric `score`,
  `band`, and a short `recognized_text` (the recognised word). Never extend
  this table to store raw audio, MediaRecorder output, or anything resembling
  a voice sample. The audio stays on-device.
- **No child free text in audit_log.** `audit_log.payload` is JSONB and is
  tempting to use as a kitchen sink. Writers MUST sanitise: payload may
  contain ids, lesson keys, numeric scores, and enum strings only. Anything
  a child typed or spoke is forbidden here.
- **Curated nicknames only.** `children.nickname` is filled from a fixed
  list of animal names. Real names are out of scope for MVP.

## Migration policy

- One migration = one logical change. Never edit a migration after it has
  been merged; add a follow-up migration instead.
- Filename pattern: `NNNN_short_snake_case.sql` with a 4-digit zero-padded
  prefix to preserve apply order.
