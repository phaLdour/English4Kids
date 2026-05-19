#!/usr/bin/env bash
#
# safety-lint.sh
#
# Refuses to merge any code that:
#   (a) uses MediaRecorder, persists raw audio Blobs, or wires Web Speech
#       outside the audio package boundary; or
#   (b) ships a third-party tracker/analytics/ad/replay/ML-telemetry script
#       in child-facing routes; or
#   (c) puts banned user-facing strings (per Pedagogy red lines) into the
#       app source.
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
# (2) Forbidden trackers / ads / replays / ML telemetry — anywhere
#
#     We scan the whole app tree by default. The parent-segment directory
#     (`apps/web/src/app/(parent)`) is exempted ONLY from the marketing-class
#     denylist (Plausible or similar self-hosted analytics may land there in
#     Phase 2). The hard prohibitions — ad SDKs, session replay — apply
#     everywhere.
# ---------------------------------------------------------------------------

# Hard-prohibited everywhere (no parent exemption).
AD_SDK_PATTERNS=(
  'googletagmanager'
  'doubleclick\.net'
  'facebook\.net'
  'connect\.facebook'
  'fb-tracking'
  '(^|[^A-Za-z])tiktok'
  'analytics\.tiktok'
  'taboola'
  'outbrain'
  'criteo'
  'bing-pixel'
  'bat\.bing\.com'
)

SESSION_REPLAY_PATTERNS=(
  'hotjar'
  'logrocket'
  'fullstory'
  'mouseflow'
  'smartlook'
)

# Soft-prohibited site-wide, exempt under apps/web/src/app/(parent).
ML_TELEMETRY_PATTERNS=(
  'mixpanel'
  'amplitude\.com'
  'segment\.com'
  'segment\.io'
  'heap\.io'
  'posthog'
  'google-analytics'
  'gtag\('
)

PARENT_EXEMPT_DIR='apps/web/src/app/parent'

scan_hard() {
  local label="$1"
  shift
  for pat in "$@"; do
    hits="$(run_grep "${pat}")"
    if [ -n "${hits}" ]; then
      while IFS= read -r line; do
        file="$(printf '%s' "${line}" | cut -d: -f1)"
        lineno="$(printf '%s' "${line}" | cut -d: -f2)"
        print_hit "${label}: ${pat}" "${file}" "${lineno}"
      done <<< "${hits}"
    fi
  done
}

scan_soft() {
  local label="$1"
  shift
  for pat in "$@"; do
    hits="$(run_grep "${pat}")"
    if [ -n "${hits}" ]; then
      while IFS= read -r line; do
        file="$(printf '%s' "${line}" | cut -d: -f1)"
        lineno="$(printf '%s' "${line}" | cut -d: -f2)"
        # Allow parent-only segment for ML-telemetry-class scripts.
        case "${file}" in
          "${PARENT_EXEMPT_DIR}/"*)
            continue
            ;;
        esac
        print_hit "${label}: ${pat}" "${file}" "${lineno}"
      done <<< "${hits}"
    fi
  done
}

scan_hard "ad-sdk" "${AD_SDK_PATTERNS[@]}"
scan_hard "session-replay" "${SESSION_REPLAY_PATTERNS[@]}"
scan_soft "ml-telemetry" "${ML_TELEMETRY_PATTERNS[@]}"

# ---------------------------------------------------------------------------
# (3) Banned user-facing strings (Pedagogy red lines)
#
#     This is a coarse scan: we look for the *literal* banned phrases inside
#     TS/TSX source under apps/web/src. Test files are exempted because they
#     legitimately reference banned strings while asserting our linter
#     catches them. Production content JSON is handled by the
#     `validate:content` job.
# ---------------------------------------------------------------------------

BANNED_STRING_PATTERNS=(
  "(\"|')Wrong(\"|'|!|\\.)"
  "(\"|')No!(\"|')"
  "(\"|')Failed(\"|'|!|\\.)"
  "(\"|')You'?re smart(\"|')"
  "(\"|')Try harder(\"|')"
)

SRC_PATH='apps/web/src'

for pat in "${BANNED_STRING_PATTERNS[@]}"; do
  if [ -d "${SRC_PATH}" ]; then
    hits="$(grep -rEn "${pat}" "${SRC_PATH}" \
      --include='*.ts' \
      --include='*.tsx' \
      --exclude='*.test.ts' \
      --exclude='*.test.tsx' \
      --exclude='*.spec.ts' \
      --exclude='*.spec.tsx' \
      "${GREP_EXCLUDES[@]}" 2>/dev/null || true)"
    if [ -n "${hits}" ]; then
      while IFS= read -r line; do
        file="$(printf '%s' "${line}" | cut -d: -f1)"
        lineno="$(printf '%s' "${line}" | cut -d: -f2)"
        print_hit "banned-string: ${pat}" "${file}" "${lineno}"
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

echo "[safety-lint] OK — no forbidden mic primitives, trackers, ad SDKs, replay scripts, ML telemetry, or banned strings found."
exit 0
