# Apple App Store — Privacy Nutrition Label

Drop-in answers for the App Store Connect "App Privacy" section. Paste each category verbatim into the form. Every answer here mirrors `docs/legal/privacy-policy-v1.md` and `apps/mobile/store-listing/coppa-checklist.md`; never edit one without updating the other two.

## 1. Data Used to Track You

**NONE.**

We do not use any data to track users across other companies' apps or websites. We do not link our data to third-party data for advertising or measurement. We do not share device identifiers with data brokers.

## 2. Data Linked to You

**NONE.**

The MVP collects no data linked to the child. The Parent Dashboard collects only the parent's email address after a two-step verifiable parental consent (VPC) flow, and that email is used exclusively for transactional purposes (cloud-sync verification, deletion confirmation). The parent's email is declared in the next section as **not linked to the child user**.

## 3. Data Not Linked to You

We collect the following categories of data, all unlinked from any user identity and stored against a random UUID device key with no PII linkage:

### 3a. Identifiers — User ID

- **Collected:** anonymous Supabase session token (random UUID, no relation to device identifiers, no relation to advertising identifiers).
- **Purpose:** App Functionality only.
- **Linked to user?** No.
- **Used for tracking?** No.

### 3b. Usage Data — Product Interaction

- **Collected:** Plausible Analytics page-view and custom-event counts (`parent_vpc_request`, `parent_export`, `parent_delete_request`, etc.).
- **Where collected:** Parent Dashboard routes only (`/parent/*`). Never collected from any child-facing route.
- **Purpose:** Analytics.
- **Linked to user?** No. Plausible is cookieless; no device or user identifiers cross the wire.
- **Used for tracking?** No. Plausible does not set persistent identifiers and does not link visitors across sites.

### 3c. Diagnostics — Crash Data, Performance Data, Other Diagnostic Data

- **Collected:** Sentry error reports with PII scrubbed at SDK level (no breadcrumbs containing user input, no request bodies, no localStorage snapshots).
- **Purpose:** App Functionality (debugging crashes).
- **Linked to user?** No.
- **Used for tracking?** No.
- **Opt-out:** Sentry is DSN-gated; if `NEXT_PUBLIC_SENTRY_DSN` is unset, the SDK does not load and no diagnostics ship. Operators can disable diagnostics entirely by leaving the DSN unset.

## 4. Microphone

- **Used for:** App Functionality only (pronunciation scoring on-device).
- **Audio transmission:** Audio is **NEVER** transmitted off the device. Speech-to-text runs through the OS-level on-device recogniser (`SFSpeechRecognizer` with `requiresOnDeviceRecognition = true` on iOS; `SpeechRecognizer` running locally on Android 12+).
- **Audio storage:** Audio frames are **NEVER** written to disk. The recogniser returns a transcript in-memory; the app compares the transcript to the target word and produces a numeric 0–100 pronunciation score. Only the numeric score may cross the network (and only after VPC completes for cloud sync).
- **Permission gate:** The microphone is enabled only after a parent completes the math gate and toggles "Enable microphone" in the Parent Dashboard. There is a persistent red indicator while the microphone is hot, and the microphone auto-disables after 30 minutes of inactivity. A global kill switch is available from the dashboard at all times.

## 5. Third-party SDKs declared

All third-party SDKs and the categories they touch:

| SDK | Purpose | Data category | Where it runs | User-facing impact |
|---|---|---|---|---|
| Supabase | Backend (auth + database) for cloud sync | User ID (anonymous), parent email (post-VPC), progress timestamps | Parent flows only; child flows are local-first | Optional; off by default |
| Resend | Transactional email for VPC and verification | Parent email address (post-VPC) | Server-side only; never invoked from the client | Optional; only fires when parent requests sync |
| Sentry | Error logging | Diagnostics (PII-scrubbed) | Both flows; DSN-gated | Optional via DSN unset |
| Plausible | Analytics | Usage Data (page views + tagged events) | Parent dashboard routes only | Optional via `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` unset |

No advertising SDKs. No A/B test SDKs. No retargeting SDKs. No social-login SDKs. No payment SDKs.

## 6. Data Retention

- **Anonymous progress:** retained on-device until the user clears storage; if cloud sync is enabled, retained in Supabase until a 7-day grace deletion completes or 18 months of inactivity elapse.
- **Parent email:** retained until the parent deletes the account or 18 months after the last sign-in.
- **Sentry errors:** retained 90 days (Sentry's default retention).
- **Plausible analytics:** aggregated; no per-user data to retain.
- **IP addresses:** logged only at the edge (Supabase / Vercel) for abuse prevention, retained 30 days, never joined to user identity.
- **VPC tokens:** retained 7 days then auto-purged.

## 7. Sharing

We do not sell user data. We do not share user data with data brokers. We do not share user data for advertising or measurement. The four SDKs above are data processors acting on our behalf and are governed by data-processing agreements that prohibit secondary use.

## 8. Children

This app is directed to children under 13. We are fully compliant with COPPA, GDPR Article 8 (GDPR-K), and the UK Age-Appropriate Design Code. We do not require verifiable parental consent for the MVP because we collect no personal information from children. Cloud-sync activation requires a two-step VPC flow with a 24-hour server-enforced delay before the second confirmation.

## 9. Privacy Policy URL

`[PLACEHOLDER — e.g. https://english4kids.app/privacy]`

Current published version: v1.0 (effective 2026-05-20).

## 10. Privacy contact

`[PLACEHOLDER — privacy contact email, e.g. privacy@english4kids.app]`

Data controller and EU representative are documented in the privacy policy itself; the App Store review notes also point to the data controller block in `apps/mobile/store-listing/coppa-checklist.md`.
