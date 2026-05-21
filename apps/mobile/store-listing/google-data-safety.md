# Google Play — Data Safety Form

Drop-in answers for the Play Console "Data safety" section. Mirror of `apps/mobile/store-listing/privacy-nutrition.md` mapped to Google Play's category taxonomy. Paste each row verbatim into the form.

## Top-level declarations

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (minimal — see per-category rows below) |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS / TLS 1.2+ everywhere) |
| Do you provide a way for users to request that their data be deleted? | **Yes** (in-app from Parent Dashboard with 7-day grace, plus an email-based deletion request at the privacy contact address) |
| Does your app comply with Google Play's Families Policy? | **Yes** |
| Is your app for children only, mixed audience, or adults only? | **Children only** (target audience: ages 6–12) |

## Per-category data collection

### Personal Info

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Name | **No** | — | — | — |
| Email address | **Yes (parent only)** | No | Optional | App functionality (cloud sync VPC, deletion confirmation) |
| User IDs | **Yes (anonymous Supabase session UUID)** | No | Required | App functionality (cloud sync attribution) |
| Address | **No** | — | — | — |
| Phone number | **No** | — | — | — |
| Race / ethnicity | **No** | — | — | — |
| Political or religious beliefs | **No** | — | — | — |
| Sexual orientation | **No** | — | — | — |
| Other info | **No** | — | — | — |

### Financial Info

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| User payment info | **No** | — | — | — |
| Purchase history | **No** | — | — | — |
| Credit score | **No** | — | — | — |
| Other financial info | **No** | — | — | — |

### Health and Fitness

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Health info | **No** | — | — | — |
| Fitness info | **No** | — | — | — |

### Messages

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Emails | **No** (we send transactional emails via Resend; we do not read user emails) | — | — | — |
| SMS or MMS | **No** | — | — | — |
| Other in-app messages | **No** | — | — | — |

### Photos and Videos

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Photos | **No** | — | — | — |
| Videos | **No** | — | — | — |

### Audio Files

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Voice or sound recordings | **No** (microphone activates for pronunciation scoring but audio is never written to disk and never transmitted) | — | — | — |
| Music files | **No** | — | — | — |
| Other audio files | **No** | — | — | — |

### Files and Docs

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Files and docs | **No** | — | — | — |

### Calendar

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Calendar events | **No** | — | — | — |

### Contacts

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Contacts | **No** | — | — | — |

### Location

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Approximate location | **No** | — | — | — |
| Precise location | **No** | — | — | — |

### Web Browsing

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Web browsing history | **No** | — | — | — |

### App Activity

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| App interactions | **Yes (parent dashboard routes only)** | No | Optional | Analytics (Plausible cookieless events, parent-only) |
| In-app search history | **No** | — | — | — |
| Installed apps | **No** | — | — | — |
| Other user-generated content | **No** | — | — | — |
| Other actions | **No** | — | — | — |

### App Info and Performance

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Crash logs | **Yes** | No | Optional (DSN-gated) | App functionality (debugging) |
| Diagnostics | **Yes** (Sentry, PII-scrubbed) | No | Optional (DSN-gated) | App functionality |
| Other app performance data | **No** | — | — | — |

### Device or Other IDs

| Sub-type | Collected? | Shared? | Required? | Purpose |
|---|---|---|---|---|
| Device or other IDs | **No** (no `ACCESS_AD_ID`, no `ANDROID_ID` read, no IDFA equivalent) | — | — | — |

## Security practices

| Claim | Answer |
|---|---|
| Data is encrypted in transit | **Yes** (HTTPS / TLS 1.2+) |
| Data is encrypted at rest | **Yes** (Supabase Postgres at-rest encryption; on-device IndexedDB sandboxed) |
| Users can request data deletion | **Yes** (self-serve from Parent Dashboard with 7-day grace, plus email at the privacy contact) |
| You commit to follow the Play Families Policy | **Yes** |
| Your app has been independently validated against a global security standard | **Not yet** (deferred to a post-launch audit; reassess in Sprint 7+) |

## Third-party SDKs

Identical to the App Store privacy nutrition declaration:

| SDK | Purpose | Where it runs |
|---|---|---|
| Supabase | Backend (auth + database) for opt-in cloud sync | Parent flows only |
| Resend | Transactional email for VPC and deletion confirmation | Server-side only |
| Sentry | Error logging (PII-scrubbed, DSN-gated) | Both flows; DSN-gated |
| Plausible | Cookieless analytics | Parent dashboard routes only; never on child routes |

No advertising SDKs. No A/B test SDKs. No retargeting SDKs. No social-login SDKs.

## Permissions justification

`RECORD_AUDIO` — used during pronunciation practice activities. Audio is processed by the on-device speech recogniser and never uploaded. Microphone state is parent-gated, has a persistent indicator, and auto-disables after 30 minutes.

`INTERNET` — required for the optional cloud sync (after parent VPC) and for fetching content updates over HTTPS.

No other dangerous permissions are declared.

## Privacy policy URL

`[PLACEHOLDER — e.g. https://english4kids.app/privacy]`

Current published version: v1.0 (effective 2026-05-20).
