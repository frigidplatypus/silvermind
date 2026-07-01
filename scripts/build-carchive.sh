#!/usr/bin/env bash
set -euo pipefail

# Builds sbtask as a C static library for iOS.
# Requires: Go, Xcode with command line tools.
#
# Usage: ./build-carchive.sh [iphoneos|iphonesimulator]
#
# Output: ios/sbtask-carchive/libsbtask.a and libsbtask.h

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SBTASK_SRC="${SBTASK_SRC:-$(cd "${REPO_ROOT}/../sbtask" && pwd)}"
OUTPUT_DIR="${REPO_ROOT}/ios/sbtask-carchive"

TARGET="${1:-iphonesimulator}"

case "${TARGET}" in
iphoneos)
	SDK="iphoneos"
	MINOS="15.0"
	;;
iphonesimulator)
	SDK="iphonesimulator"
	MINOS="15.0"
	;;
*)
	echo "Usage: $0 [iphoneos|iphonesimulator]"
	exit 1
	;;
esac

echo "[prowl] Building sbtask C-archive for ${TARGET} arm64..."

mkdir -p "${OUTPUT_DIR}"

export CC="$(xcrun --sdk ${SDK} --find clang) -isysroot $(xcrun --sdk ${SDK} --show-sdk-path) -arch arm64 -mios-version-min=${MINOS}"
export CXX="$(xcrun --sdk ${SDK} --find clang++) -isysroot $(xcrun --sdk ${SDK} --show-sdk-path) -arch arm64 -mios-version-min=${MINOS}"
export CGO_ENABLED=1
export GOOS=ios
export GOARCH=arm64

cd "${SBTASK_SRC}"

go build -buildmode=c-archive -o "${OUTPUT_DIR}/libsbtask.a" ./carchive

echo "[prowl] Built: ${OUTPUT_DIR}/libsbtask.a"
echo "[prowl] Header: ${OUTPUT_DIR}/libsbtask.h"

ls -la "${OUTPUT_DIR}/"
