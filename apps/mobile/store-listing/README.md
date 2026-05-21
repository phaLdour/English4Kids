# Store-listing inventory

This directory is the staging ground for everything Apple App Store Connect and Google Play Console will ask for at submission time. Sprint 5 (Mobile Agent) prepared the structure and Sprint 5 wave B (Marketing Agent) fills the locale-specific copy. The user pastes the final copy + asset URLs into the consoles once accounts are open.

The store reviews focus on three things for a kids app: (1) consistent privacy claims across the app, listing, and data-safety form; (2) a clear age band; (3) no third-party SDKs that would push us into the regular consumer category. Everything in this directory is built to keep those three answers identical across both stores.

## Files

| File | Purpose |
|---|---|
| `copy-en.md` | English copy block — Sprint 5 wave B final. Three URL placeholders + one contact-email placeholder remain. |
| `copy-tr.md` | Turkish copy block — Sprint 5 wave B final. Formal "siz" tone, brand untranslated, three URL placeholders. |
| `coppa-checklist.md` | Item-by-item self-certification text the user pastes into the Play Console + App Store Connect privacy forms. |
| `screenshots-guide.md` | 8-slot capture plan, device specs, capture mechanics, and annotation style. Sprint 6 execution. |
| `feature-graphic.svg` | 1024×500 Google Play feature graphic. Render to PNG with `rsvg-convert` or `inkscape` before upload. |
| `privacy-nutrition.md` | App Store Connect privacy nutrition label draft (drop-in answers per category). |
| `google-data-safety.md` | Google Play data safety form draft (drop-in answers per category). |
| `assets/` | Generated PNG assets (high-res icon, feature graphic, screenshot templates). Produced by `apps/mobile/scripts/generate-icons.mjs`. |

## Submission checklist (Marketing Agent — Sprint 5 wave B)

The user works through this list before pressing "Submit for Review" in either console. Order roughly matches the consoles' tab order.

- [ ] Replace the 3 URL placeholders in `copy-en.md` (Support, Marketing, Privacy) — same three appear in `copy-tr.md`.
- [ ] Have the Turkish copy in `copy-tr.md` reviewed by a native speaker, and update the contact email line if a localised support address is preferred.
- [ ] Capture the 8 screenshots per platform per device class — 4 device classes minimum (Apple iPhone 6.7", Apple iPad 13", Android phone, Android tablet 10") × 2 locales (EN + TR) = **at least 64 captures**. Add the Android 7" tablet set for full coverage (96 captures). See `screenshots-guide.md`.
- [ ] Render `feature-graphic.svg` to a 1024×500 PNG. Either tool works:
  ```bash
  rsvg-convert -w 1024 -h 500 feature-graphic.svg -o assets/play-feature-graphic.png
  # or
  inkscape feature-graphic.svg --export-type=png --export-filename=assets/play-feature-graphic.png -w 1024 -h 500
  ```
- [ ] Paste `privacy-nutrition.md` answers into App Store Connect → App Privacy. Verify the SDK table matches the build's actual dependencies before submitting.
- [ ] Paste `google-data-safety.md` answers into Play Console → App content → Data safety.
- [ ] Paste `coppa-checklist.md` compliance answers into both consoles' Designed for Families / Kids category review notes.
- [ ] Set age rating: **Apple 4+**, **Google Everyone (E)**.
- [ ] In Apple, opt into the Kids category and select both age bands (6–8 + 9–11). In Google, opt into Designed for Families and select age bands 6–8 + 9–11.
- [ ] Confirm the build's bundle ID + version code matches the App Store Connect / Play Console listing.

## Apple App Store Connect — fields to populate

For each locale (English baseline + Turkish translation):

| Field | Char limit | Source |
|---|---|---|
| App Name | 30 | `copy-{locale}.md → name` |
| Subtitle | 30 | `copy-{locale}.md → subtitle` |
| Promotional Text | 170 | `copy-{locale}.md → promotional_text` |
| Description | 4000 | `copy-{locale}.md → description` |
| Keywords | 100 | `copy-{locale}.md → keywords` |
| Support URL | – | `https://english4kids.app/support` |
| Marketing URL | – | `https://english4kids.app` |
| Privacy Policy URL | – | `https://english4kids.app/privacy` |

Plus:

- **Category:** Primary = Education, Secondary = Kids 6-8 + 9-11 (toggle both bands so the Kids tab listing covers the full target age).
- **Age Rating:** 4+ (no objectionable content, no unrestricted web access, no user-generated content visible to other users).
- **Screenshots:** 8 per device class, 6.7" iPhone (1290x2796) + 13" iPad (2064x2752). See `apps/mobile/store-listing/screenshots/` (auto-generated templates after Marketing Agent supplies final copy).
- **App Preview Video:** Optional. If we ship one, 15-30 seconds, captured from device-frame iOS Simulator footage.
- **Privacy Nutrition Label:**
  - **Data Not Collected** for: contact info, identifiers, location, browsing history, search history, identifiers (advertising), purchases.
  - **Data Linked to You** for: NONE.
  - **Data Used to Track You** for: NONE.
  - The mic input is processed on-device and never leaves — so it isn't "collected" in App Store taxonomy.

## Google Play Console — fields to populate

| Field | Char limit | Source |
|---|---|---|
| App name | 30 | `copy-{locale}.md → name` |
| Short description | 80 | `copy-{locale}.md → short_description` |
| Full description | 4000 | `copy-{locale}.md → description` |
| Application icon | 512×512 PNG | `assets/play-icon-512.png` |
| Feature graphic | 1024×500 PNG | `assets/play-feature-graphic.png` |
| Phone screenshots | min 2, max 8 (1080×1920+) | `screenshots/android/phone/` |
| 7" tablet screenshots | min 1, max 8 (1200×1920+) | `screenshots/android/tablet-7/` |
| 10" tablet screenshots | min 1, max 8 (1920×2560+) | `screenshots/android/tablet-10/` |

Plus:

- **Category:** Education > Education.
- **Designed for Families:** Opt in. Age band 6-8 + 9-11.
- **Content rating:** IARC questionnaire — answer "No" to all of (violence, sexual, controlled substance, gambling, profanity, scary, unrestricted internet, location sharing). Result: Everyone / 3+.
- **Data safety form:** mirror the Apple Privacy Nutrition declarations. We collect no data and share no data.
- **Target audience:** Children ages 6-11.
- **News app:** No.
- **COVID-19:** No.
- **Government app:** No.
- **Financial features:** None.
- **Permissions justification:**
  - `RECORD_AUDIO`: "Used during pronunciation practice activities. Audio is processed by the on-device speech recogniser and never uploaded."

## Compliance attestations

The user signs and submits the following at upload time (one-time + on every major content update):

- **COPPA** (US): See `coppa-checklist.md`. We are squarely a "directed-to-children" service and follow COPPA verifiable-parent-consent rules: we collect no personal information (no name, no email, no contact, no precise location) so the consent burden is minimal.
- **GDPR-K** (EU, children under 16 in some member states, under 13 in others): No data collection means no lawful basis is required.
- **CARU** (US self-regulatory): No ads, no in-app purchases marketed to children, no behavioural retargeting.
- **UK Children's Code (AADC)**: 15 standards; the relevant ones for us are data minimisation (we collect nothing), default privacy (no data sharing), and age-appropriate language (parent dashboard separated by a ParentGate).
- **Google Designed for Families** policy: no ads, no third-party services collecting personal info, all SDKs declared in the data safety form.

## Asset generation

Re-run from repo root:

```bash
pnpm --filter @e4k/mobile icons:generate
```

This produces the icons, feature graphic, and splash screens listed above. Screenshots are NOT auto-generated — they require live device captures from a built app, deferred to Sprint 6 once the first signed builds exist.
