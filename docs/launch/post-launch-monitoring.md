# Post-launch monitoring

Sprint 5 S5-10 companion doc. After you flip the soft-launch switch (see `docs/launch/soft-launch-checklist.md`), watch these five signals during the first seven days. Set aside fifteen minutes at the end of day 1, day 3, and day 7 to scan them.

## Service-level objectives

| Signal | Target | Where to look |
| --- | --- | --- |
| Sentry error rate | < 0.5% of sessions emit a captured exception | Sentry project dashboard → Issues, group by `release` |
| Resend bounce rate | < 2% across all transactional sends | Resend dashboard → Domains → your sending domain → Reputation |
| Plausible parent events | At least one of every `parent_*` event fires within the first 72h | Plausible site → Custom events |
| Supabase auth.users growth | One new row per VPC-completing parent. Lag between `vpc_request` and `vpc_complete` is at least 24h | Supabase dashboard → Authentication → Users |
| Parent feedback emails | Aim for ≤ 24h reply latency | `support@english4kids.app` shared inbox |

A breach of any target is not automatically a launch failure — investigate before reacting.

## Day 1 walkthrough

1. **Sentry**: Open the Issues tab, filter by `is:unresolved`. Anything tagged `level:fatal` blocks the next promotion. Lower-severity issues get triaged into the Sprint 6 backlog.
2. **Plausible**: Confirm at least one `parent_vpc_request` fired. If zero, either nobody opened the parent dashboard yet (likely on day 1) or Plausible is misconfigured — recheck `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
3. **Resend**: Check the Delivered / Bounced / Complaint counters. Any complaint forwards to the abuse address and demands action within 24h.
4. **Supabase**: `select count(*) from auth.users` and `select count(*) from public.parent_profiles where vpc_complete_at is not null`. The ratio gives you the funnel.
5. **Inbox**: Skim support emails. Categorise into `bug`, `confusion`, `praise`, `feature-request`. Reply to bugs first.

## Day 3 walkthrough

Repeat day 1, plus:
- Look for retention: did anyone come back for a second session? Plausible's "Visitors" tab on `/play` answers this.
- Re-run the privacy E2E suite against production once: `pnpm test:e2e:prod -- plausible-child-isolation`. A fresh deploy could silently regress the carve-out.
- Sample one VPC funnel: pick a parent who completed VPC, then check Supabase for any sync rows. If sync didn't activate, the three-layer gate has a bug.

## Day 7 walkthrough

Repeat day 3, plus:
- Compile the week's findings into a short note for the team.
- Decide go / no-go on widening the audience. The next ring is 50-200 families.
- Roll over any unresolved Sentry issues into the Sprint 6 plan.
- Confirm the auto-purge job for anonymous progress (18 months) and audit events (90 days) is scheduled in Supabase — set it to run before you forget.

## Rollback triggers

If any of the following happens, pause the launch and roll back the affected component:

- Sentry error rate above 2% for more than one hour.
- A single Sentry issue affects more than 25% of sessions.
- Resend bounce rate above 10% (likely DNS / SPF / DKIM regression).
- Any privacy regression confirmed by `pnpm test:e2e:prod`.
- A user reports their child's audio reached our servers. Treat as a P0 incident: pull the iOS / Android builds, suspend new invites, and disclose within 72h per GDPR Art. 33.

## Quiet weeks

If nothing breaks, that is the goal. Do not interpret silence as a problem to solve. The next sprint planning meeting is the right venue for new features.
