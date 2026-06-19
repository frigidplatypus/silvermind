#!/usr/bin/env bash
set -euo pipefail

SBTASK_REMOTE="git@git.fluffy-rooster.ts.net:FRGD/sbtask.git"
SBTASK_OUTPUT="${SBTASK_OUTPUT:-ios/App/sbtask}"
WORK_DIR="$(mktemp -d)"

echo "[prowl] Fetching sbtask latest release from ${SBTASK_REMOTE}..."

# Clone the repo shallow
git clone --depth 1 "${SBTASK_REMOTE}" "${WORK_DIR}/sbtask" 2>&1

cd "${WORK_DIR}/sbtask"

# Get the latest release tag
LATEST_TAG=$(git tag --sort=-v:refname | head -1)
if [ -z "${LATEST_TAG}" ]; then
  echo "[prowl] No release tags found, using HEAD"
  LATEST_TAG="HEAD"
else
  echo "[prowl] Latest release tag: ${LATEST_TAG}"
  git checkout "${LATEST_TAG}" 2>&1
fi

# Cross-compile for iOS arm64 (darwin)
echo "[prowl] Building sbtask for iOS arm64 (CGO_ENABLED=0)..."
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o "${WORK_DIR}/sbtask-binary" . 2>&1

# Copy to output location
mkdir -p "$(dirname "${SBTASK_OUTPUT}")"
cp "${WORK_DIR}/sbtask-binary" "${SBTASK_OUTPUT}"
chmod +x "${SBTASK_OUTPUT}"

echo "[prowl] sbtask binary written to ${SBTASK_OUTPUT}"

# Cleanup
rm -rf "${WORK_DIR}"
