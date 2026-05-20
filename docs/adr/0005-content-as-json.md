# ADR 0005 — Content as in-repo JSON validated by Zod

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Content Designer, Product Architect, Pedagogy Lead, user
- **Supersedes:** —

## Context

We need a way to author and ship lesson content (units, lessons, activities, vocabulary, stories, songs) that:

- Works offline by default — content must be available in the PWA cache without a network round-trip.
- Is type-safe — invalid content should fail in CI, not in front of a child.
- Is reviewable in pull requests — diffs should be human-readable.
- Has a low operational overhead for an MVP with no dedicated CMS user.
- Allows banned-phrasing lint to run over copy (e.g. "wrong!", "stupid", "fail").

## Decision

**Content lives in `content/units/*.json`** as the canonical source of truth.

- Each unit is a single JSON file conforming to a Zod schema defined in `packages/content-schema`.
- `pnpm validate:content` (run in CI via the `validate-content` job) parses every JSON file and fails on any schema error.
- A banned-phrasing lint (also in `validate:content`) greps copy fields for forbidden tokens (see `docs/pedagogy/README.md`) and fails on match.
- A separate **phonemes** directory `content/phonemes/<unit>.json` is **generated at build time** by a one-shot script that runs the CMU pronouncing dictionary over the vocabulary list. The generated JSON is committed (so we don't ship the CMU dict to clients).
- Unit manifest carries `schemaVersion` (semver) — when we change the schema, content authors get a clear migration target.

### Loading at runtime

- The `apps/web` build imports the active unit JSONs statically (small, ~30–80 KB each) for fast first paint.
- Future units are lazy-precached by Serwist on idle once the user is past onboarding.

### Why not a headless CMS at MVP

- Adds an operational dependency (Sanity / Strapi / Contentful) before we have non-engineer authors.
- Authoring UX for a CMS does not solve "the JSON must be valid" — Zod does.
- Easier to migrate JSON → CMS later than the reverse.

A move to a headless CMS is on the table for **Phase 2** when (a) a non-engineer joins authoring or (b) per-locale workflows become heavy.

## Consequences

**Positive**

- Content ships with the app bundle (no extra fetch) — perfect for offline.
- PRs reviewable end-to-end.
- Zod schema doubles as a TypeScript type, so the engine code never has to defensively parse content at runtime.

**Negative / Risks**

- Authors must edit JSON. Mitigation: VS Code with the schema reference gives autocomplete. Phase 2 brings a CMS if needed.
- Large content libraries may bloat the bundle. Mitigation: lazy-precache per unit; only the entry unit is in the initial bundle.

## Verification

- CI `validate-content` job parses every unit file every push.
- Banned-phrasing tests live alongside the schema.
- `pnpm validate:content` runs locally pre-commit (via lint-staged in a later sprint).

## Alternatives Rejected

| Option | Why rejected |
|---|---|
| Sanity / Strapi / Contentful at MVP | Operational overhead too high for the value at this stage. |
| Markdown-with-frontmatter | Weak structure; can't validate nested activity shapes. |
| Google Sheets export | Authors love it, but no validation, no PR review, fragile. |
| YAML | Schema validation works equally well; JSON wins on tooling familiarity and copy-paste of structured content. |

## Addendum (2026-05-20) — Sprint 3 sentence-chunk variant + content-shape lint

Wave-2 Critic flagged a runtime crash in `WordBuilder`: u3.l4 sentence-assembly items had been authored with `variant: 'letter_spell'` but a `letterPool` of multi-character word tokens (e.g. `["a", "bird", "can", "fly", ...]`). The renderer computed `slots = item.targetWord.length` (14) against a 7-entry pool, producing out-of-bounds index reads.

We added:

1. A third variant `sentence_chunks` on `WordBuilderItemSchema`. Renderer slots = `targetWord.trim().split(/\s+/).length`; tokens are joined with single spaces and compared case-insensitively to `targetWord.trim()`.
2. A cross-field consistency check `checkWordBuilderConsistency(item)` shared by the Zod `UnitSchema.superRefine` and the `validate-content` CLI. It rejects:
   - `letter_spell` items whose `letterPool` contains any token with `length > 1` (and no space) — these must use `sentence_chunks`.
   - `sentence_chunks` items whose `letterPool` is missing one of the tokens required to spell `targetWord`.
3. The u3.l4.a3 9-12 band items (`i1b`, `i2b`, `i3b`, `i4b`) were migrated from `letter_spell` to `sentence_chunks`.

The CI rule guarantees that any future reintroduction of the same shape mismatch fails `pnpm validate:content` before it reaches a child.
