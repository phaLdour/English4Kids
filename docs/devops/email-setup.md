# Email setup — VPC double opt-in

This document covers how the `vpc-upgrade` Edge Function sends (or
simulates sending) the COPPA email-plus confirmation messages. See
[ADR-0007](../adr/0007-phase-2-cloud-sync-and-vpc.md) for the policy
context.

## Dev mode

In local development the Edge Function has no SMTP provider wired up.
Two escape hatches let engineers walk the flow end-to-end without one:

1. **`devToken` in `/start` response.** When the function runs with
   `EMAIL_DEV_MODE=true` (the default for local Supabase), the JSON
   response includes a `devToken` field carrying the same token that
   would have been emailed. The Parent Dashboard's account upgrade page
   renders this token inline so engineers can paste it back into the
   first-confirm form.

2. **`?devSkipDelay=1` on `/confirm-second`.** The COPPA-mandated 24h
   wait between first and second confirmation is unworkable for E2E
   tests. When `EMAIL_DEV_MODE=true` AND the `devSkipDelay=1` query
   param is present, the function skips the window check. Both
   conditions are required — a misconfigured prod env (no
   `EMAIL_DEV_MODE`) cannot bypass the gate even if a caller appends the
   param. The Playwright spec at `tests/e2e/parent-vpc.spec.ts` uses
   this hatch via a route rewrite.

To inspect emails locally, run `supabase functions serve vpc-upgrade`
and tail the function logs. The confirmation link is printed as
`[VPC] confirmation link: <origin>/vpc-confirm/<token>` for each
`/start` call.

## Production setup

1. Sign up for [Resend](https://resend.com) (or another transactional
   provider). Register the sending domain and complete the DKIM, SPF,
   and DMARC DNS records the provider walks you through. DMARC must be
   set to at least `p=quarantine` once the domain is verified.

2. Set the following secrets in the Supabase project's Edge Function
   environment (Project Settings -> Edge Functions -> Secrets):

   | Variable          | Value                                   |
   | ----------------- | --------------------------------------- |
   | `RESEND_API_KEY`  | Project API key from Resend dashboard.  |
   | `EMAIL_FROM`      | A verified sender on the domain above.  |
   | `ALLOWED_ORIGIN`  | Production web origin, e.g. `https://app.example.com`. |

3. **Leave `EMAIL_DEV_MODE` UNSET.** The function defaults to prod
   behaviour when this variable is missing or any value other than the
   literal string `true`. Both dev-mode escape hatches above are gated
   on `EMAIL_DEV_MODE === 'true'` — leaving it unset shuts them both
   off.

4. Replace the `console.log` link emission in
   `supabase/functions/vpc-upgrade/index.ts` with a Resend
   `client.emails.send(...)` call. The plaintext + HTML templates live
   alongside the function once that work lands; until then production
   deploys are blocked.

## Verification before go-live

1. Send a test confirmation to a mailbox you control. The email must
   arrive in ≤ 30 seconds and pass DKIM + SPF + DMARC (check
   `Authentication-Results` in the raw headers).
2. Verify the bounce + complaint webhooks deliver — Resend signs these
   with HMAC, so reuse the existing CORS-aware function pattern.
3. Test rate-limit behaviour: ten rapid `/start` calls from the same
   parent should not all send emails. Resend caps at 100/hour by
   default per sender; the function relies on this as a coarse safety
   net.

## COPPA contract — DO NOT SHORTEN THE 24h GAP

The 24-hour window between the first and second confirmation is the
defining feature of the COPPA "email-plus" Verifiable Parental Consent
method (§312.5(b)(2)(ii)). It is the only thing distinguishing this
flow from a single-tap consent, which COPPA explicitly excludes. The
dev-mode `devSkipDelay` hatch exists ONLY for E2E tests; it MUST NOT be
plumbed through to any production code path. Reviewers must reject any
PR that:

- removes the `EMAIL_DEV_MODE === 'true'` half of the gate, or
- ships a hardcoded "skip in prod" flag, or
- shortens `SECOND_CONFIRM_WINDOW_MS` in `index.ts`.

Shortening the gap exposes the project to FTC enforcement and breaches
the consent claim we make on the parent dashboard.

## References

- [ADR-0007](../adr/0007-phase-2-cloud-sync-and-vpc.md) — Phase 2 cloud
  sync and VPC.
- [16 CFR §312.5](https://www.ecfr.gov/current/title-16/part-312#p-312.5) —
  Parental consent under COPPA.
- `supabase/functions/vpc-upgrade/index.ts` — the implementation.
- `apps/web/src/app/parent/account/page.tsx` — the parent-facing UI.
