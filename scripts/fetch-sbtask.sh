#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SBTASK_SRC="${SBTASK_SRC:-$(cd "${REPO_ROOT}/../sbtask" && pwd)}"

TARGET="${1:-ios}"

case "${TARGET}" in
ios)
	# iOS now uses gomobile xcframework (Sbtask.xcframework) instead of a raw binary.
	XCFRAMEWORK="${REPO_ROOT}/ios/sbtask-carchive/Sbtask.xcframework"
	if [ -d "${XCFRAMEWORK}" ]; then
		echo "[prowl] Sbtask.xcframework already exists at ${XCFRAMEWORK}"
	else
		echo "[prowl] Sbtask.xcframework not found. Build it with gomobile:"
		echo "  cd ${SBTASK_SRC} && gomobile bind -target=ios -o ${XCFRAMEWORK} ./mobile"
		exit 1
	fi
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
