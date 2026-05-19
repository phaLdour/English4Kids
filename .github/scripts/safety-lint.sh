#!/usr/bin/env bash
#
# safety-lint.sh
#
# Refuses to merge any code that:
#   (a) uses MediaRecorder, persists raw audio Blobs, or wires Web Speech
#       outside the audio package boundary; or
#   (b) ships a third-party tracker/analytics script in child-facing routes.
#
# Required by ADR 0002 and the Safety policy (docs/safety/microphone-policy.md).

set -euo pipefail

fail=0

print_hit() {
  local label="$1"
  local file="$2"
  local line="$3"
  echo "[safety-lint] FAIL (${label}) ${file}:${line}"
  fail=1
}

# Search roots. We exclude node_modules, build output, and the audio package
# (which is the only place that may legitimately touch raw speech APIs).
SEARCH_PATHS=(
  "apps"
  "packages"
)

GREP_EXCLUDES=(
  "--exclude-dir=node_modules"
  "--exclude-dir=.next"
  "--exclude-dir=.turbo"
  "--exclude-dir=dist"
  "--exclude-dir=build"
  "--exclude-dir=coverage"
  "--exclude-dir=.git"
)

run_grep() {
  # $1 = pattern (extended regex)
  # rest = optional extra excludes
  local pattern="$1"
  shift
  grep -rEn "${pattern}" "${SEARCH_PATHS[@]}" "${GREP_EXCLUDES[@]}" "$@" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# (1) Mic-handling primitives outside packages/audio
# ---------------------------------------------------------------------------

MIC_PATTERNS=(
  'new[[:space:]]+MediaRecorder'
  'audio\.blob'
  'webkitSpeechRecognition'
  '(^|[^A-Za-z])SpeechRecognition('
)

for pat in "${MIC_PATTERNS[@]}"; do
  hits="$(run_grep "${pat}" --exclude-dir=audio)"
  if [ -n "${hits}" ]; then
    while IFS= read -r line; do
      file="$(printf '%s' "${line}" | cut -d: -f1)"
      lineno="$(printf '%s' "${line}" | cut -d: -f2)"
      print_hit "mic-primitive: ${pat}" "${file}" "${lineno}"
    done <<< "${hits}"
  fi
done

# ---------------------------------------------------------------------------
# (2) Forbidden trackers anywhere in child-facing player routes
# ---------------------------------------------------------------------------

TRACKER_PATTERNS=(
  'googletagmanager'
  'google-analytics'
  'gtag\('
  'facebook\.net'
  'connect\.facebook'
  'tiktok\.com'
  'analytics\.tiktok'
  'hotjar'
  'mixpanel'
  'amplitude\.com'
  'segment\.com'
  'segment\.io'
)

PLAYER_ROOT_GLOB='apps/web/src/app/(player)'

# We search the player root specifically by including only that path.
for pat in "${TRACKER_PATTERNS[@]}"; do
  if [ -d "${PLAYER_ROOT_GLOB}" ]; then
    hits="$(grep -rEn "${pat}" "${PLAYER_ROOT_GLOB}" "${GREP_EXCLUDES[@]}" 2>/dev/null || true)"
    if [ -n "${hits}" ]; then
      while IFS= read -r line; do
        file="$(printf '%s' "${line}" | cut -d: -f1)"
        lineno="$(printf '%s' "${line}" | cut -d: -f2)"
        print_hit "tracker-in-player: ${pat}" "${file}" "${lineno}"
      done <<< "${hits}"
    fi
  fi
done

# ---------------------------------------------------------------------------

if [ "${fail}" -ne 0 ]; then
  echo
  echo "[safety-lint] one or more safety rules violated. See ADR 0002 and"
  echo "[safety-lint] docs/safety/microphone-policy.md for the policy."
  exit 1
fi

echo "[safety-lint] OK — no forbidden mic primitives or trackers found."
exit 0
