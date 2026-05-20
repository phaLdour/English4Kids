# ADR 0008 — Phase 2 activation: Luna mascot, runtime i18n, Capacitor mobile scaffold

- **Status:** Accepted
- **Date:** 2026-05-20
- **Deciders:** Product Architect, Pedagogy Lead, Safety Officer, Frontend Engineer, user
- **Supersedes:** Partially revisits the descopes in ADR 0006 (single mascot) and the implicit MVP decision to ship English-only.

## Context

Three Phase 2 features were teasered in Sprint 1–3 but not wired:

1. **Luna**, the second mascot. `MascotFrame` already takes a `variant: 'milo' | 'luna'` prop; assets were stubbed; the user-facing toggle still showed Luna as "Available in a future update".
2. **Turkish localisation** — `next-intl` is installed but every visible string is an inline literal. The Critic Wave-1 descope removed the `[locale]` URL segment; we need a runtime-only path that doesn't conflict with the service worker precache, bookmarked URLs, or the CSP exemptions baked into the parent dashboard.
3. **Native mobile shells** — the App Store / Play Store funnel is the largest acquisition channel for kids' education apps. We need a path to native that does not fork the React tree or duplicate audio / Dexie infrastructure.

The three items share a constraint: they must land *without* invalidating the existing safety, privacy, and bundle invariants (ADR 0002, 0006). No new tracking endpoints, no `connect-src` widening, no size-limit regression on the web bundle.

## Decision

### 1. Luna activation

- `mascot.choice` setting accepts three values: `'milo'`, `'luna'`, `'both'`. `'both'` selects deterministically per activity via FNV-1a hash parity on the activity id, so the same lesson always shows the same mascot for a given child.
- Onboarding step 2 (`'buddy'`) becomes a real radio choice. Each card auto-plays a sample on focus using `speechSynthesis` (`en-US` for Milo, `en-GB` for Luna). Web Speech is best-effort — captions cover the text.
- Narration assets follow a `vo.milo.<key>` / `vo.luna.<key>` namespace. `resolveNarrationAsset()` rewrites the asset id to the active mascot's variant when both exist, and **falls back** to the original variant when only one is recorded. This unblocks the lesson player while the Luna voice takes are still being recorded.
- The lesson player builds a memoised `audioMap` in which all `vo.milo.*` / `vo.luna.*` keys point at the active mascot's entry (when available). Existing activity components are unchanged — they continue to look up `audioMap[item.promptAudio]`.

### 2. Runtime i18n (no `[locale]` routing)

- The MVP froze URLs at the root segment. Adding `[locale]` now would break the service worker precache manifest, bookmark URLs, the App Links / Universal Links registration on mobile, and the parent dashboard CSP exemptions. The cost outweighs the SEO benefit.
- Locale lives in Dexie under `ui.locale`. `I18nProvider` (a client component mounted in `Providers`) loads the appropriate `src/locales/<locale>/common.json` via dynamic import and supplies it to `NextIntlClientProvider`.
- A `e4k:locale-change` window event signals the provider to re-hydrate after a setting write. Callers use `notifyLocaleChanged()` after `setSetting('ui.locale', …)`.
- TR is the first non-English locale (Phase 2 launch market). Adding another locale = drop a new JSON + extend `SUPPORTED_LOCALES`.
- Message bundles cover the durable, frequently-rendered surfaces: onboarding, play home, lesson player, settings, parent dashboard, common UI. We do **not** translate authored content (lesson scripts, vocab items) — that stays an authoring pipeline concern.

### 3. Capacitor 7 mobile wrapper

- New workspace package `@e4k/mobile`. Single Capacitor configuration; iOS and Android are sibling targets.
- The web bundle is shipped as a Next.js static export (`output: 'export'`) gated by `E4K_TARGET=mobile`. The default SSR web build is unchanged.
- Native plugins (`@capacitor-community/speech-recognition`, `@capacitor/preferences`, `@capacitor/filesystem`, `@capacitor/app`, `@capacitor/splash-screen`) are accessed through `src/lib/runtime-adapter.ts`. Plugins are *dynamically* imported behind an `isCapacitor()` guard so the web bundle never references them statically.
- `getSpeechRecognition()` in the adapter swaps to the community plugin on native; on the web it returns the existing privacy-checked `WebSpeechStt`. Existing call sites that target the web (`use-mic-session.ts`) are left untouched and continue to use `pickStt()` from `@e4k/audio`. A later sprint will migrate them through the adapter once we have a real device under test.
- Platform-specific folders (`ios/`, `android/`) are generated on demand by `pnpm --filter @e4k/mobile cap:add:ios` / `cap:add:android` and excluded from version control — they are derived artifacts.

## Consequences

**Positive**

- The single biggest open Phase 2 ask (Luna) ships without code duplication; the activity components remain mascot-agnostic.
- Adding a third locale is a JSON file + one constant entry. No route topology change.
- Native shells share 100% of the React, Dexie, Lottie, and Howler stack with the web. No second codebase to maintain.
- The Kids-category compliance posture carries over: same CSP, same on-device speech, same parent gate.

**Negative / Risks**

- `'both'` mode complicates audio asset hygiene — a missing Luna variant is silently masked by the Milo fallback. We mitigate via a CI lint (next sprint) that asserts asset-map symmetry per lesson.
- The runtime locale provider re-renders the entire tree on locale change. With our app size that is negligible (~50 ms on entry-class Android in profiler runs), but worth keeping an eye on if we add bigger trees.
- Static export drops a small number of routes that rely on Next.js server runtime (`/api/*`, dynamic `revalidate`). The mobile build excludes API routes and relies on Supabase REST directly. This is documented in `docs/devops/mobile-capacitor.md`.
- Capacitor 7 plugin versions move quickly; we pin caret-major and revisit on each Phase release.

## Verification

- `mascot-voice.test.ts` covers determinism of `'both'` mode and the fallback contract.
- `i18n-provider.test.tsx` mounts both locales and asserts namespaced key resolution.
- `onboarding/page.test.tsx` exercises Milo / Luna / Both selection paths.
- `pnpm --filter @e4k/mobile cap:build:web` is a smoke test for the static-export path (added to CI as a non-blocking job; promoted to blocking once a contributor has run `cap add` for the first time).

## Alternatives Rejected

| Option                                          | Why rejected                                                                 |
|-------------------------------------------------|------------------------------------------------------------------------------|
| `[locale]` URL segment via next-intl middleware | Breaks SW precache + parent dashboard CSP scoping. Net negative for Phase 2. |
| Server-side language detection                  | We have no server in the static export path; would re-introduce SSR cost.    |
| React Native / Flutter shell                    | Forks the codebase. Loses Dexie, Howler, Lottie, the Web Speech contract.    |
| Per-activity mascot picked at runtime via RNG   | Non-deterministic — different mascot per replay would confuse learners.       |
