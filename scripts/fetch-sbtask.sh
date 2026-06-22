#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SBTASK_SRC="${REPO_ROOT}/backend"
SBTASK_OUTPUT="${SBTASK_OUTPUT:-${REPO_ROOT}/ios/App/sbtask}"

echo "[prowl] Building sbtask for iOS arm64 from ${SBTASK_SRC}..."

cd "${SBTASK_SRC}"
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o "${SBTASK_OUTPUT}" ./cmd/sbtask

chmod +x "${SBTASK_OUTPUT}"
echo "[prowl] sbtask binary written to ${SBTASK_OUTPUT}"
