# Mobile shell — Capacitor wrapper

The English4Kids iOS and Android apps are thin Capacitor 7 containers around the same Next.js codebase that powers the web PWA. Treat the WebView like a strict, slightly older Safari / Chrome: same React tree, same Dexie storage, same Lottie / Howler runtime, with platform plugins layered in via the runtime adapter.

This document covers prerequisites, the `cap add` flow, the build pipeline, signing, and store submission.

## Sprint 5 status

Sprint 5 (Mobile Agent) put the repo into a **single-command** state: once the user opens an Apple Developer account and a Google Play developer account, the chain from "fresh clone" to "buildable Xcode + Android Studio projects" is:

```bash
pnpm install
pnpm --filter @e4k/mobile cap:add:ios      # auto-runs post-cap-add.sh
pnpm --filter @e4k/mobile cap:add:android  # auto-runs post-cap-add.sh
```

Everything else (Info.plist keys, AndroidManifest permissions, icon set, splash screen, signing config block, ProGuard rules, App Group entitlement, store-listing copy) is pre-staged in `apps/mobile/templates/` and `apps/mobile/assets/` and gets applied automatically by those two commands.

What the user still does at the end (account-gated; nothing in code can pre-empt these):

1. Apple Developer account ($99/yr) → record Team ID; Xcode signing pulls automatic provisioning.
2. Google Play developer account ($25 one-time) → enable Play App Signing; generate upload keystore.
3. Replace placeholder icons (`apps/mobile/assets/PLACEHOLDER-ICONS.md`) with real rendered PNGs by installing `sharp` and re-running `pnpm --filter @e4k/mobile icons:generate`.
4. Paste the contents of `apps/mobile/store-listing/copy-en.md` + `coppa-checklist.md` into App Store Connect and Google Play Console.
5. Capture device screenshots from a built app and add them to `apps/mobile/store-listing/screenshots/`.

## Prerequisites

| Tool          | Version           | Notes                                                |
|---------------|-------------------|------------------------------------------------------|
| Node          | >= 20 (`.nvmrc`)  | Same as the rest of the monorepo.                    |
| pnpm          | 9                 | Workspace resolver — `cap` plugins respect it.       |
| Xcode         | 15+               | macOS-only; iOS simulator requires the bundled SDK.  |
| CocoaPods     | 1.15+             | `sudo gem install cocoapods` (or `brew install cocoapods`). |
| Android Studio| Hedgehog (2023.1)+| Android Gradle Plugin 8.x, JDK 17 bundled.           |
| JDK           | 17                | Required by AGP 8.                                   |

CI runs the iOS build on macOS-latest runners and the Android build on ubuntu-latest with a JDK + Android SDK action. Neither pipeline checks in generated platform projects — they are recreated on each run.

## `cap add` flow (Sprint 5)

```bash
pnpm install
pnpm --filter @e4k/mobile cap:add:ios          # generates apps/mobile/ios/App/
pnpm --filter @e4k/mobile cap:add:android      # generates apps/mobile/android/
```

Both commands run the matching `templates/{ios,android}/post-cap-add.sh` script automatically (wired through the `package.json` `cap:add:*` scripts). The post-scripts are idempotent — running `cap:add:ios` a second time updates Info.plist + icons in-place without corrupting the Xcode project.

`cap add` reads `apps/mobile/capacitor.config.ts` and generates:

- `apps/mobile/ios/App/` — Xcode project, `Info.plist`, `Podfile`, `App` target.
- `apps/mobile/android/` — Gradle wrapper, `app/` module, `AndroidManifest.xml`.

Both directories are in `.gitignore` because they are derived. The configuration that needs to persist (bundle id, splash colours, plugin entries) lives in `capacitor.config.ts` and is reapplied on every regeneration. The platform-specific overrides (microphone primer strings, permission declarations, R8 rules, App Group identifier) live in `apps/mobile/templates/` and are merged in by the post-scripts.

## Template directory

```
apps/mobile/templates/
  ios/
    Info.plist.template          # documents the keys we merge in
    post-cap-add.sh              # idempotent merge + icon copy + entitlements
  android/
    AndroidManifest.template.xml # documents permissions + features
    build.gradle.template        # signing block + R8 + bundle config
    proguard-rules.pro           # additional keep rules
    signing.properties.template  # commented-out instructions for the user
    post-cap-add.sh              # manifest merge + signing wire-up + icon copy
```

## Build pipeline

```text
+--------------------+        +-------------------+        +---------------------+
| Next.js static     |        | Capacitor copy    |        | Xcode / Gradle      |
| export             | -----> | apps/web/out into | -----> | builds the platform |
| (E4K_TARGET=mobile)|        | the iOS/Android   |        | binary, signs, ships|
+--------------------+        +-------------------+        +---------------------+
```

Commands:

```bash
# Static export — drops into apps/web/out/.
pnpm --filter @e4k/mobile cap:build:web

# Capacitor copies the export into both platform projects.
pnpm --filter @e4k/mobile cap:copy

# Open IDEs for local builds.
pnpm --filter @e4k/mobile cap:open:ios
pnpm --filter @e4k/mobile cap:open:android

# All-in-one (local dev):
bash apps/mobile/scripts/build-local.sh ios       # macOS only
bash apps/mobile/scripts/build-local.sh android
bash apps/mobile/scripts/build-local.sh both
```

For CI:

```bash
pnpm --filter @e4k/mobile cap:ship   # build:web + cap:copy
# iOS:  via .github/workflows/mobile-ios-build.yml
# Android: via .github/workflows/mobile-android-build.yml
```

Both workflows are manual-dispatch only and currently marked `continue-on-error: true` because they need an Apple Developer signing identity / Android keystore that the user has not yet generated. They validate the rest of the pipeline shape on every dispatch.

## Icons + splash

Sources of truth (SVG):

- `apps/mobile/assets/source/app-icon.svg` — 1024x1024 master.
- `apps/mobile/assets/source/splash-screen.svg` — 2732x2732 master.
- `apps/mobile/assets/source/adaptive-icon-foreground.svg` — Android adaptive 432x432.
- `apps/mobile/assets/source/adaptive-icon-background.svg` — Android adaptive 432x432 (cream fill).

Run `pnpm --filter @e4k/mobile icons:generate` to render every required PNG. On a machine without `sharp` (CI sandbox, fresh checkout) the script emits 1x1 transparent placeholders and writes `apps/mobile/assets/PLACEHOLDER-ICONS.md` to warn. Install `sharp` (`pnpm --filter @e4k/mobile add -D sharp`) before the first store upload to produce production-quality PNGs.

## App Store / Play Store — Kids category

Both stores apply heightened data-handling rules to apps in the Kids age band (Apple) or Designed-for-Families (Google). The English4Kids posture:

| Requirement                                          | How we comply                                                              |
|------------------------------------------------------|----------------------------------------------------------------------------|
| No third-party analytics or ad SDKs                  | Default-deny CSP (`apps/web/next.config.ts`), no Sentry in child routes.   |
| In-app purchases gated by parent verification        | `ParentGate` (Radix Dialog) wraps every parent-only surface.               |
| Microphone usage is opt-in and explained             | Mic primer in onboarding + `MicIndicator` persistent indicator.            |
| No off-device processing of voice                    | `runtime-adapter.ts` routes STT to the on-device community plugin only.    |
| Clear privacy disclosure                             | `/privacy` and `/privacy/parent-summary` routes ship in the static export. |
| No tracking identifiers                              | `ACCESS_AD_ID` not requested on Android; no IDFA usage description on iOS. |
| Designed for Families opt-in (Play)                  | Single age-band (6-11), no ads, declared in `store-listing/README.md`.     |
| Privacy Nutrition Label (Apple)                      | "Data Not Collected" across all categories. See `store-listing/README.md`. |

Full submission checklist + per-store field map: see [`apps/mobile/store-listing/README.md`](../../apps/mobile/store-listing/README.md). COPPA self-certification: see [`apps/mobile/store-listing/coppa-checklist.md`](../../apps/mobile/store-listing/coppa-checklist.md).

## Signing

- **iOS:** Open the Xcode workspace, switch to the "Signing & Capabilities" tab, set your Apple Team. `post-cap-add.sh` has already wired `App.entitlements` with the `group.com.english4kids.shared` App Group identifier; toggle the App Groups capability on so Xcode associates it with your team. For CI uploads, store a `.p12` cert + provisioning profile in GitHub Actions secrets and use Fastlane Match (or the App Store Connect API key) — wire this into `.github/workflows/mobile-ios-build.yml` once the developer account exists.
- **Android:** Generate a release keystore (one time, see `templates/android/signing.properties.template`), copy `signing.properties.template` to `android/app/signing.properties`, and fill in the four credential values. The real `signing.properties` and `keystore.jks` are gitignored. For CI, base64-encode the keystore and add it as the `ANDROID_KEYSTORE_BASE64` secret (the workflow already decodes it).
- **Never commit:** `keystore.jks`, `signing.properties`, `.p12` certs, provisioning profiles. The root `.gitignore` has Sprint 5 entries for all of these.

## Performance considerations

- The WebView shares the 25 MB initial-load budget enforced by `size-limit` (ADR 0006). The mobile build is *larger* on disk because it includes the native runtime (~6 MB iOS, ~4 MB Android), but the JavaScript footprint is identical.
- whisper.wasm needs **~300 MB of heap** during model load on tablet form factors. Android default heap (~192 MB on many devices) OOMs; we set `android:largeHeap="true"` in the manifest. iOS WebViews don't expose a heap cap so this is Android-specific.
- Use Capacitor's bundled splash screen (configured in `capacitor.config.ts`) rather than a React loader to mask the WebView warm-up. `launchShowDuration: 2000ms`, `splashImmersive: true` so the system UI doesn't peek.
- Avoid synchronous bridge calls in the render path. The runtime adapter dynamically imports plugins exactly once, on the first call.
- Howler over WebAudio works inside WKWebView (iOS) and Android System WebView. The Web Speech fallback path in `@e4k/audio` is unused on native; the community speech recognition plugin returns a transcript directly.
- **Moto G-class device** target: ~2GB RAM, Snapdragon 6-series. The mobile build idles around 120 MB RSS and peaks around 320 MB during whisper warmup. We do not precache audio for offline beyond the first 2 lessons (300 KB OGG) to keep startup time bounded.

## Troubleshooting

| Symptom                                       | Likely cause / fix                                                              |
|-----------------------------------------------|---------------------------------------------------------------------------------|
| `cap copy` fails with "webDir not found"      | Run `cap:build:web` first; the static export must exist at `apps/web/out/`.     |
| iOS build complains about missing usage description | Re-run `bash templates/ios/post-cap-add.sh` — that script writes the strings. |
| Android speech plugin returns empty matches   | Confirm the user granted `RECORD_AUDIO`; the plugin returns `[]` on rejection.  |
| Static export omits a route                   | The route uses a runtime feature (cookies, headers) — that's expected; mobile builds can't include it. Move logic client-side or hide the route in `E4K_TARGET=mobile`. |
| App icon shows up blank on simulator          | `sharp` isn't installed; placeholder PNGs in use. Install `sharp` and re-run icons:generate. |
| Android release build fails on signing        | `signing.properties` missing — copy from template and fill in. Build will fall through to debug signing with a warning otherwise. |
| Xcode complains about App Group entitlement   | Open Signing & Capabilities, toggle App Groups off and back on so Xcode re-associates `group.com.english4kids.shared` with your team. |
