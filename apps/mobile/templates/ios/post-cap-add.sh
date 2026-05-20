#!/usr/bin/env bash
#
# English4Kids — post-cap-add iOS template merge (Sprint 5, S5-1).
#
# Runs once after `pnpm --filter @e4k/mobile cap:add:ios`. It is idempotent:
# every plutil call uses `-replace` (not `-insert`) and every copy step has
# already-exists guards, so running this script twice does not corrupt the
# Xcode project.
#
# Usage:
#   bash apps/mobile/templates/ios/post-cap-add.sh
#
# Requires: macOS + Xcode command line tools (`plutil`, `xcrun`).
# Sandbox-safe: this script will refuse to run on non-Darwin systems with a
# clear error, so accidentally invoking it from CI on Linux is harmless.

set -euo pipefail

# Resolve paths relative to the repo root regardless of where the caller
# launched the script from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
IOS_APP_DIR="$MOBILE_DIR/ios/App"
INFO_PLIST="$IOS_APP_DIR/App/Info.plist"
ASSETS_DIR="$IOS_APP_DIR/App/Assets.xcassets"
SOURCE_ICONS="$MOBILE_DIR/assets/ios/AppIcon.appiconset"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "post-cap-add.sh must run on macOS (Darwin). Current: $(uname -s)."
fi

if [[ ! -f "$INFO_PLIST" ]]; then
  fail "Info.plist not found at $INFO_PLIST. Run \`pnpm --filter @e4k/mobile cap:add:ios\` first."
fi

bold "1/5  Merging Info.plist keys from template"

# Each key is applied with `plutil -replace`; if the key doesn't exist yet,
# we fall back to `-insert`. This keeps the script idempotent.
plist_set() {
  local key="$1"
  local type="$2"
  local value="$3"
  if /usr/libexec/PlistBuddy -c "Print :$key" "$INFO_PLIST" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Set :$key $value" "$INFO_PLIST"
  else
    /usr/libexec/PlistBuddy -c "Add :$key $type $value" "$INFO_PLIST"
  fi
}

plist_set "CFBundleDisplayName" "string" "English4Kids"
plist_set "NSMicrophoneUsageDescription" "string" "English4Kids needs the microphone so your child can practice saying words. Audio stays on this device and is never sent over the internet."
plist_set "NSSpeechRecognitionUsageDescription" "string" "English4Kids uses speech recognition to score pronunciation. All processing happens on this device."
plist_set "ITSAppUsesNonExemptEncryption" "bool" "false"
plist_set "UIRequiresFullScreen" "bool" "true"
plist_set "UIStatusBarStyle" "string" "UIStatusBarStyleDefault"
plist_set "UIViewControllerBasedStatusBarAppearance" "bool" "false"

# UISupportedInterfaceOrientations (phone): portrait only.
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations: string UIInterfaceOrientationPortrait" "$INFO_PLIST"

# UISupportedInterfaceOrientations~ipad: portrait + landscape.
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations~ipad" "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad array" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationPortrait" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationPortraitUpsideDown" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationLandscapeLeft" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations~ipad: string UIInterfaceOrientationLandscapeRight" "$INFO_PLIST"

bold "2/5  Copying app icon set"

if [[ -d "$SOURCE_ICONS" ]]; then
  mkdir -p "$ASSETS_DIR/AppIcon.appiconset"
  # `cp -R` overwrites existing files; safe to re-run.
  cp -R "$SOURCE_ICONS/." "$ASSETS_DIR/AppIcon.appiconset/"
else
  warn "Source icons not found at $SOURCE_ICONS — run \`node apps/mobile/scripts/generate-icons.mjs\` first."
fi

bold "3/5  Setting iOS deployment target to 16.0"

PROJECT_FILE="$IOS_APP_DIR/App.xcodeproj/project.pbxproj"
if [[ -f "$PROJECT_FILE" ]]; then
  # Set IPHONEOS_DEPLOYMENT_TARGET = 16.0 across all configurations. Use
  # sed in-place; the regex is intentionally conservative so we don't clobber
  # unrelated tokens.
  /usr/bin/sed -i.bak -E 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = 16.0;/g' "$PROJECT_FILE"
  rm -f "$PROJECT_FILE.bak"
else
  warn "project.pbxproj not found; deployment target left at Capacitor default."
fi

bold "4/5  Declaring App Group identifier placeholder"

# App Group is required for future widget / share-extension work. We declare
# the identifier here so the user only needs to enable it in Xcode's Signing
# & Capabilities pane (no manual entitlements file editing).
ENTITLEMENTS="$IOS_APP_DIR/App/App.entitlements"
if [[ ! -f "$ENTITLEMENTS" ]]; then
  cat > "$ENTITLEMENTS" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>group.com.english4kids.shared</string>
  </array>
</dict>
</plist>
PLIST
fi

bold "5/5  Done"

cat <<'EOF'

Next steps for the user:

  1. Open the Xcode workspace:
       open apps/mobile/ios/App/App.xcworkspace

  2. In the project navigator select the "App" target, then go to the
     "Signing & Capabilities" tab.
       a. Set your Apple Team in the "Team" dropdown.
       b. Bundle Identifier should already be `app.english4kids`.
       c. The "App Groups" capability is pre-wired to
          `group.com.english4kids.shared` via App.entitlements; toggle it
          on (Xcode will prompt to associate it with your team).

  3. Build to a real device (Cmd+R) to verify microphone + speech
     permissions trigger the kid-safe primer strings.

  4. For App Store upload, archive (Product > Archive) and follow the
     Organizer flow. The export-compliance question is auto-answered "no"
     by ITSAppUsesNonExemptEncryption=false in Info.plist.

EOF
