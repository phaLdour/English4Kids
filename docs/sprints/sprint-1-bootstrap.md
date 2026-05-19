# Sprint 1 — Bootstrap

**Goal:** Stand up the monorepo skeleton, document the decisions, wire the CI gates, and get an empty-but-runnable Next.js shell with the design tokens applied and Howler unlocked on first user gesture.

## Scope

### Repo & tooling

- [x] Monorepo skeleton (`apps/web`, `packages/audio`, `packages/game-engine`, `packages/content-schema`, `packages/data-access`, `packages/ui`).
- [x] pnpm workspaces + Turbo + Biome + TS strict + Vitest + Playwright.
- [x] `.editorconfig`, `.nvmrc`, `.gitignore`, root `tsconfig.base.json`, `biome.json`.
- [x] Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `validate:content`, `format`.

### Next.js scaffold (`apps/web`)

- [ ] App Router base layout.
- [ ] `/play` route group (player surface — designed for future static export).
- [ ] `/parents` route group (server-rendered).
- [ ] `globals.css` wiring the design tokens (`docs/design/design-tokens.md`).
- [ ] `next-intl` baseline (English only at MVP).
- [ ] Serwist baseline (PWA scaffolding; no precache yet).
- [ ] Vitest + Playwright config in place.

### Audio engine prototype (`packages/audio`)

- [ ] `SpeechEngine` interface in `src/speech/types.ts`.
- [ ] Howler-based `AudioPlayer` skeleton.
- [ ] **AudioUnlock prototype**: a first-user-gesture hook that unlocks the AudioContext on tap, with a tiny silent buffer warm-up. Verified on iOS Safari, Chrome Android, Firefox.

### Supabase

- [ ] `supabase/migrations/0001_init.sql` with the Leitner-shaped tables and RLS policies.
- [ ] No production sync wiring yet — see ADR 0003.

### Mascot

- [ ] Milo placeholder Lottie at `apps/web/public/lottie/milo-idle.placeholder.json` (already created by Animation Engineer agent; row in `PROVENANCE.md` confirmed).

### Documentation (this sprint's primary deliverable)

- [x] ADR 0001 — Stack
- [x] ADR 0002 — On-device speech
- [x] ADR 0003 — Supabase
- [x] ADR 0004 — Leitner
- [x] ADR 0005 — Content as JSON
- [x] ADR 0006 — Aggressive bundle cuts
- [x] `docs/audio/audio-map.md` (skeleton + Unit 1 / Lesson 1 / Activity 1 stub)
- [x] `docs/audio/voice-strategy.md`
- [x] `docs/audio/music-strategy.md`
- [x] `docs/audio/sfx-palette.md`
- [x] `docs/audio/pronunciation-scoring.md`
- [x] `docs/audio/audio-settings.md`
- [x] `docs/pedagogy/README.md`
- [x] `docs/safety/coppa-gdpr-k.md`
- [x] `docs/safety/microphone-policy.md`
- [x] `docs/design/design-tokens.md`
- [x] `docs/dialog-log/0001-bootstrap.md`
- [x] `docs/dialog-log/0002-critic-wave-1-findings.md`

### CI

- [x] `.github/workflows/ci.yml` with lint, typecheck, test, validate-content, provenance-check, safety-lint jobs.
- [x] `.github/scripts/check-provenance.sh` (executable).
- [x] `.github/scripts/safety-lint.sh` (executable).
- [x] `.github/PULL_REQUEST_TEMPLATE.md` with Child UX, Safety, and Provenance checklists.
- [x] `.github/CODEOWNERS` placeholder.

## Acceptance criteria

A pull request that:

1. `pnpm install` succeeds with a frozen lockfile.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm validate:content` all pass.
3. `pnpm --filter @e4k/web dev` boots a page that renders Milo (placeholder), plays a single SFX on first tap (proving AudioUnlock works), and applies the design tokens.
4. All six ADRs and all the docs listed above exist and are non-empty.
5. CI is green on a draft PR against the bootstrap branch.
6. `PROVENANCE.md` lists Milo's placeholder Lottie and the four font families.

## Out of scope (deferred to Sprint 2 / 3)

- Real Unit 1 content JSON.
- Listen & Tap / Word Builder activity components.
- Settings Panel.
- Parent Dashboard.
- Speak It! activity (mic).
- Songs.
- Word Garden visualisation.
- Streak feature.
- whisper.cpp WASM integration.
- Build-time Piper narration pipeline.

## Risks

- **AudioUnlock cross-browser quirks** (especially iOS Safari) — budget time to test on real devices.
- **Tailwind v4 + Next.js 15** is recent; if it bites, fall back to Tailwind v3.4 and revisit.
- **Biome vs ESLint+Prettier** divergence on edge formatting — pin Biome and document any disabled rules.
