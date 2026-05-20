# Vercel project setup runbook — Sprint 5

Step-by-step for hosting `apps/web` on Vercel. Follow once per fresh
deployment; afterwards env-var changes go through the Vercel UI or
`vercel env add` and don't need this doc.

## Prerequisites

- A Vercel account (Hobby tier is sufficient for staging; bump to Pro
  before public launch for unlimited concurrent builds and SSO).
- Repo `english4kids` accessible from the Vercel GitHub App. Either
  install the app organisation-wide or grant it per-repo.
- The secrets listed in `docs/devops/secrets-management.md`
  (Vercel column) at hand.

## 1. Create the project

1. From the Vercel dashboard, **New Project → Import Git Repository**.
2. Pick the `english4kids` repo. Vercel auto-detects Next.js — accept
   the default framework preset.
3. Project name: `english4kids` (or whatever subdomain you want under
   `*.vercel.app`).
4. **Root directory:** `apps/web`. This monorepo runs Next.js only from
   that subdirectory; pointing the project at the repo root will cause
   Vercel to try and build the workspace root, which has no Next
   config.
5. **Build & dev settings:** leave on defaults. The framework preset
   already runs `pnpm install --frozen-lockfile` and `pnpm build` from
   the project root with the correct working directory.
6. **Install command:** `pnpm install --frozen-lockfile`.
7. **Build command:** `pnpm --filter @e4k/web build`.
8. **Output directory:** `.next` (default — leave blank).

## 2. Configure environment variables

In **Settings → Environment Variables**, add the entries from
`docs/devops/secrets-management.md` (frontend table). The minimum to go
live:

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | |
| `NEXT_PUBLIC_E4K_ENV` | `production` | `preview` | |
| `NEXT_PUBLIC_SENTRY_DSN` | yes | optional | Leave blank in preview to suppress noisy errors. |
| `SENTRY_ORG` | yes | no | Build-time only. |
| `SENTRY_PROJECT` | yes | no | Build-time only. |
| `SENTRY_AUTH_TOKEN` | yes | no | Encrypted; only the Vercel build runner can read it. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | yes (once Plausible exists) | no | |

CLI alternative:

```bash
vercel link                                # one-time, links local repo
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add SENTRY_AUTH_TOKEN production
vercel env add NEXT_PUBLIC_E4K_ENV production       # value: production
vercel env add NEXT_PUBLIC_PLAUSIBLE_DOMAIN production
```

## 3. Git integration

- **Production branch:** `main`. Pushes to `main` deploy to the
  production domain.
- **Preview deployments:** enabled for `claude/**` branches. Settings →
  Git → **Ignored Build Step** stays empty so every push to a
  `claude/*` branch builds a preview URL the user can hit from the
  PR.
- **Deploy hook:** Settings → Git → Deploy Hooks → **Create Hook**.
  Name: `manual-production`, branch: `main`. Copy the URL into the
  team password manager and record its existence (not the URL itself)
  in `docs/devops/secrets-management.md`.

## 4. Domain + DNS

1. **Settings → Domains → Add Domain.** Enter the production domain
   (e.g. `english4kids.app`).
2. Vercel shows the required DNS records. Two common setups:
   - **Apex domain:** add an `A` record to `76.76.21.21` and an
     `AAAA` if your DNS provider supports it.
   - **`www` subdomain:** add a `CNAME` to `cname.vercel-dns.com`.
3. If you control the domain at Cloudflare, set the proxy ("orange
   cloud") to **off** for the apex `A` and the `www` `CNAME`. Vercel
   handles TLS termination itself; double-proxying breaks the cert
   provisioning loop.
4. Wait for DNS propagation (a few minutes typically). Vercel issues a
   Let's Encrypt cert automatically once it can resolve the domain.

## 5. Post-launch verification

Run from a fresh terminal:

```bash
curl -sI https://english4kids.app | grep -E 'content-security-policy|permissions-policy'
```

Expected headers (from `apps/web/next.config.ts`):

- `Content-Security-Policy: default-src 'self'; ...`
- `Permissions-Policy: microphone=(self), camera=(), geolocation=()`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

If any are missing, the deploy used an older revision of `next.config.ts`
— trigger a fresh deploy.

## 6. Source-map upload (Sentry)

Source maps upload from CI (`.github/workflows/ci.yml` →
`sentry-sourcemaps` job) rather than from Vercel's build environment.
Vercel still emits the maps; CI uploads them post-build. See
`docs/adr/0014-sprint-5-secrets-and-sentry-sourcemaps.md` for why.

If you would rather upload from Vercel itself, set all three
`SENTRY_*` env vars in the Vercel project and `next.config.ts` will
wire up `withSentryConfig` automatically — but you lose the ability to
run preview builds without burning Sentry release slots.
