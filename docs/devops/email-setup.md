# Email setup — Resend + VPC double opt-in

This document covers how the `vpc-upgrade` Edge Function sends (or
simulates sending) the COPPA email-plus confirmation messages, and the
DNS work needed to turn Resend on in production. See
[ADR-0007](../adr/0007-phase-2-cloud-sync-and-vpc.md) (Phase 2) and
[ADR-0011](../adr/0011-sprint-5-server-side-gate-and-resend.md)
(Sprint 5) for the policy context.

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
`/start` call. The rendered subject + recipient (but NOT body) is also
logged as `[VPC dev-mode email] to=... subject=...` so you can confirm
the template selection without bloating the dev log.

### Email previewer

`apps/web/src/app/dev/email-preview/page.tsx` renders the three
templates with sample data. Open
`http://localhost:3000/dev/email-preview?template=vpc-first-confirmation`
(also `vpc-second-confirmation-reminder` and `vpc-upgrade-complete`).
The route is gated behind `NEXT_PUBLIC_E4K_ENV !== 'production'` and
returns a 404 in prod builds.

## Production setup — what YOU do at the end of Sprint 5

The code is Resend-ready. The remaining steps are account-level work
that only a human with credit-card + DNS access can do:

### 1. Create a Resend account

1. Sign up at <https://resend.com/signup>. Use the privacy alias
   (e.g. `privacy@english4kids.app`) so the account isn't tied to a
   single engineer's mailbox.
2. In the Resend dashboard, go to **Domains -> Add Domain** and enter
   the sending domain (`english4kids.app` or whichever domain you'll
   send from). Resend will show you three DNS records to add.

### 2. Add the DNS records

At your registrar / DNS provider, add these records on the sending
domain. (Cloudflare, Route53, Namecheap, etc. all support these record
types.)

| Type    | Name                       | Value                                                                     |
| ------- | -------------------------- | ------------------------------------------------------------------------- |
| `TXT`   | `@` (apex)                 | `v=spf1 include:_spf.resend.com ~all`                                     |
| `CNAME` | `resend._domainkey`        | (the value Resend shows you — a domain like `domainkey.resend-mail.com.`) |
| `CNAME` | `<id>._domainkey`          | (a second DKIM CNAME, if Resend issues a rotating-key pair)               |
| `TXT`   | `_dmarc`                   | `v=DMARC1; p=quarantine; rua=mailto:dmarc@english4kids.app`               |

Notes:

- **SPF (`v=spf1 include:_spf.resend.com ~all`)** — if the apex already
  has an SPF record for another sender (e.g. Google Workspace), MERGE
  the includes into one record. Two `v=spf1` TXT records on the same
  name will silently fail validation.
- **DKIM CNAMEs** — Resend will show you the exact host + target. Copy
  them verbatim. Don't append your domain to the value field if your
  DNS UI adds it automatically.
- **DMARC** — start with `p=quarantine` for the first month. Once you
  see consistent passes in the DMARC reports (Postmark, Valimail, or
  the free `dmarc.postmarkapp.com`), tighten to `p=reject`.
- Resend's domain page shows green checkmarks when each record is
  verified. Wait for all three before sending production traffic; the
  function will fall back to "email-send-failed" 502s if the API call
  reports a verification error.

### 3. Set the Supabase Edge Function secrets

Either via the Supabase dashboard (**Project Settings -> Edge Functions
-> Secrets**) or via the CLI:

```bash
supabase secrets set RESEND_API_KEY=re_...your_key_here
supabase secrets set EMAIL_FROM=noreply@english4kids.app
supabase secrets set ALLOWED_ORIGIN=https://app.english4kids.app
# CRITICAL: leave EMAIL_DEV_MODE unset (or empty). The function defaults
# to prod behaviour when this var is missing.
supabase secrets unset EMAIL_DEV_MODE
```

The function logic is:

```text
if RESEND_API_KEY is set AND EMAIL_DEV_MODE !== 'true'
  -> POST to api.resend.com/emails
else
  -> log + return devToken (dev mode)
```

So accidentally setting `EMAIL_DEV_MODE=true` in production would
DISABLE real sending. The Sprint 5 contract is to leave it unset.

### 4. Verify delivery

1. From the Parent Dashboard `/parent/account`, submit a test email to
   a real inbox you control.
2. Confirm the email arrives within 30 seconds and passes DKIM + SPF +
   DMARC. Open the raw headers in Gmail (More -> Show original) and
   look at `Authentication-Results:` — every check must say `pass`.
3. Check that the email lands in **Inbox**, not Spam. If it lands in
   Spam, the most common cause is missing DMARC. Add the record above
   and wait 30 minutes for DNS propagation.
4. In the Resend dashboard, the message should appear under **Emails**
   with the recipient and a "Delivered" badge.

### 5. Rate-limit smoke test

Submit six `/start` calls in succession from the same anonymous
Supabase user. The sixth call MUST return 429 with a `retry-after`
header (cap is 5/hour per parent_id, enforced by the `vpc_rate_limit`
table added in migration `0005`).

```bash
for i in 1 2 3 4 5 6; do
  curl -X POST \
    -H "authorization: Bearer $JWT" \
    -H "content-type: application/json" \
    -d '{"email":"test+'$i'@example.com"}' \
    "$SUPABASE_URL/functions/v1/vpc-upgrade/start"
  echo
done
```

The first five should return `status: "awaiting-first-confirmation"`;
the sixth must return `{"error":"rate-limited","retryAfterSec":...}`
with status 429.

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
- [ADR-0011](../adr/0011-sprint-5-server-side-gate-and-resend.md) —
  Sprint 5 server-side gate and Resend integration.
- [16 CFR §312.5](https://www.ecfr.gov/current/title-16/part-312#p-312.5) —
  Parental consent under COPPA.
- `supabase/functions/vpc-upgrade/index.ts` — the implementation.
- `supabase/functions/_shared/email-templates.ts` — the templates.
- `apps/web/src/app/parent/account/page.tsx` — the parent-facing UI.
- `apps/web/src/app/dev/email-preview/page.tsx` — the dev-only template
  previewer.
- [Resend SPF/DKIM docs](https://resend.com/docs/dashboard/domains/introduction)
