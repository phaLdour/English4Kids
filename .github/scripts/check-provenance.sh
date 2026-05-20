#!/usr/bin/env bash
#
# check-provenance.sh
#
# Fails the build if a PR adds files under any tracked asset directory
# without updating PROVENANCE.md. Required by ADR 0005 and the Safety policy.
#
# Tracked asset roots:
#   - assets/
#   - apps/web/public/audio/
#   - apps/web/public/lottie/

set -euo pipefail

BASE_REF="${BASE_REF:-main}"
HEAD_REF="${HEAD_REF:-HEAD}"

# Make sure we have the base ref locally. In GitHub Actions with fetch-depth: 0
# the full history is present; for safety also try a remote fetch if missing.
if ! git rev-parse --verify --quiet "origin/${BASE_REF}" >/dev/null; then
  git fetch --no-tags --depth=1 origin "${BASE_REF}" || true
fi

if git rev-parse --verify --quiet "origin/${BASE_REF}" >/dev/null; then
  COMPARE_REF="origin/${BASE_REF}"
elif git rev-parse --verify --quiet "${BASE_REF}" >/dev/null; then
  COMPARE_REF="${BASE_REF}"
else
  # No base ref available (e.g. very first push of a new repo); skip gracefully.
  echo "[provenance-check] base ref '${BASE_REF}' not found; skipping."
  exit 0
fi

ASSET_PATTERN='^(assets/|apps/web/public/audio/|apps/web/public/lottie/)'

# Files added (status A) under any asset directory in this branch vs base.
added_assets="$(git diff --name-only --diff-filter=A "${COMPARE_REF}...HEAD" | grep -E "${ASSET_PATTERN}" || true)"

if [ -z "${added_assets}" ]; then
  echo "[provenance-check] no new asset files added — OK."
  exit 0
fi

echo "[provenance-check] new asset files detected:"
echo "${added_assets}" | sed 's/^/  - /'

# PROVENANCE.md must have been changed (any status) in this branch.
provenance_changed="$(git diff --name-only "${COMPARE_REF}...HEAD" | grep -E '^PROVENANCE\.md$' || true)"

if [ -z "${provenance_changed}" ]; then
  echo
  echo "[provenance-check] FAIL: assets were added but PROVENANCE.md was not updated."
  echo "[provenance-check] Add a row for each new asset listing source, author, license, and date."
  exit 1
fi

# Per-file check: every added asset's basename must appear in PROVENANCE.md.
missing=""
while IFS= read -r asset_path; do
  [ -z "${asset_path}" ] && continue
  asset_basename="$(basename "${asset_path}")"
  if ! grep -q -F "${asset_basename}" PROVENANCE.md; then
    missing="${missing}${asset_path}"$'\n'
  fi
done <<< "${added_assets}"

if [ -n "${missing}" ]; then
  echo
  echo "[provenance-check] FAIL: these asset files have no matching row in PROVENANCE.md:"
  printf '%s' "${missing}" | sed 's/^/  - /'
  exit 1
fi

echo "[provenance-check] all new assets have provenance rows — OK."
exit 0
