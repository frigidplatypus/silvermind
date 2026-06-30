#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="${REPO_ROOT}/desktop"
MANIFEST="${REPO_ROOT}/packaging/ai.silvermind.app.yml"
GO_VERSION="1.26.3"

# Arch detection for Go tarball
case "$(uname -m)" in
  x86_64)  GO_ARCH="amd64" ;;
  aarch64) GO_ARCH="arm64" ;;
  *) echo "[flatpak] unsupported arch: $(uname -m)"; exit 1 ;;
esac

GO_TAR="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
GO_URL="https://go.dev/dl/${GO_TAR}"
GO_CACHE_DIR="${HOME}/.cache/silvermind-flatpak"
GO_CACHE="${GO_CACHE_DIR}/${GO_TAR}"

# Sentry DSN (optional — set SILVERMIND_SENTRY_DSN env var to embed in binary)
SENTRY_DSN="${SILVERMIND_SENTRY_DSN:-}"
SENTRY_LDFLAGS=""
if [ -n "${SENTRY_DSN}" ]; then
  SENTRY_LDFLAGS="-X main.sentryDsn=${SENTRY_DSN}"
  echo "[flatpak] sentry DSN provided — embedding in binary"
else
  echo "[flatpak] no SILVERMIND_SENTRY_DSN set — sentry disabled"
fi

# Download Go tarball to cache, then copy for flatpak-builder
if [ ! -f "${GO_CACHE}" ]; then
  echo "[flatpak] downloading Go ${GO_VERSION} for ${GO_ARCH}..."
  mkdir -p "${GO_CACHE_DIR}"
  curl -L -o "${GO_CACHE}" "${GO_URL}"
fi
cp "${GO_CACHE}" "${REPO_ROOT}/packaging/go.tar.gz"

# Build frontend (required before go build — embedded via embed.FS)
echo "[flatpak] building frontend..."
pnpm install --frozen-lockfile --dir "${REPO_ROOT}"
pnpm --dir "${REPO_ROOT}" build:desktop

# Vendor Go dependencies (required for -mod=vendor inside sandbox)
echo "[flatpak] vendoring Go dependencies..."

SBTASK_LOCAL="${SBTASK_LOCAL:-${REPO_ROOT}/../sbtask}"
if [ ! -d "${SBTASK_LOCAL}" ]; then
  echo "[flatpak] ERROR: sbtask checkout not found at ${SBTASK_LOCAL}"
  echo "[flatpak] Clone it: git clone git@forgejo:FRGD/sbtask.git ${SBTASK_LOCAL}"
  exit 1
fi

cleanup() {
  if [ -f "${DESKTOP_DIR}/go.mod.bak" ]; then
    mv "${DESKTOP_DIR}/go.mod.bak" "${DESKTOP_DIR}/go.mod"
  fi
  rm -rf "${DESKTOP_DIR}/vendor"
}
trap cleanup EXIT

sed -i.bak "s|^replace[[:space:]]\+github\.com/justin/sbtask[[:space:]]\+=>[[:space:]]\+.*|replace github.com/justin/sbtask => ${SBTASK_LOCAL}|" "${DESKTOP_DIR}/go.mod"

cd "${DESKTOP_DIR}"
GOFLAGS="-mod=mod" go mod vendor

# Keep patched go.mod — flatpak-builder needs it to match vendor/modules.txt for -mod=vendor
cd "${REPO_ROOT}"

# Inject Sentry DSN into manifest ldflags
if [ -n "${SENTRY_LDFLAGS}" ]; then
  sed -i.bak2 "s|-ldflags=\"-s -w\"|-ldflags=\"-s -w ${SENTRY_LDFLAGS}\"|" "${MANIFEST}"
  trap 'rm -f "${MANIFEST}.bak2"' RETURN
fi

# Build Flatpak
echo "[flatpak] building Flatpak..."
flatpak-builder --force-clean --repo=repo build-dir "${MANIFEST}"

# Restore manifest if patched
if [ -f "${MANIFEST}.bak2" ]; then
  mv "${MANIFEST}.bak2" "${MANIFEST}"
fi

# Now restore go.mod (trap also covers unexpected exit)
trap - EXIT
cleanup

# Export single-file bundle
echo "[flatpak] exporting bundle..."
flatpak build-bundle repo silvermind.flatpak ai.silvermind.app

# Clean up local Go tarball copy
rm -f "${REPO_ROOT}/packaging/go.tar.gz"

echo ""
echo "[flatpak] Done! Install with:"
echo "  flatpak --user install silvermind.flatpak"
echo "  flatpak run ai.silvermind.app"
