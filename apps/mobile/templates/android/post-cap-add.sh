#!/usr/bin/env bash
#
# English4Kids — post-cap-add Android template merge (Sprint 5, S5-2).
#
# Runs once after `pnpm --filter @e4k/mobile cap:add:android`. Idempotent:
# every merge step checks whether the target marker is already present
# before inserting.
#
# Usage:
#   bash apps/mobile/templates/android/post-cap-add.sh
#
# Works on macOS + Linux (uses portable sed via temp files).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
APP_DIR="$ANDROID_DIR/app"
MANIFEST="$APP_DIR/src/main/AndroidManifest.xml"
BUILD_GRADLE="$APP_DIR/build.gradle"
PROGUARD="$APP_DIR/proguard-rules.pro"
SOURCE_ICONS="$MOBILE_DIR/assets/android/res"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

if [[ ! -f "$MANIFEST" ]]; then
  fail "AndroidManifest.xml not found at $MANIFEST. Run \`pnpm --filter @e4k/mobile cap:add:android\` first."
fi

bold "1/5  Merging permissions into AndroidManifest.xml"

# Insert RECORD_AUDIO + uses-feature mic right after the opening <manifest> tag,
# but only if they're not present yet.
ensure_manifest_line() {
  local marker="$1"
  local block="$2"
  if ! grep -qF "$marker" "$MANIFEST"; then
    # Insert before the first <application tag.
    python3 - "$MANIFEST" "$block" <<'PY'
import sys
path = sys.argv[1]
block = sys.argv[2]
with open(path, "r", encoding="utf-8") as fh:
    content = fh.read()
content = content.replace("<application", block + "\n    <application", 1)
with open(path, "w", encoding="utf-8") as fh:
    fh.write(content)
PY
  fi
}

ensure_manifest_line "android.permission.RECORD_AUDIO" \
  '    <uses-permission android:name="android.permission.RECORD_AUDIO" />'
ensure_manifest_line "android.hardware.microphone" \
  '    <uses-feature android:name="android.hardware.microphone" android:required="true" />'
ensure_manifest_line "ACCESS_NETWORK_STATE" \
  '    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />'

# Add android:largeHeap="true" + android:allowBackup="false" to <application>
# if not already present.
if ! grep -q 'android:largeHeap="true"' "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PY'
import re, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    content = fh.read()
content = re.sub(
    r"<application\b",
    '<application\n        android:largeHeap="true"\n        android:allowBackup="false"',
    content, count=1,
)
with open(path, "w", encoding="utf-8") as fh:
    fh.write(content)
PY
fi

bold "2/5  Copying app icons"

if [[ -d "$SOURCE_ICONS" ]]; then
  mkdir -p "$APP_DIR/src/main/res"
  cp -R "$SOURCE_ICONS/." "$APP_DIR/src/main/res/"
else
  warn "Source icons not found at $SOURCE_ICONS — run \`node apps/mobile/scripts/generate-icons.mjs\` first."
fi

bold "3/5  Merging proguard-rules.pro"

if [[ -f "$PROGUARD" ]]; then
  if ! grep -q "English4Kids" "$PROGUARD"; then
    cat "$SCRIPT_DIR/proguard-rules.pro" >> "$PROGUARD"
  fi
else
  cp "$SCRIPT_DIR/proguard-rules.pro" "$PROGUARD"
fi

bold "4/5  Wiring signing config + R8 in build.gradle"

if ! grep -q "signing.properties" "$BUILD_GRADLE"; then
  # We don't blindly overwrite the user's build.gradle; we append the signing
  # block at the end of the android { } closure. To keep things robust we use
  # a Python script to splice into the AST.
  python3 - "$BUILD_GRADLE" "$SCRIPT_DIR/build.gradle.template" <<'PY'
import re, sys
target = sys.argv[1]
template = sys.argv[2]

with open(template, "r", encoding="utf-8") as fh:
    snippet = fh.read()

# Extract just the signingConfigs + buildTypes blocks from the template — we
# don't replace the whole file, only those sections.
def extract_block(text, name):
    pattern = re.compile(r"(%s\s*\{)" % re.escape(name))
    match = pattern.search(text)
    if not match:
        return None
    start = match.start()
    depth = 0
    i = match.end() - 1
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1]
        i += 1
    return None

signing_block = extract_block(snippet, "signingConfigs")
buildtypes_block = extract_block(snippet, "buildTypes")

with open(target, "r", encoding="utf-8") as fh:
    content = fh.read()

# Replace existing signingConfigs / buildTypes blocks if they exist; else
# append before the closing `}` of the android { } block.
def replace_or_insert(content, name, block):
    existing = extract_block(content, name)
    if existing:
        return content.replace(existing, block)
    # insert before final closing brace of android{ }
    m = re.search(r"^android\s*\{", content, re.MULTILINE)
    if not m:
        return content + "\n" + block + "\n"
    depth = 0
    i = m.end() - 1
    while i < len(content):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                return content[:i] + "\n    " + block.replace("\n", "\n    ") + "\n" + content[i:]
        i += 1
    return content

if signing_block:
    content = replace_or_insert(content, "signingConfigs", signing_block)
if buildtypes_block:
    content = replace_or_insert(content, "buildTypes", buildtypes_block)

with open(target, "w", encoding="utf-8") as fh:
    fh.write(content)
PY
fi

bold "5/5  Done"

cat <<'EOF'

Next steps for the user:

  1. Create a release keystore (one time):
       keytool -genkey -v \
         -keystore apps/mobile/android/app/keystore.jks \
         -alias english4kids \
         -keyalg RSA -keysize 2048 -validity 36500

  2. Copy templates/android/signing.properties.template to
     android/app/signing.properties and fill in the four values. The
     real signing.properties is gitignored.

  3. Open Android Studio:
       studio apps/mobile/android

     Let Gradle sync (first sync downloads the Android SDK if needed).

  4. Build > Generate Signed Bundle / APK > Android App Bundle.
     Use the release signing config we just wired in.

  5. Upload the resulting .aab to Play Console. Enable Play App Signing
     so the upload key stays separate from the signing key.

EOF
