#!/usr/bin/env bash
set -euo pipefail

SBTASK_BINARY="${SBTASK_SOURCE:-ios/App/sbtask}"
DEST_DIR="ios/App"

if [ ! -f "${SBTASK_BINARY}" ]; then
  echo "[prowl] sbtask binary not found at ${SBTASK_BINARY}. Run scripts/fetch-sbtask.sh first."
  exit 1
fi

echo "[prowl] Installing sbtask binary into iOS bundle..."
mkdir -p "${DEST_DIR}"
cp "${SBTASK_BINARY}" "${DEST_DIR}/sbtask"
chmod +x "${DEST_DIR}/sbtask"

echo "[prowl] sbtask binary installed to ${DEST_DIR}/sbtask"
echo "[prowl] Ready for Capacitor iOS build."
