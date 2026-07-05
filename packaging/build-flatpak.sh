#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="${REPO_ROOT}/desktop"
MANIFEST="${REPO_ROOT}/packaging/ai.silvermind.app.yml"
GO_VERSION="1.26.3"

case "$(uname -m)" in
  x86_64)  GO_ARCH="amd64" ;;
  aarch64) GO_ARCH="arm64" ;;
  *) echo "[flatpak] unsupported arch: $(uname -m)"; exit 1 ;;
esac

GO_TAR="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
GO_URL="https://go.dev/dl/${GO_TAR}"
GO_CACHE_DIR="${HOME}/.cache/silvermind-flatpak"
GO_CACHE="${GO_CACHE_DIR}/${GO_TAR}"

SENTRY_DSN="${SILVERMIND_SENTRY_DSN:-}"
SENTRY_LDFLAGS=""
if [ -n "${SENTRY_DSN}" ]; then
  SENTRY_LDFLAGS="-X main.sentryDsn=${SENTRY_DSN}"
  echo "[flatpak] sentry DSN provided — embedding in binary"
else
  echo "[flatpak] no SILVERMIND_SENTRY_DSN set — sentry disabled"
fi

if [ ! -f "${GO_CACHE}" ]; then
  echo "[flatpak] downloading Go ${GO_VERSION} for ${GO_ARCH}..."
  mkdir -p "${GO_CACHE_DIR}"
  curl -L -o "${GO_CACHE}" "${GO_URL}"
fi
cp "${GO_CACHE}" "${REPO_ROOT}/packaging/go.tar.gz"

echo "[flatpak] building frontend..."
pnpm install --frozen-lockfile --dir "${REPO_ROOT}"
pnpm --dir "${REPO_ROOT}" build:desktop

echo "[flatpak] vendoring Go dependencies..."
cd "${DESKTOP_DIR}"
go mod vendor
cd "${REPO_ROOT}"

if [ -n "${SENTRY_LDFLAGS}" ]; then
  sed -i.bak "s|-ldflags=\"-s -w\"|-ldflags=\"-s -w ${SENTRY_LDFLAGS}\"|" "${MANIFEST}"
  trap 'rm -f "${MANIFEST}.bak"' RETURN
fi

echo "[flatpak] building Flatpak..."
flatpak-builder --force-clean --repo=repo build-dir "${MANIFEST}"

if [ -f "${MANIFEST}.bak" ]; then
  mv "${MANIFEST}.bak" "${MANIFEST}"
fi

trap - RETURN

echo "[flatpak] exporting bundle..."
flatpak build-bundle repo silvermind.flatpak ai.silvermind.app
rm -f "${REPO_ROOT}/packaging/go.tar.gz"

echo ""
echo "[flatpak] Done! Install with:"
echo "  flatpak --user install silvermind.flatpak"
echo "  flatpak run ai.silvermind.app"
