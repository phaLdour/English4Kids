# Safety — COPPA & GDPR-K posture

One-page summary. Sources: COPPA 16 CFR §312, GDPR Articles 6, 7, 8 (and the EDPB Guidelines on age-of-consent variations across member states).

## Posture

We treat **every user as a child** until proven otherwise. We do not collect personally identifying information, we do not run third-party trackers in the player, and we keep voice processing on-device.

## Data inventory (MVP)

| Data | Stored where | PII? | Retained for |
|---|---|---|---|
| Progress (per-word Leitner box, last seen, stars) | IndexedDB (Dexie) | No — anonymous device key | Until parent resets / device cleared |
| Settings (toggles, strictness, age band) | IndexedDB (Dexie) | No | As above |
| Pronunciation transcripts (text only — never audio) | IndexedDB (Dexie) | Edge case — could leak identifiers if child says their name. Mitigation: capped to last 30 per word, never displayed in plain text in the dashboard | As above |
| Parent settings change events | IndexedDB (Dexie) | No | As above |
| Supabase row (Phase 2) | Postgres (region pinned) | No PII at MVP; only the anonymous device UUID | Per Phase 2 retention policy |

We do not collect: email, name, age beyond the age band, location, contacts, photos, audio, video, or device identifiers beyond a random UUID.

## Mic policy (summary; full text in `microphone-policy.md`)

- Mic is **off by default**.
- A **parent gate** (math challenge) is required before the first mic activation.
- Persistent **visual mic indicator** (red dot in the top bar) whenever the mic is hot.
- Push-to-talk by default for ages 6–8.
- **On-device only** — Web Speech (default, with Chrome-cloud disclosure) or whisper.cpp WASM (opt-in offline).
- No `MediaRecorder`, no Blob, no upload endpoint. CI enforces this.
- Parent kill-switch in Settings disables the mic globally.

## Parental verification

- **MVP:** anonymous + math gate for the Parent Panel. No email collection.
- **Phase 2:** email-plus-VPC ("email plus" — verifiable parental consent via a second confirmation email) before sync to Supabase activates.

This keeps us out of the "actual knowledge of a child under 13" trap at MVP, since we collect nothing.

## Asset licensing (summary; tracked in `PROVENANCE.md`)

Allowed: CC0, CC-BY, MIT, Apache-2.0, BSD-2/3, OFL.
Forbidden: CC-NC, CC-ND, "royalty-free" without an explicit license, AI-generated images without model + prompt + date.

CI's `provenance-check` job fails any PR that adds an asset without a row in `PROVENANCE.md`.

## Third-party scripts in the player

**Zero.** No analytics, no ads, no telemetry, no error trackers in `apps/web/src/app/(player)/**`. CI's `safety-lint` job greps for the common offenders and fails on match.

The marketing surface (`apps/web/src/app/(marketing)/**`) may carry a privacy-respecting analytics (Plausible, self-hosted) — that decision is deferred and would have its own ADR.

## EU specifics

- Region-pinned Supabase deployment for EU users (Frankfurt) when sync activates.
- Cookie banner is **not required** at MVP because we do not set any non-essential cookies.
- Right to erasure: parent can reset progress in-app; once Supabase sync exists, the reset also clears the server-side row.

## Audit & incident response

- Quarterly review of this document and `PROVENANCE.md` by the Safety Officer.
- Any new third-party library that ships network calls requires a Safety Officer sign-off in the PR.
- Suspected breach: immediately disable Supabase RLS-write keys, push a hotfix, notify parents via in-app banner.
