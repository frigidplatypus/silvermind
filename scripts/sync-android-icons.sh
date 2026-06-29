#!/usr/bin/env bash
# Sync android-icons/ source → android/app/src/main/res/ (generated, gitignored)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/android-icons"
DST="${ROOT}/android/app/src/main/res"

if [ ! -d "${DST}" ]; then
  echo "[icons] android/ not found. Run 'pnpm cap:sync:android' first."
  exit 1
fi

echo "[icons] syncing Android launcher icons..."
cp "${SRC}"/mipmap-*/*.png "${DST}"/mipmap-mdpi/ 2>/dev/null || true
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  cp "${SRC}/mipmap-${d}/"*.png "${DST}/mipmap-${d}/"
done
cp "${SRC}/values/"*.xml "${DST}/values/"

# Remove old Capacitor default foreground vector (replaced by our PNGs)
rm -f "${DST}/drawable/ic_launcher_background.xml"
rm -f "${DST}/drawable-v24/ic_launcher_foreground.xml"

echo "[icons] done"
