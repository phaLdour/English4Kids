# @e4k/mobile

Capacitor 7 wrapper that ships the `@e4k/web` Next.js app as native iOS and Android binaries. The bundled `public/` directory inside each platform project is a static export of the web app; everything else (Lottie, audio, Dexie, Web Speech) runs unchanged inside the WebView.

This package intentionally does **not** check in the generated `ios/` or `android/` folders. They are created the first time a contributor runs `cap add` and are regenerated on every CI build.

## Prerequisites

- Node ≥ 20 + pnpm 9 (matches the root `package.json`).
- **iOS:** macOS, Xcode 15+, CocoaPods, an Apple Developer account for App Store builds.
- **Android:** Android Studio Hedgehog+ (Android Gradle Plugin 8.x), JDK 17.

## First-time setup

```bash
pnpm install                                    # from repo root
pnpm --filter @e4k/mobile cap:add:ios          # creates apps/mobile/ios/
pnpm --filter @e4k/mobile cap:add:android      # creates apps/mobile/android/
```

These commands also write platform-specific `Info.plist` / `AndroidManifest.xml` entries derived from `capacitor.config.ts`.

## Build pipeline

```bash
# 1. Build the Next.js app as a static export (toggled by E4K_TARGET=mobile).
pnpm --filter @e4k/mobile cap:build:web

# 2. Copy the export into the platform projects.
pnpm --filter @e4k/mobile cap:copy

# 3. Open the platform project to build/sign/distribute.
pnpm --filter @e4k/mobile cap:open:ios
pnpm --filter @e4k/mobile cap:open:android
```

`cap:ship` chains steps 1 and 2 for CI.

## Environment variables

The mobile build inherits `apps/web/.env.local`, but only public (`NEXT_PUBLIC_*`) variables are usable inside the WebView. Server-only secrets are stripped by the static export.

| Variable               | Purpose                                                 |
|------------------------|---------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | Cloud sync endpoint.                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Cloud sync anon key.                            |
| `E4K_TARGET=mobile`           | Forces `output: 'export'` in `next.config.ts`.   |

## App Store / Play Store notes

- **Kids category.** Both stores enforce a Kids-class data minimisation regime. Our default-deny analytics CSP and on-device speech recognition keep us inside that bracket; *do not* re-enable third-party trackers without Safety Officer sign-off.
- **Microphone permissions.** Add a `NSMicrophoneUsageDescription` to `ios/App/App/Info.plist`: "English4Kids listens during speaking practice. Your child's voice stays on the device." Mirror the copy in `android/app/src/main/AndroidManifest.xml` via `<uses-permission android:name="android.permission.RECORD_AUDIO" />` plus an in-app primer (the existing `MicIndicator` component covers this).
- **Code signing.** Use environment-scoped provisioning profiles in CI (Match for iOS, Play App Signing for Android). The signing config is intentionally not committed.

## Performance considerations

- The WebView shares the same 25 MB initial-load budget (ADR 0006). Static export removes server runtime cost; first paint is gated on the WebView decoding the precached bundle.
- Audio uses Howler over WebAudio — works inside iOS WKWebView and Android WebView without modification.
- Avoid native bridges in the hot path: `runtime-adapter.ts` lazy-imports plugins only when `isCapacitor()` is true, so the web bundle stays uncontaminated.

## Documentation

For the full pipeline, signing details, and store submission checklist see [docs/devops/mobile-capacitor.md](../../docs/devops/mobile-capacitor.md).
