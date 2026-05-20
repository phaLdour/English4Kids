# Secrets management — Sprint 5 production readiness

Single source of truth for every secret English4Kids needs in production.
Each row lists: **where the secret lives**, **the command to set it**,
**who owns rotation**, and **rotation cadence**.

See also:
- `docs/devops/vercel-setup.md` — frontend host setup
- `docs/devops/supabase-secrets.md` — backend (Edge Functions, DB)
- `docs/adr/0014-sprint-5-secrets-and-sentry-sourcemaps.md` — design rationale

## Rotation policy (default)

| Class | Cadence | Notes |
|---|---|---|
| API keys (Resend, Sentry auth, Supabase service role) | 90 days | Automated reminder via owner's calendar. |
| Signing keys (Android keystore, Apple cert) | Never (Android), 1 year (Apple) | Apple certs expire by policy. Android loses Play upload identity on rotation — only rotate on confirmed compromise. |
| App identifiers (Sentry org/project, Supabase project ref, domains) | Never | Identifiers, not secrets. Documented for completeness. |
| Public anon keys (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | On RLS-policy change | Anon key is public-by-design; rotate only if the issuing project is recreated. |

## Frontend env — Vercel project

Set via the Vercel UI (Project Settings → Environment Variables) or
`vercel env add <NAME> production`. Production scope unless noted.

| Variable | Required | Scope | Owner | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Prod + Preview | Backend | `https://<ref>.supabase.co`. Identifier, not secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Prod + Preview | Backend | Public anon JWT. Rotate on project recreation only. |
| `NEXT_PUBLIC_SENTRY_DSN` | yes (prod) | Prod | DevOps | DSN is public; safe to ship to clients. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | no | Prod | DevOps | Set once a Plausible account exists; until then leave blank and the loader returns null. |
| `NEXT_PUBLIC_E4K_ENV` | yes | Per-env | DevOps | One of `development \| preview \| production`. |
| `NEXT_PUBLIC_E4K_RELEASE` | recommended | Prod | CI (GitHub Actions) | Set automatically by the build step to `${{ github.sha }}` — see `.github/workflows/ci.yml`. |
| `SENTRY_ORG` | yes (for SM upload) | Prod build only | DevOps | Sentry slug, e.g. `english4kids`. Build-time only; not shipped to client. |
| `SENTRY_PROJECT` | yes (for SM upload) | Prod build only | DevOps | Sentry project slug, e.g. `web`. |
| `SENTRY_AUTH_TOKEN` | yes (for SM upload) | Prod build only | DevOps | Org auth token with `project:releases` scope. **Rotate 90 days.** |

`next.config.ts` only enables Sentry webpack wrapping when `SENTRY_ORG`,
`SENTRY_PROJECT`, **and** `SENTRY_AUTH_TOKEN` are all set, so partial
configuration is a no-op rather than a build failure.

### Set commands

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add SENTRY_AUTH_TOKEN production
vercel env add NEXT_PUBLIC_E4K_ENV production   # value: production
```

### Deploy hook URL

After project creation, copy the deploy hook URL from
**Settings → Git → Deploy Hooks** and record it here. The URL is
authorisation-bearing (anyone with it can trigger a deploy), so treat it
as semi-secret: paste it into the team password manager rather than the
repo, even though it does not unlock any data.

Placeholder:
```
DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/<id>/<token>
```

## Backend — Supabase Edge Function secrets

Set via the Supabase CLI. See `docs/devops/supabase-secrets.md` for the
full runbook (login, link, deploy).

| Secret | Required | Owner | Rotation |
|---|---|---|---|
| `RESEND_API_KEY` | yes (prod) | Backend | 90 days |
| `EMAIL_FROM` | yes | Backend | Never (identifier) — change only when the verified domain changes. |
| `ALLOWED_ORIGIN` | yes | DevOps | Never (matches deployment domain) |
| `EMAIL_DEV_MODE` | no | Backend | Must be `false` or unset in prod. **Setting this to `true` in prod bypasses the COPPA 24h waiting window.** |

Set:

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM=noreply@english4kids.app \
  ALLOWED_ORIGIN=https://english4kids.app
```

## Mobile signing — local-only

These secrets **must never be added to a CI env or committed**. Store in
a 1Password / Bitwarden vault item titled "English4Kids — mobile signing".

| Secret | Where used | Owner |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | `mobile-android-build.yml` workflow secret | DevOps |
| `ANDROID_KEYSTORE_PASSWORD` | same | DevOps |
| `ANDROID_KEY_ALIAS` | same | DevOps |
| `ANDROID_KEY_PASSWORD` | same | DevOps |
| `APPLE_TEAM_ID` | `mobile-ios-build.yml` workflow secret | DevOps |
| `MATCH_PASSWORD` (if fastlane match) | mobile build env | DevOps |

The base64-encoded keystore lives **only** in GitHub Actions secrets and
a vault backup. The plaintext `.jks` is gitignored (`*.jks`, `*.keystore`,
`apps/mobile/android/app/keystore.jks`) and never leaves the engineer's
machine.

## GitHub Actions secrets

Set via the `gh` CLI from a checkout of the repo:

```bash
gh secret set ANDROID_KEYSTORE_BASE64 < keystore.b64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set ANDROID_KEY_PASSWORD

gh secret set APPLE_TEAM_ID
# If using fastlane match for iOS certs:
gh secret set MATCH_PASSWORD
gh secret set MATCH_GIT_BASIC_AUTHORIZATION

# Sentry source-map upload from CI (see .github/workflows/ci.yml — sentry-sourcemaps job)
gh secret set SENTRY_AUTH_TOKEN
gh secret set SENTRY_ORG
gh secret set SENTRY_PROJECT

# Supabase migrations push from CI (optional — Sprint 6)
gh secret set SUPABASE_ACCESS_TOKEN
gh secret set SUPABASE_DB_PASSWORD
```

`gh secret set` with no `<` reads the value from stdin interactively, so
the secret never lands in shell history.

### Required-by-workflow matrix

| Workflow | Required secrets |
|---|---|
| `mobile-android-build.yml` | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` |
| `mobile-ios-build.yml` | `APPLE_TEAM_ID`, signing cert + provisioning profile (base64) |
| `ci.yml` job `sentry-sourcemaps` | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |
| (future) Supabase deploy | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` |

## Verification

Run `pnpm tsx scripts/verify-secrets-ready.ts` locally before a launch.
The script reads `.env.example`, enumerates required variables, and
reports any that are unset. In `E4K_VERIFY_MODE=production` it exits
non-zero on the first missing required production secret.

Defense-in-depth: every push and PR runs `.github/workflows/secrets-scan.yml`
(gitleaks). See `.gitleaks.toml` for the rules and
`docs/adr/0014-sprint-5-secrets-and-sentry-sourcemaps.md` for the
rationale.
