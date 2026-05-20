# COPPA self-certification checklist

Drop-in text for the user to paste into App Store Connect's "Kids Category" review notes and Google Play's "Designed for Families" certification questionnaire. Every item is true of the current build of English4Kids; if any answer changes in a future release, the user re-reviews this file before uploading.

## 1. Personal information collection

> Does the app collect, use, or disclose personal information from children under 13?

**No.**

Justification: English4Kids stores progress (Leitner box state, activity completion, last-played dates) in Dexie, the in-browser IndexedDB wrapper. Dexie data lives in the WebView's sandbox on the device. No data leaves the device unless the parent explicitly enables Supabase cloud sync from the Parent Dashboard, and even then only progress timestamps are uploaded — never names, emails, voice recordings, or photos.

## 2. Identifiers

> Does the app collect persistent identifiers (advertising ID, device ID, IP-linked tokens)?

**No.**

- iOS: We do not read `identifierForVendor` or `IDFA`. No `NSUserTrackingUsageDescription` in Info.plist.
- Android: We do not request `ACCESS_AD_ID` (Play Store auto-checks this for Designed-for-Families).
- No third-party analytics, crash reporting, or A/B test SDKs.

## 3. Voice / audio

> Does the app record, transmit, or store voice from a child?

Audio is **briefly captured** during pronunciation practice. It is processed on-device by the OS-level speech recogniser (Apple `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true`, or Android `SpeechRecognizer` running locally on Android 12+). The recognised transcript is compared in-memory against the target word; nothing is stored or transmitted.

We never write audio frames to disk. We never upload audio. We never share audio with any third party.

## 4. Location

> Does the app collect location?

**No.** No `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` permission. No `NSLocationWhenInUseUsageDescription` in Info.plist.

## 5. Contacts / photos / camera

> Does the app access contacts, photos, or the camera?

**No.** None of these permissions are declared.

## 6. In-app purchases

> Does the app contain in-app purchases?

**Not in v0.1.** If a future release introduces an IAP, the parent verification gate (ParentGate dialog) is mandatory before checkout. We will never expose a buy button to a child view.

## 7. Ads

> Does the app contain advertising?

**No.** No ad SDKs, no remarketing, no behavioural advertising. The CSP in `apps/web/next.config.ts` blocks third-party scripts.

## 8. Verifiable Parental Consent (VPC)

> Does the app rely on VPC?

**Not required.** Since we collect zero personal information, COPPA's VPC requirement does not trigger (16 CFR 312.5(c)(1)).

If the user enables optional cloud sync from the Parent Dashboard, a parent must explicitly authenticate via Supabase magic link from their own email — which itself acts as a parental verification gate.

## 9. Disclosure

> Where is the privacy policy?

The privacy policy ships inside the app at `/privacy` (rendered from the static export) and is mirrored at `https://english4kids.app/privacy`. A child-readable summary lives at `/privacy/parent-summary`.

## 10. Operator notice

> Who is the data controller?

`hello@english4kids.app`. The user replaces this with their legal business name + address before the first store upload.

## 11. Sharing with third parties

> Are there third-party services that receive data?

**No third-party services receive child data.** Optional cloud sync uses Supabase (a US-and-EU-region database provider) at the parent's explicit opt-in; only opaque progress timestamps are uploaded.

## 12. Safe-Harbor program enrolment

> Are you enrolled in a COPPA Safe Harbor program (kidSAFE, PRIVO, etc.)?

**Not yet.** Deferred to Sprint 7+ once the app is public and we have a user base. kidSAFE Seal Program is the likely choice (most affordable, recognised by Apple + Google reviewers).

---

**The user signs and dates this checklist locally before uploading any build to either store, and re-signs whenever the build's behaviour changes.**

---

## Sprint 5 S5-6 — Drop-in statements for the store privacy questionnaires

Paste these exact statements into the App Store Connect "Kids" review notes and the Google Play "Designed for Families" form. They reflect the Phase 2 posture (cloud sync via email-plus VPC, transactional email, on-device microphone).

1. **This app is directed to children under 13.** Target audience: ages 6–12.
2. **We do not collect personal information from children without verifiable parental consent.** The MVP is fully anonymous-first; cloud sync activates only after a parent completes the email-plus VPC flow (two confirmations, 24h apart, second confirmation server-gated).
3. **We provide a parent gate (math problem) before any data collection feature is enabled.** The math gate is the entry to the Parent Dashboard and is the precondition for enabling the microphone, scheduling deletion, or initiating an email-plus VPC upgrade.
4. **Microphone audio never leaves the device.** Speech-to-text runs on-device via the Web Speech API or an offline whisper.cpp WASM model. Only a numeric pronunciation score (0–100) can ever cross the network, and only after VPC completes.
5. **We comply with COPPA, GDPR Article 8, and the UK ICO Age-Appropriate Design Code.** Documentation: `docs/safety/coppa-gdpr-k.md`, `docs/safety/microphone-policy.md`, and the public privacy policy at `/privacy` (versioned, v1.0 effective 2026-05-20).
6. **Data deletion is self-serve via the parent dashboard with a 7-day grace period.** A scheduled deletion can be cancelled before the grace window expires; after 7 days the deletion is permanent and irreversible.

### Supplementary facts for the store privacy questionnaires

- **Data collected (anonymous, on-device):** progress, settings, audit events, numeric pronunciation scores.
- **Data collected (cloud, post-VPC only):** parent email (transactional), parent password hash (Argon2id, managed by Supabase Auth), age band, progress mirror, audit events.
- **Data NOT collected, ever:** real names, phone numbers, exact birth dates, precise location, contact lists, photos, video, audio recordings, persistent advertising identifiers.
- **Third-party processors:**
  - Supabase (EU region) — cloud sync after VPC.
  - Resend — transactional email for VPC and Supabase verification.
  - Sentry — error logs only, DSN-gated, PII scrubbed at SDK level.
  - Plausible (EU-hosted) — cookieless analytics, **parent dashboard only**.
- **Tracking across apps or sites:** No.
- **Advertising identifiers:** No.
- **Data used to track the user:** No.
- **Data linked to user identity:** Only the parent email (post-VPC). Child-side data uses a random UUID device key with no PII linkage.

### Privacy policy URL

`https://english4-kids.vercel.app/privacy` (production). Current version: v1.0 (effective 2026-05-20). Change-log included on the policy page.

### Contacts to fill in before submission

- Privacy contact: **[SUPPORT EMAIL — to be filled in]**
- Data controller: **[LEGAL ENTITY NAME — to be filled in]**
- EU representative (GDPR Art. 27): **[EU REPRESENTATIVE — to be filled in]**
