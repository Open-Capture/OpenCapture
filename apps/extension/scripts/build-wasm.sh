#!/usr/bin/env bash
# Builds crates/shot-core for wasm32-unknown-unknown and generates the
# wasm-bindgen JS/TS glue into src/wasm-gen/. Run before `vite build` (see
# package.json's `build` script) — Vite never touches Rust, it only copies
# the already-generated output as a static asset (scripts/copy-static.mjs).
set -euo pipefail

export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

# The repo lives on a shared VM mount, which produces spurious archive/GC
# errors when used as the cargo target dir directly (see
# opencapture/docs/build-environment.md). Build off-mount, then only the
# final .wasm crosses back onto the mount via wasm-bindgen's --out-dir.
: "${CARGO_TARGET_DIR:=/tmp/opencapture-target}"
export CARGO_TARGET_DIR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_DIR="$(dirname "$(dirname "$EXT_DIR")")"
OUT_DIR="$EXT_DIR/src/wasm-gen"

cargo build -p shot-core --target wasm32-unknown-unknown --profile wasm-release --manifest-path "$WORKSPACE_DIR/Cargo.toml"

wasm-bindgen \
  --target web \
  --out-dir "$OUT_DIR" \
  --out-name shot_core \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/wasm-release/shot_core.wasm"

if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -O3 -o "$OUT_DIR/shot_core_bg.wasm" "$OUT_DIR/shot_core_bg.wasm"
  echo "wasm-opt: optimized shot_core_bg.wasm"
else
  echo "wasm-opt not found on PATH — skipping (glue still works, just larger/slower than optimal)"
fi

echo "wasm build complete: $OUT_DIR"
