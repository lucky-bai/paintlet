#!/usr/bin/env bash
#
# Build → sign → notarize → staple → verify a distributable Paintlet DMG.
#
# Produces a UNIVERSAL (Apple Silicon + Intel) build, signs it with your
# Developer ID Application identity, submits the DMG to Apple's notary service,
# staples the ticket, and confirms Gatekeeper will trust it. Set PUBLISH=1 to
# also attach the DMG to a GitHub release.
#
#   scripts/release.sh            # build a signed, notarized DMG
#   PUBLISH=1 scripts/release.sh  # …and cut a GitHub release for it
#
# Run from anywhere; paths are resolved from the script's own location.
#
# One-time setup this assumes (see docs/RELEASING.md for the how-to):
#   • A "Developer ID Application" cert + private key in the login keychain.
#   • A notary keychain profile named "paintlet-notary".
#   • rustup targets aarch64-apple-darwin and x86_64-apple-darwin (auto-added
#     below if missing).
#
# The signing identity is auto-detected from the keychain, so no team ID or
# secret is ever hardcoded here or committed.

set -euo pipefail

# ── config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="Paintlet"
NOTARY_PROFILE="paintlet-notary"
TARGET="universal-apple-darwin"
PUBLISH="${PUBLISH:-0}"

# ── pretty output ────────────────────────────────────────────────────────────
step() { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

cd "$PROJECT_DIR"

# ── preflight ────────────────────────────────────────────────────────────────
step "Preflight checks"
command -v pnpm >/dev/null || die "pnpm not found"
xcrun --find notarytool >/dev/null 2>&1 || die "notarytool not found — install Xcode Command Line Tools"

# Auto-detect the Developer ID Application identity (the full quoted string).
IDENTITY="$(security find-identity -v -p codesigning \
  | grep -m1 'Developer ID Application' \
  | sed -E 's/.*"(.*)".*/\1/')"
[[ -n "$IDENTITY" ]] || die "No 'Developer ID Application' identity in the keychain — import Certificates.p12 first (docs/RELEASING.md §1)"
ok "Signing identity: $IDENTITY"

# Confirm the notary profile exists (a lightweight authenticated call).
xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1 \
  || die "Notary profile '$NOTARY_PROFILE' missing or unreachable — run notarytool store-credentials (docs/RELEASING.md §1)"
ok "Notary profile: $NOTARY_PROFILE"

VERSION="$(grep -m1 '"version"' src-tauri/tauri.conf.json | sed -E 's/.*"version": *"([^"]+)".*/\1/')"
ok "Version: $VERSION"

# ── rust targets ─────────────────────────────────────────────────────────────
step "Ensuring universal build targets"
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
ok "Targets ready"

# ── build + sign ─────────────────────────────────────────────────────────────
step "Cleaning old bundle artifacts"
rm -rf "src-tauri/target/$TARGET/release/bundle"
ok "Cleaned"

step "Building + signing $APP_NAME $VERSION ($TARGET)"
# Tauri's bundler runs `xattr -cr` on the .app to strip extended attributes.
# Ensure the SYSTEM xattr wins over any pyenv/conda shim on PATH: the Python
# `xattr` package (installed as a shim) has no -r flag and makes bundling fail
# with "failed to run xattr".
export PATH="/usr/bin:$PATH"
# Tauri signs the .app with hardened runtime using this identity during the build.
export APPLE_SIGNING_IDENTITY="$IDENTITY"
pnpm tauri build --target "$TARGET"
ok "Built + signed"

BUNDLE_DIR="src-tauri/target/$TARGET/release/bundle"
DMG="$(ls "$BUNDLE_DIR"/dmg/${APP_NAME}_*.dmg 2>/dev/null | head -n1 || true)"
APP="$BUNDLE_DIR/macos/$APP_NAME.app"
[[ -n "${DMG:-}" && -f "$DMG" ]] || die "No DMG produced in $BUNDLE_DIR/dmg"
ok "DMG: $DMG"

# ── verify signature before spending minutes on notarization ─────────────────
step "Verifying code signature"
codesign --verify --deep --strict --verbose=2 "$APP"
ok "Signature valid"

# ── notarize + staple ────────────────────────────────────────────────────────
step "Submitting to Apple notary service (usually 2–10 min)"
xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
ok "Notarized"

step "Stapling the ticket"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
ok "Stapled"

step "Gatekeeper assessment"
spctl --assess --type open --context context:primary-signature -v "$DMG"
ok "Trusted as Notarized Developer ID"

# ── optional: publish a GitHub release ───────────────────────────────────────
if [[ "$PUBLISH" == "1" ]]; then
  step "Publishing GitHub release v$VERSION"
  command -v gh >/dev/null || die "gh CLI not found"
  TAG="v$VERSION"
  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "$DMG" --clobber
  else
    gh release create "$TAG" "$DMG" --title "$APP_NAME $VERSION" --generate-notes
  fi
  ok "Release $TAG published"
fi

# ── summary ──────────────────────────────────────────────────────────────────
step "Done"
echo ""
echo "Distributable DMG:"
echo "  $PROJECT_DIR/$DMG"
echo ""
echo "Universal binary — runs native on Apple Silicon and Intel."
[[ "$PUBLISH" == "1" ]] || echo "Re-run with PUBLISH=1 to attach it to a GitHub release."
