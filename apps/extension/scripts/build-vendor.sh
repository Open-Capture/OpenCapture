#!/usr/bin/env bash
# Rebuilds @openapps/sdk and @openapps/ui from their real TypeScript
# source (vendor-src/) and refreshes the pre-built copies the extension
# actually imports at build time (vendor/{sdk,ui}/dist).
#
# Why two copies exist: vendor/{sdk,ui}/dist is committed so `npm ci &&
# npm run build` works without touching these packages at all — that's
# the fast path for everyday extension development. vendor-src/ is the
# real source those two packages are written in, kept so a reviewer (or
# anyone else) can verify vendor/{sdk,ui}/dist is actually what this
# script produces from it, not something pasted in by hand. Run this
# whenever vendor-src/ changes; nothing else regenerates it automatically.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_SRC="$EXT_DIR/vendor-src"
VENDOR="$EXT_DIR/vendor"

for pkg in sdk ui; do
  echo "==> building @openapps/$pkg from source"
  (cd "$VENDOR_SRC/$pkg" && npm install && npm run build)
  rm -rf "$VENDOR/$pkg/dist"
  cp -R "$VENDOR_SRC/$pkg/dist" "$VENDOR/$pkg/dist"
  echo "==> refreshed vendor/$pkg/dist"
done

echo "done — vendor/{sdk,ui}/dist now matches vendor-src/"
