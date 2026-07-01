#!/usr/bin/env bash
set -euo pipefail

# Obsolete: iOS now embeds sbtask via Sbtask.xcframework (gomobile).
# The xcframework is linked directly in the Xcode project.
echo "[prowl] install-binary.sh is obsolete. Sbtask.xcframework is used instead."
