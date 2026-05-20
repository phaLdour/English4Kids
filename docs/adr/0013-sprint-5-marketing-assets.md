# ADR-0013 — Sprint 5: Marketing assets for App Store and Google Play

Status: Accepted
Date: 2026-05-20
Sprint: 5 (S5-7, Wave B)
Owner: Marketing Agent

## Context

Sprint 5 Wave A landed the production privacy posture: Plausible parent-only analytics, privacy policy v1.0, server-side VPC gating, and the 461-key Turkish locale. The mobile store-listing scaffold from S5-2 (Mobile Agent) shipped a README, the COPPA checklist, a finalised English copy block, and a Turkish placeholder.

Wave B closes the loop on submission-ready marketing assets without touching code or pulling forward the payments and account-creation workflows (those are explicitly deferred to "para ödeme + hesap açma en sonda"). The deliverable is a complete paste-it-into-the-console bundle, minus only the live URLs the user fills in once domains and support tooling are finalised.

The two main open questions for Wave B were screenshot generation and the Turkish copy style.

## Decision

### 1. Screenshots are deferred to Sprint 6 with a complete capture template

We do not ship screenshots in Wave B. Both Apple and Google reject simulator mockups that do not match what end-users see, and the in-tree mobile app currently has no signed build. Pre-emptively capturing screenshots from `apps/web` running in a desktop browser produces images that fail review against real-device captures.

Instead, `apps/mobile/store-listing/screenshots-guide.md` specifies the full 8-slot capture plan (welcome, mascot picker, Listen & Tap, Speak It!, Story Time, Sing Along, Word Garden, Parent Dashboard), the exact device resolutions for both stores, capture mechanics for Xcode simulator and Android Studio AVD, a Chrome DevTools fallback for PWA-equivalent captures, the minimal-annotation Lingokids style for any text overlays, and a per-slot QA checklist. The actual capture session happens in Sprint 6 once the first signed builds land.

### 2. Turkish copy uses formal "siz" with warm but non-manipulative tone

Turkish marketing convention is moderately more emotive than English equivalents, but the kids-category audience demands the same calm posture as the English copy. We resolve this by:

- Using the formal "siz" address throughout (parent-facing, never the informal "sen").
- Keeping the brand name "English4Kids" untranslated.
- Translating descriptive nouns ("Tilki", "Baykuş") but keeping the mascot proper names ("Milo", "Luna").
- Preserving English acronyms (CEFR, COPPA, GDPR-K, AADC) with parenthetical Turkish explanations.
- Avoiding urgency triggers ("Sınırlı süre!", "Kaçırmayın!") and avoiding manipulative loss-aversion framing.
- Converting the keyword list to Turkish terms: `ingilizce,çocuk,ingilizce öğren,fonetik,esl,kelime,okuma,coppa`.

The result reads as warm parent-facing prose rather than American kids-app marketing translated literally. A reviewer note at the bottom of `copy-tr.md` lists the brand-name and acronym carveouts so a native speaker can audit consistency in one pass.

### 3. Privacy nutrition + data safety drafts mirror privacy policy v1.0 exactly

Both stores publish their privacy questionnaire answers in the listing. If those answers diverge from the privacy policy text or from the COPPA checklist, the review team flags it and the listing is rejected. Wave B writes both forms (`privacy-nutrition.md` for Apple, `google-data-safety.md` for Google) by translating the privacy policy v1.0 SDK inventory and data-flow descriptions into each store's category taxonomy verbatim.

The four declared SDKs (Supabase, Resend, Sentry, Plausible) appear in the same row order in both forms, with the same gating conditions (DSN-gated for Sentry, env-var-gated for Plausible). The microphone story is the same in both: the on-device recogniser produces a transcript, the app computes a numeric 0–100 score, and only the score (post-VPC) ever crosses the network. Audio frames are never written to disk.

The `Data Used to Track You` answer is `NONE` in both stores, which is the strongest claim a kids app can make and is the load-bearing differentiator versus competitor listings.

### 4. No paid acquisition or growth scope this sprint

Wave B does not produce ad copy, App Store Search Ads templates, App Store Optimisation keyword variants beyond the 100-char keyword field, App Preview videos, Google Ads creative, social media collateral, or press kit material. The MVP launch posture is organic only. Growth scope is deferred until the post-launch analytics dashboard has been live long enough to baseline organic conversion, which lands no earlier than Sprint 8.

### 5. Feature graphic is delivered as SVG, rendered to PNG at submission time

The Google Play feature graphic (1024×500) ships as `feature-graphic.svg` (under 6 KB) so the source is reviewable in the repo, modifiable without binary diff noise, and renderable to PNG with `rsvg-convert` or `inkscape` at upload time. The submitter can re-render at the exact 1024×500 dimensions Google requires, avoiding the typical 5%-too-small or 1px-too-tall rejection.

## Consequences

### Positive

- A new contributor (or the user themselves) can submit the app to either store using only the files in `apps/mobile/store-listing/` plus the placeholder URLs. No additional copywriting, no asset hunting.
- The privacy nutrition label + data safety form + COPPA checklist + privacy policy v1.0 are now four documents saying the exact same thing in four different formats. Review-time drift becomes a single-source change against the privacy policy.
- The screenshot capture template means Sprint 6 can hand the work to a contractor with one document and zero ambiguity.

### Negative / accepted

- Without real screenshots, the submission cannot actually ship from this sprint. That is the intended outcome — payments and account creation are deferred to "en sonda" and the user has not yet opened developer accounts.
- The 4000-character description fields are aspirational on a few specifics (e.g. "three units"). When unit count changes in a future sprint, the description must be updated in both EN and TR. The README's checklist flags this dependency.

## Alternatives considered

- **Ship simulator-frame screenshots as placeholder.** Rejected: stores reject mocked frames; reshooting later wastes the slot ordering work; and a partial set looks worse than no set.
- **Skip the Turkish translation until Sprint 6.** Rejected: Sprint 5 shipped the 461-key TR locale plus TR section titles in the privacy policy. Leaving the store listing in English while the in-app experience is fully bilingual creates a credibility gap on the listing page that a native Turkish reader notices immediately.
- **Write a marketing landing page instead of finalising copy.** Out of scope and entangles with the Web Agent's territory. Deferred to a future sprint.
