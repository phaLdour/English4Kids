#!/usr/bin/env bash
# Uploads `apps/web/.next` source maps to Sentry under the current git
# SHA (or `$NEXT_PUBLIC_E4K_RELEASE` if set). Intended for local
# operator use; CI runs the equivalent action in
# `.github/workflows/ci.yml` (`sentry-sourcemaps` job).
#
# Prereqs (any one of):
#   - `.sentryclirc` filled in at the repo root (see
#     `.sentryclirc.template`), OR
#   - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` exported in
#     the current shell.
#
# Run after `pnpm --filter @e4k/web build`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${WEB_DIR}/../.." && pwd)"

cd "${WEB_DIR}"

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]] && [[ ! -f "${REPO_ROOT}/.sentryclirc" ]]; then
  echo "[upload-sourcemaps] Sentry not configured."
  echo "                    Set SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT,"
  echo "                    or copy .sentryclirc.template to .sentryclirc and fill it in."
  echo "                    Skipping upload (exit 0)."
  exit 0
fi

if [[ ! -d "${WEB_DIR}/.next" ]]; then
  echo "[upload-sourcemaps] apps/web/.next missing — build the app first:"
  echo "                    pnpm --filter @e4k/web build"
  exit 1
fi

RELEASE="${NEXT_PUBLIC_E4K_RELEASE:-$(git -C "${REPO_ROOT}" rev-parse --short HEAD)}"

echo "[upload-sourcemaps] release: ${RELEASE}"
echo "[upload-sourcemaps] source:  ${WEB_DIR}/.next"

npx --yes @sentry/cli releases new "${RELEASE}"
npx --yes @sentry/cli releases files "${RELEASE}" \
  upload-sourcemaps .next \
  --url-prefix '~/_next' \
  --validate
npx --yes @sentry/cli releases finalize "${RELEASE}"

echo "[upload-sourcemaps] done — release ${RELEASE} registered, maps uploaded."
