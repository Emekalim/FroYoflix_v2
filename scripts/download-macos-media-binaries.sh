#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/electron/resources/mac"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TARGET_DIR"

download() {
  local url="$1"
  local output="$2"
  curl -fsSL --retry 3 --retry-delay 2 -o "$output" "$url"
}

verify_sha256() {
  local expected="$1"
  local file="$2"
  local actual
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"

  if [[ "$actual" != "$expected" ]]; then
    echo "SHA256 mismatch for $file" >&2
    echo "Expected: $expected" >&2
    echo "Actual:   $actual" >&2
    exit 1
  fi
}

extract_binary() {
  local archive="$1"
  local binary_name="$2"
  local output="$3"
  unzip -p "$archive" "$binary_name" > "$output"
  chmod +x "$output"
}

# Pinned macOS ffmpeg/ffprobe binaries.
# Intel and Apple Silicon slices are downloaded separately and combined with lipo.
FFMPEG_X64_URL="https://www.osxexperts.net/ffmpeg80intel.zip"
FFMPEG_ARM64_URL="https://www.osxexperts.net/ffmpeg80arm.zip"
FFPROBE_X64_URL="https://www.osxexperts.net/ffprobe80intel.zip"
FFPROBE_ARM64_URL="https://www.osxexperts.net/ffprobe80arm.zip"

FFMPEG_X64_SHA256="df3f1e3facdc1ae0ad0bd898cdfb072fbc9641bf47b11f172844525a05db8d11"
FFMPEG_ARM64_SHA256="77d2c853f431318d55ec02676d9b2f185ebfdddb9f7677a251fbe453affe025a"
FFPROBE_X64_SHA256="5228e651e2bd67bb55819b27f6138351587b16d2b87446007bf35b7cf930d891"
FFPROBE_ARM64_SHA256="babf170e86bd6b0b2fefee5fa56f57721b0acb98ad2794b095d8030b02857dfe"

echo "Downloading macOS ffmpeg/ffprobe binaries..."

download "$FFMPEG_X64_URL" "$TMP_DIR/ffmpeg-x64.zip"
download "$FFMPEG_ARM64_URL" "$TMP_DIR/ffmpeg-arm64.zip"
download "$FFPROBE_X64_URL" "$TMP_DIR/ffprobe-x64.zip"
download "$FFPROBE_ARM64_URL" "$TMP_DIR/ffprobe-arm64.zip"

extract_binary "$TMP_DIR/ffmpeg-x64.zip" "ffmpeg" "$TMP_DIR/ffmpeg-x64"
extract_binary "$TMP_DIR/ffmpeg-arm64.zip" "ffmpeg" "$TMP_DIR/ffmpeg-arm64"
extract_binary "$TMP_DIR/ffprobe-x64.zip" "ffprobe" "$TMP_DIR/ffprobe-x64"
extract_binary "$TMP_DIR/ffprobe-arm64.zip" "ffprobe" "$TMP_DIR/ffprobe-arm64"

verify_sha256 "$FFMPEG_X64_SHA256" "$TMP_DIR/ffmpeg-x64"
verify_sha256 "$FFMPEG_ARM64_SHA256" "$TMP_DIR/ffmpeg-arm64"
verify_sha256 "$FFPROBE_X64_SHA256" "$TMP_DIR/ffprobe-x64"
verify_sha256 "$FFPROBE_ARM64_SHA256" "$TMP_DIR/ffprobe-arm64"

lipo -create -output "$TARGET_DIR/ffmpeg" "$TMP_DIR/ffmpeg-x64" "$TMP_DIR/ffmpeg-arm64"
lipo -create -output "$TARGET_DIR/ffprobe" "$TMP_DIR/ffprobe-x64" "$TMP_DIR/ffprobe-arm64"

chmod +x "$TARGET_DIR/ffmpeg" "$TARGET_DIR/ffprobe"
xattr -cr "$TARGET_DIR/ffmpeg" "$TARGET_DIR/ffprobe" || true

echo "Bundled macOS media binaries:"
file "$TARGET_DIR/ffmpeg"
file "$TARGET_DIR/ffprobe"
