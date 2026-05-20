#!/usr/bin/env bash
#
# English4Kids — local mobile build chain (Sprint 5).
#
# Convenience script that mirrors the CI workflows. Run from the repo root:
#
#   bash apps/mobile/scripts/build-local.sh ios       # build iOS .xcarchive
#   bash apps/mobile/scripts/build-local.sh android   # build Android .aab + .apk
#   bash apps/mobile/scripts/build-local.sh both
#
# Assumes:
#   - pnpm install has already run
#   - For iOS: macOS + Xcode + CocoaPods
#   - For Android: Android SDK + JDK 17

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TARGET="${1:-both}"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

case "$TARGET" in
  ios|android|both) ;;
  *) fail "Usage: $0 [ios|android|both]" ;;
esac

cd "$REPO_ROOT"

bold "==> Step 1: Build web static export"
E4K_TARGET=mobile pnpm --filter @e4k/web build

bold "==> Step 2: Verify static export"
[[ -d apps/web/out/_next/static ]] || fail "static export missing"

bold "==> Step 3: Generate icons"
node apps/mobile/scripts/generate-icons.mjs

if [[ "$TARGET" == "ios" || "$TARGET" == "both" ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    bold "==> Skipping iOS (not macOS)"
  else
    bold "==> Step 4a: Capacitor sync iOS"
    pnpm --filter @e4k/mobile exec cap sync ios

    bold "==> Step 5a: Xcode archive"
    cd "$REPO_ROOT/apps/mobile/ios/App"
    xcodebuild \
      -workspace App.xcworkspace \
      -scheme App \
      -sdk iphoneos \
      -configuration Release \
      -archivePath build/App.xcarchive \
      archive
    cd "$REPO_ROOT"
    bold "    iOS archive at apps/mobile/ios/App/build/App.xcarchive"
  fi
fi

if [[ "$TARGET" == "android" || "$TARGET" == "both" ]]; then
  bold "==> Step 4b: Capacitor sync Android"
  pnpm --filter @e4k/mobile exec cap sync android

  bold "==> Step 5b: Gradle bundleRelease"
  cd "$REPO_ROOT/apps/mobile/android"
  chmod +x ./gradlew
  ./gradlew bundleRelease assembleRelease --no-daemon
  cd "$REPO_ROOT"
  bold "    Android AAB at apps/mobile/android/app/build/outputs/bundle/release/"
  bold "    Android APK at apps/mobile/android/app/build/outputs/apk/release/"
fi

bold "==> Done."
