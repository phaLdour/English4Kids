# Soft launch checklist

Sprint 5 S5-10 deliverable. This is the gate between "code complete" and "first families try the app." Work top to bottom; an unchecked item means you cannot announce.

Cross-references:
- `docs/devops/secrets-management.md` — every secret named below has a setup recipe there.
- `docs/devops/mobile-capacitor.md` — iOS and Android build details.
- `docs/safety/privacy-policy-v1.md` — privacy posture and three pending placeholders.
- `docs/launch/post-launch-monitoring.md` — what to watch in the first 7 days.

## Pre-launch infrastructure

- [ ] Vercel project created. Production branch points at `main`. Preview branch builds enabled.
- [ ] Vercel env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. See `docs/devops/secrets-management.md` for the canonical list.
- [ ] Supabase project linked. Region: EU (Frankfurt) for EU-resident traffic.
- [ ] Supabase migrations applied through `0005`. Verify in dashboard: `supabase migration list`.
- [ ] Supabase Auth: email provider enabled, Resend SMTP configured (so Supabase's final verification email goes through your own domain rather than the Supabase default).
- [ ] Supabase secrets set for edge functions: `RESEND_API_KEY`, `VPC_SECRET`, `APP_URL`.
- [ ] Resend account active. Sending domain verified with DKIM + SPF + DMARC. Test deliverability from Resend dashboard.
- [ ] Plausible account active. Production domain registered (e.g. `english4kids.app`). Custom events tab shows the seven `parent_*` events even before traffic arrives.
- [ ] Sentry organisation + project created. DSN copied into Vercel env. Auth token + slug set so the Sentry build step uploads source maps.
- [ ] GitHub Actions secrets configured: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_KEY_ISSUER_ID`, `APPLE_API_KEY_BASE64`, `SENTRY_AUTH_TOKEN`, `SUPABASE_ACCESS_TOKEN`.
- [ ] Domain DNS pointed at Vercel (A/AAAA or CNAME per Vercel instructions).
- [ ] SSL cert active (Vercel auto-provisions; just confirm `https://english4kids.app` resolves with a green padlock).
- [ ] Edge function smoke-test: hit `/api/parent/vpc/request` from a fresh browser; expect a 200 and a Resend dashboard entry.

## Content and assets

- [ ] All 3 units pass `pnpm validate:content`. No banned-phrasing warnings, no orphan keys.
- [ ] All audio assets verified by `pnpm verify:audio`. The script checks duration, peak loudness, and sample-rate.
- [ ] All 215 illustrations land at correct paths under `apps/web/public/img/*`. Spot-check by loading `/play`, `/play/01-greetings`, and a sample lesson on a slow connection.
- [ ] Phoneme JSON built for all 3 units. Files in `apps/web/public/phonemes/*.json`.
- [ ] Lottie mascot animations: all 14 files present at `apps/web/public/lottie/{milo,luna}-{reaction}.json`. Each file 200 OK and renders without console warnings.
- [ ] App icons rendered: run `pnpm --filter @e4k/web exec node scripts/generate-icons.mjs` after `pnpm install sharp`. Verify 192, 512, maskable variants under `apps/web/public/icons/`.
- [ ] Splash screens rendered for iOS and Android. Capacitor config picks them up automatically.
- [ ] Feature graphic: 1024x500 PNG saved to `apps/marketing/feature-graphic.png` for Play Console.
- [ ] Robots.txt allows `/`, `/marketing`, `/faq`, `/privacy`; blocks `/parent` and `/api`.

## Mobile native

- [ ] iOS Apple Developer account active. Team ID in `apps/mobile/ios/App/App.xcodeproj/project.pbxproj`.
- [ ] Android Play Console account active. Signing keystore generated via `keytool` and base64-encoded. `signing.properties` filled in (gitignored).
- [ ] First iOS TestFlight build uploaded via the GitHub Actions `ios-release` workflow. Apple processing complete (10-30 minutes).
- [ ] First Android Internal track AAB uploaded via the `android-release` workflow.
- [ ] 8 screenshots per platform captured (lessons, parent dashboard, settings, mascots, garden). 32 total minimum; double to 64 for EN + TR locales.
- [ ] App Store Connect "App Privacy" answers reflect the privacy policy v1.0.
- [ ] Play Console "Data safety" form mirrors the same disclosures.
- [ ] Both stores list the support URL (`https://english4kids.app/faq`) and privacy URL (`https://english4kids.app/privacy`).

## Privacy and legal

- [ ] Privacy policy v1.0 published. Three placeholders filled: `[LEGAL ENTITY NAME]`, `[EU REPRESENTATIVE NAME]`, `[SUPPORT EMAIL]`.
- [ ] Privacy policy linked from app footer, marketing footer, FAQ footer, parent dashboard, and the Resend email templates.
- [ ] COPPA self-certification text pasted into App Store Connect and Play Console.
- [ ] Privacy nutrition label complete on App Store.
- [ ] Data safety form complete on Play Console.
- [ ] Terms of service drafted. Sprint 6 deliverable — if not done, leave the footer link as a placeholder per ADR-0015.
- [ ] Support email alias live: `support@english4kids.app`. Forwarding rule or shared inbox.
- [ ] DSAR (data-subject access request) workflow documented internally; test once with a fake request to make sure responses go out within 30 days.

## QA

- [ ] Final QA pass (sister deliverable S5-11) complete. All P0 / P1 bugs closed.
- [ ] axe-core a11y CI green on every page (`pnpm test:a11y`).
- [ ] Lighthouse mobile perf >=85 on `/play`, `/play/[unit]/lesson/[lesson]`, `/marketing`, `/faq`.
- [ ] Safety lint clean: no `MediaRecorder`, no third-party trackers on child pages (`pnpm lint:safety`).
- [ ] Banned-phrasing lint clean (`pnpm lint:content`).
- [ ] Mascot parity 100%: both Milo and Luna ship all 7 reactions (`pnpm test:mascot-parity`).
- [ ] Locale coverage symmetry verified (`pnpm test:locale-symmetry`). Every EN key has a TR sibling and vice versa.
- [ ] Privacy E2E green (`pnpm test:e2e -- plausible-child-isolation`).
- [ ] VPC double-confirmation E2E green (`pnpm test:e2e -- vpc-double-confirmation`).

## Communication

- [ ] Parent landing page live at `/marketing`.
- [ ] FAQ live at `/faq`.
- [ ] Privacy policy linked from every page (already enforced by `app/layout.tsx` footer).
- [ ] Support email autoresponder configured. Resend transactional template or a manual auto-reply rule. Body: "Thanks for writing. A human will reply within two working days."
- [ ] Soft launch announcement drafted. Audience: friends, family, and the initial 10-50 testers. Include the privacy summary, the support email, and a feedback link.
- [ ] Feedback collection live: Plausible custom event `feedback_clicked` + a mailto form on the FAQ page (manually wired by the user; the form is intentionally simple).

## Monitoring

- [ ] Sentry receives a test error from production (trigger via `?sentry-test=1` querystring after deploy, then delete the route once verified).
- [ ] Plausible receives a test parent event from production. Use `parent_export` (download the JSON file once with a fresh test account).
- [ ] Resend test email delivers to a real inbox (not spam). Send from a clean account; confirm DKIM signature and sender display name.
- [ ] Supabase RLS verified with two test JWTs: one anonymous-first (writes must fail), one upgraded (writes must succeed). Use `pnpm test:rls` once you have the test helper script.
- [ ] Sentry alert rules configured: email on >5 errors/minute, or any new issue tagged with `level:fatal`.
- [ ] Plausible weekly digest enabled.

## Soft launch day

- [ ] Announcement sent.
- [ ] Audience invited: 10-50 families. Keep it intentionally small so the first 48 hours of support email volume stays manageable.
- [ ] On-call rota: one person responds to support emails within 24 hours for the first week.
- [ ] Rollback plan documented: revert the Vercel deploy via `vercel rollback`; suspend new TestFlight invites if a critical iOS bug surfaces; toggle `NEXT_PUBLIC_SENTRY_DSN` off to silence Sentry if the SDK itself is the problem.
- [ ] Post-launch monitoring doc open in a tab; check it at the end of day 1, day 3, and day 7.

---

## Total: 64 checkboxes

When everything above is checked, you are clear to send the announcement. If even one item is unchecked, write a note explaining why before you ship.
