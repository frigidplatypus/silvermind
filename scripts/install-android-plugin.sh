#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ANDROID_SRC="${REPO_ROOT}/android-plugin/src/main/java"
ANDROID_DEST="${REPO_ROOT}/android/app/src/main/java"

if [ ! -d "${ANDROID_DEST}/ai/silvermind/app" ]; then
    echo "[prowl] Android project not found at ${ANDROID_DEST}"
    echo "[prowl] Run 'cap add android' first"
    exit 1
fi

echo "[prowl] Copying Android plugin to ${ANDROID_DEST}..."
cp "${ANDROID_SRC}/ai/silvermind/app/SbtaskPlugin.java" "${ANDROID_DEST}/ai/silvermind/app/"
cp "${ANDROID_SRC}/ai/silvermind/app/SbtaskProcess.java" "${ANDROID_DEST}/ai/silvermind/app/"
echo "[prowl] Android plugin installed"
