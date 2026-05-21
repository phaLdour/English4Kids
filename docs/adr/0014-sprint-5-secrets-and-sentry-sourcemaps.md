# ADR 0014 — Sprint 5: production secrets management and Sentry source-map upload

- **Status:** Accepted
- **Date:** 2026-05-20
- **Sprint:** 5 (S5-8 + S5-9)
- **Deciders:** DevOps Agent, Backend Engineer, Safety Officer
- **Related:** ADR-0011 (Resend), ADR-0012 (Plausible), ADR-0013 (mobile-build)

## Context

Sprint 5 Wave A landed VPC + Resend + Plausible behind env-var gates.
The codebase already tolerates missing secrets gracefully (Plausible
returns `null` without `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, Sentry dynamic-
imports its SDK only when `NEXT_PUBLIC_SENTRY_DSN` is set,
`vpc-upgrade` falls back to dev-mode without `RESEND_API_KEY`). What
remained for Wave B was the launch-readiness wrapping: a documented
home for every secret, a leak detector, and a working Sentry source-
map pipeline so that production exceptions are debuggable.

## Decision

### 1. Where each secret lives

We keep a four-store model:

| Store | What | Set how |
|---|---|---|
| Vercel project env | Frontend build + runtime envs (`NEXT_PUBLIC_*`, `SENTRY_*`) | Vercel UI or `vercel env add` |
| Supabase Edge Function secrets | `RESEND_API_KEY`, `EMAIL_FROM`, `ALLOWED_ORIGIN` | `npx supabase secrets set` |
| GitHub Actions repo secrets | Mobile signing (`ANDROID_*`, `APPLE_*`), Sentry upload token | `gh secret set` |
| Local-only (1Password / Bitwarden) | Raw keystores, signing certs, Supabase access token | Hand-managed |

The single source of truth is `docs/devops/secrets-management.md`. Per-
store runbooks live alongside it (`vercel-setup.md`,
`supabase-secrets.md`). The Verification script
`scripts/verify-secrets-ready.ts` enumerates required envs at launch
time.

### 2. gitleaks as defense-in-depth

`.gitleaks.toml` declares project-specific rules for Resend, Sentry,
Supabase service-role JWTs, Stripe (future), AWS, and Apple App-
Specific Passwords, plus a high-entropy fallback for `.env*` files.
`.github/workflows/secrets-scan.yml` runs the official action on every
push and PR, with comments enabled so the contributor sees a redacted
finding without the secret being reposted.

The default gitleaks ruleset is extended (`useDefault = true`) rather
than replaced — that gives us coverage of common providers we don't
explicitly model without re-implementing them.

### 3. Sentry source-map upload pattern

`next.config.ts` now only wraps with `withSentryConfig` when ALL of
`SENTRY_ORG`, `SENTRY_PROJECT`, **and** `SENTRY_AUTH_TOKEN` are set.
The previous behaviour (org + project only) silently emitted maps but
didn't upload them, producing "release exists, no source maps"
warnings in the Sentry UI that confused on-call.

Source maps upload from CI (`.github/workflows/ci.yml` →
`sentry-sourcemaps` job), not from Vercel:

- Production builds only (`main` branch on push events).
- Build step exports `NEXT_PUBLIC_E4K_RELEASE=${{ github.sha }}` so
  the client + server bundles tag every event with the same release
  name CI registers in Sentry.
- `getsentry/action-release@v1` does `releases new` →
  `upload-sourcemaps` → `finalize` against `apps/web/.next` with
  `url_prefix: ~/_next`.
- Marked `continue-on-error: true` until `SENTRY_AUTH_TOKEN` is wired
  by the user; promoting to required is a one-line change.

For one-off uploads from an operator's laptop,
`apps/web/scripts/upload-sourcemaps.sh` performs the same three CLI
calls, reading credentials from either `.sentryclirc` (gitignored;
`.sentryclirc.template` shows the schema) or env vars.

### 4. Release naming convention

`release` in Sentry init is `process.env.NEXT_PUBLIC_E4K_RELEASE` (set
by CI to the full git SHA) and falls back to `"dev"` so local sessions
don't poison the production release's stack-trace symbolication.

Why full SHA, not short: Sentry's release matcher is exact-string. A
mix of short and long SHAs across client/server bundles would break
symbolication on the bundle that happened to tag short. The CLI
upload also uses the same SHA. Local devs running
`upload-sourcemaps.sh` get the short SHA by default (`git rev-parse
--short HEAD`); that's fine for ad-hoc debugging and never collides
with the CI release because the short form is a prefix-of, not equal-
to, the full SHA.

### 5. Rotation cadence

Defined in `docs/devops/secrets-management.md` §"Rotation policy":

- API keys (Resend, Sentry auth, etc.): 90 days.
- Apple signing cert: 1 year (Apple's expiry policy).
- Android keystore: never rotate (rotation forfeits Play upload
  identity); rotate only on confirmed compromise.
- App identifiers (Sentry org/project, Supabase ref): never.
- Public anon keys: only when re-creating the issuing project.

Owner-of-record per secret class is listed in the same table.

## Consequences

- **Vercel-deploy-ready:** The frontend works end-to-end the moment
  the user pastes the env vars into Vercel. Until then it builds
  locally without Sentry/Plausible (both feature-gated).
- **Sentry-uploadable:** Source-map upload is wired in CI and via a
  local script. The user wires the auth token via `gh secret set` and
  CI runs immediately.
- **Defense-in-depth:** gitleaks gates merges. A leaked secret in a PR
  is caught before code review.
- **Pre-flight check:** `pnpm tsx scripts/verify-secrets-ready.ts`
  exits non-zero in production mode if any required secret is
  missing.

## Open items (handed back to the user)

1. Create the Vercel project per `docs/devops/vercel-setup.md`.
2. Link Supabase per `docs/devops/supabase-secrets.md` and set the
   Edge Function secrets.
3. Generate `SENTRY_AUTH_TOKEN` in the Sentry org settings and
   `gh secret set` it into the repo. Then promote the
   `sentry-sourcemaps` job from `continue-on-error: true` to required.
4. (Future) Provision the Android keystore + Apple cert and wire the
   mobile build workflows.
