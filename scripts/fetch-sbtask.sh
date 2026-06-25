#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SBTASK_SRC="${REPO_ROOT}/backend"

TARGET="${1:-ios}"

case "${TARGET}" in
  ios)
    SBTASK_OUTPUT="${SBTASK_OUTPUT:-${REPO_ROOT}/ios/App/sbtask}"
    echo "[prowl] Building sbtask for iOS arm64 from ${SBTASK_SRC}..."
    cd "${SBTASK_SRC}"
    CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o "${SBTASK_OUTPUT}" ./cmd/sbtask
    ;;
  android)
    SBTASK_OUTPUT="${SBTASK_OUTPUT:-${REPO_ROOT}/android/app/src/main/jniLibs/arm64-v8a/libsbtask_exec.so}"
    mkdir -p "$(dirname "${SBTASK_OUTPUT}")"
    echo "[prowl] Building sbtask for Android arm64 (CGO) from ${SBTASK_SRC}..."

    # Use NDK cross-compiler so DNS resolution uses the system resolver (required for Tailscale MagicDNS etc.)
    NDK_DIR="${ANDROID_SDK_ROOT:-$ANDROID_HOME}/ndk/27.0.12077973"
    TOOLCHAIN="${NDK_DIR}/toolchains/llvm/prebuilt/linux-x86_64/bin"
    export CC="${TOOLCHAIN}/aarch64-linux-android21-clang"
    export CXX="${TOOLCHAIN}/aarch64-linux-android21-clang++"

    cd "${SBTASK_SRC}"
    CGO_ENABLED=1 GOOS=android GOARCH=arm64 go build -o "${SBTASK_OUTPUT}" ./cmd/sbtask
    ;;
  *)
    echo "Usage: $0 [ios|android]"
    exit 1
    ;;
esac

chmod +x "${SBTASK_OUTPUT}"
echo "[prowl] sbtask binary written to ${SBTASK_OUTPUT}"
