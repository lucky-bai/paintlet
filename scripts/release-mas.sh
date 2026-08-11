#!/usr/bin/env bash
#
# Build → sandbox → sign → package → validate a Paintlet build for the MAC APP STORE.
#
# This is a SEPARATE track from scripts/release.sh, not a variation of it:
#
#                     release.sh (DMG)          release-mas.sh (App Store)
#   certificate       Developer ID Application  Apple Distribution
#   installer cert    —                         Mac Installer Distribution
#   provisioning      —                         embedded.provisionprofile
#   sandbox           no                         yes (Entitlements.plist)
#   notarization      yes, via notarytool        no — Apple does it server-side
#   artifact          stapled .dmg               .pkg uploaded to App Store Connect
#
# Both can ship from the same commit; they are not mutually exclusive. Nothing
# here touches release.sh or the DMG output.
#
#   scripts/release-mas.sh            # build, sign, package, validate
#   UPLOAD=1 scripts/release-mas.sh   # …and upload to App Store Connect
#
# Run from anywhere; paths are resolved from the script's own location.
#
# One-time setup this assumes (see docs/RELEASING-MAS.md for the how-to):
#   • An "Apple Distribution" cert + private key in the login keychain.
#   • A "Mac Installer Distribution" cert + private key in the login keychain.
#   • A Mac App Store provisioning profile at
#     src-tauri/Paintlet_MAS.provisionprofile (gitignored — download it).
#   • For UPLOAD=1: APPLE_API_KEY_ID and APPLE_API_ISSUER exported, and the
#     matching AuthKey_<id>.p8 in ~/.appstoreconnect/private_keys/.
#
# Signing identities are auto-detected from the keychain, so no secret is ever
# hardcoded here or committed.

set -euo pipefail

# ── config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="Paintlet"
TARGET="universal-apple-darwin"
UPLOAD="${UPLOAD:-0}"

# Absolute paths: the Tauri CLI resolves --config relative to the process CWD,
# and an absolute path removes any doubt about which file it picked up.
APPSTORE_CONF="$PROJECT_DIR/src-tauri/tauri.appstore.conf.json"
ENTITLEMENTS="$PROJECT_DIR/src-tauri/Entitlements.plist"
PROFILE="$PROJECT_DIR/src-tauri/${APP_NAME}_MAS.provisionprofile"
PLISTBUDDY="/usr/libexec/PlistBuddy"

# ── pretty output ────────────────────────────────────────────────────────────
step() { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m! %s\033[0m\n" "$*" >&2; }
die()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

cd "$PROJECT_DIR"

# ── preflight ────────────────────────────────────────────────────────────────
step "Preflight checks"
command -v pnpm >/dev/null || die "pnpm not found"
command -v productbuild >/dev/null || die "productbuild not found — install Xcode Command Line Tools"
[[ -f "$APPSTORE_CONF" ]] || die "Missing $APPSTORE_CONF"
[[ -f "$ENTITLEMENTS" ]] || die "Missing $ENTITLEMENTS"

# App Store Review guideline 2.5.2 forbids downloading and executing code, which
# rules out Tauri's updater. Paintlet has never had it; this guard makes sure a
# future "let's add auto-update" commit fails here rather than at review.
if grep -q 'tauri-plugin-updater' src-tauri/Cargo.toml package.json 2>/dev/null; then
  die "tauri-plugin-updater is present — App Store builds must not self-update (guideline 2.5.2). The store handles updates."
fi

# The .app signing cert. Apple renamed this type; accept either name so the
# script works whichever vintage of certificate is in the keychain.
#
# The trailing `|| true` matters: under `set -o pipefail`, grep finding no match
# fails the pipeline, and a failing command substitution would abort the script
# under `set -e` before the explanatory die below ever runs. An empty result has
# to reach the check to be reported. Same for every detection pipeline here.
APP_IDENTITY="$(security find-identity -v -p codesigning \
  | grep -m1 -E 'Apple Distribution|3rd Party Mac Developer Application' \
  | sed -E 's/.*"(.*)".*/\1/' || true)"
[[ -n "$APP_IDENTITY" ]] || die "No 'Apple Distribution' identity in the keychain — a Developer ID cert will NOT work for the App Store (docs/RELEASING-MAS.md §1)"
ok "App signing identity: $APP_IDENTITY"

# The .pkg signing cert. Installer certs are not code-signing identities, so
# they live in a different list — hence find-certificate rather than find-identity.
INSTALLER_IDENTITY="$(security find-certificate -a -c 'Mac Installer Distribution' -Z 2>/dev/null \
  | sed -nE 's/^ *"alis"<blob>="(.*)"$/\1/p' | head -n1 || true)"
if [[ -z "$INSTALLER_IDENTITY" ]]; then
  INSTALLER_IDENTITY="$(security find-certificate -a -c '3rd Party Mac Developer Installer' -Z 2>/dev/null \
    | sed -nE 's/^ *"alis"<blob>="(.*)"$/\1/p' | head -n1 || true)"
fi
[[ -n "$INSTALLER_IDENTITY" ]] || die "No 'Mac Installer Distribution' certificate in the keychain — needed to sign the .pkg (docs/RELEASING-MAS.md §1)"
ok "Installer identity: $INSTALLER_IDENTITY"

# ── cross-check the team ID ──────────────────────────────────────────────────
# A team mismatch between the certificate, the entitlements, and the profile is
# the single most common cause of an "Invalid Signature" rejection hours after
# upload. Catch it in two seconds instead.
step "Cross-checking Apple Team ID"
CERT_TEAM="$(sed -E 's/.*\(([A-Z0-9]{10})\)$/\1/' <<<"$APP_IDENTITY")"
ENT_TEAM="$("$PLISTBUDDY" -c 'Print :com.apple.developer.team-identifier' "$ENTITLEMENTS" 2>/dev/null || true)"
ENT_APPID="$("$PLISTBUDDY" -c 'Print :com.apple.application-identifier' "$ENTITLEMENTS" 2>/dev/null || true)"
BUNDLE_ID="$(sed -nE 's/.*"identifier": *"([^"]+)".*/\1/p' src-tauri/tauri.conf.json | head -n1 || true)"

[[ "$CERT_TEAM" == "$ENT_TEAM" ]] \
  || die "Team mismatch: certificate is team '$CERT_TEAM' but Entitlements.plist says '$ENT_TEAM'. Update both keys in src-tauri/Entitlements.plist."
[[ "$ENT_APPID" == "$ENT_TEAM.$BUNDLE_ID" ]] \
  || die "com.apple.application-identifier is '$ENT_APPID' but should be '$ENT_TEAM.$BUNDLE_ID'."
ok "Team $CERT_TEAM, app ID $ENT_APPID"

# ── provisioning profile ─────────────────────────────────────────────────────
step "Checking provisioning profile"
[[ -f "$PROFILE" ]] || die "Missing $PROFILE — create a 'Mac App Store' profile for $BUNDLE_ID at developer.apple.com and save it there (docs/RELEASING-MAS.md §1)"
# Profiles are CMS-signed plists, so the bundle ID is only readable after unwrapping.
if ! security cms -D -i "$PROFILE" 2>/dev/null | grep -q "$BUNDLE_ID"; then
  warn "Could not confirm $BUNDLE_ID inside the profile — double-check it is the right one before uploading."
else
  ok "Profile matches $BUNDLE_ID"
fi

VERSION="$(sed -nE 's/.*"version": *"([^"]+)".*/\1/p' src-tauri/tauri.conf.json | head -n1 || true)"
# CFBundleVersion comes from bundle.macOS.bundleVersion in the overlay, kept
# separate from the marketing version so a rejected build can be re-uploaded.
BUILD_NUMBER="$(sed -nE 's/.*"bundleVersion": *"([^"]+)".*/\1/p' "$APPSTORE_CONF" | head -n1 || true)"
[[ -n "$BUILD_NUMBER" ]] || die "No bundleVersion in $APPSTORE_CONF"
ok "Version $VERSION (build $BUILD_NUMBER)"

# ── the upload tool ──────────────────────────────────────────────────────────
# Neither uploader ships with the Command Line Tools. altool comes with full
# Xcode; iTMSTransporter comes with Xcode or with Apple's much smaller
# Transporter.app. A machine that can notarize a DMG can therefore still be
# unable to upload to the App Store, because notarytool IS in the CLT — so this
# has to be detected rather than assumed.
TRANSPORTER="/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter"
UPLOADER=""
if xcrun --find altool >/dev/null 2>&1; then
  UPLOADER="altool"
elif [[ -x "$TRANSPORTER" ]]; then
  UPLOADER="transporter"
fi

# ── upload credentials, checked BEFORE the slow build ────────────────────────
if [[ "$UPLOAD" == "1" ]]; then
  step "Checking App Store Connect credentials"
  [[ -n "${APPLE_API_KEY_ID:-}" ]] || die "UPLOAD=1 needs APPLE_API_KEY_ID exported"
  [[ -n "${APPLE_API_ISSUER:-}" ]] || die "UPLOAD=1 needs APPLE_API_ISSUER exported"
  # Both uploaders find the key by convention, not by path — hence the fixed
  # location rather than a flag.
  KEY_FILE="$HOME/.appstoreconnect/private_keys/AuthKey_${APPLE_API_KEY_ID}.p8"
  [[ -f "$KEY_FILE" ]] || warn "No key at $KEY_FILE — the uploaders also search ./private_keys and ~/private_keys"
  [[ -n "$UPLOADER" ]] || die "UPLOAD=1 but no upload tool found. Install Apple's Transporter from the Mac App Store (small), or full Xcode (large). The Command Line Tools alone ship neither altool nor iTMSTransporter (docs/RELEASING-MAS.md §1)."
  ok "API key $APPLE_API_KEY_ID, uploader: $UPLOADER"
fi

# ── rust targets ─────────────────────────────────────────────────────────────
step "Ensuring universal build targets"
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
ok "Targets ready"

# ── build + sign ─────────────────────────────────────────────────────────────
step "Cleaning old bundle artifacts"
rm -rf "src-tauri/target/$TARGET/release/bundle"
ok "Cleaned"

step "Building + signing $APP_NAME $VERSION for the App Store"
# Same pyenv/conda xattr shim workaround as release.sh — see the note there.
export PATH="/usr/bin:$PATH"
# Tauri signs the .app with this identity and applies the entitlements named in
# the overlay config. Only the `app` bundle: a .dmg would be meaningless here.
export APPLE_SIGNING_IDENTITY="$APP_IDENTITY"
pnpm tauri build --target "$TARGET" --bundles app --config "$APPSTORE_CONF"
ok "Built + signed"

APP="src-tauri/target/$TARGET/release/bundle/macos/$APP_NAME.app"
[[ -d "$APP" ]] || die "No .app produced at $APP"
PKG="src-tauri/target/$TARGET/release/bundle/macos/${APP_NAME}_${VERSION}.pkg"

# ── verify the things the store silently rejects ─────────────────────────────
# Each of these failures shows up as an emailed rejection an hour after upload,
# with a message that rarely names the real cause. Assert them locally instead.
step "Verifying the signed app"

codesign --verify --deep --strict --verbose=2 "$APP"
ok "Signature valid"

# 1. The sandbox actually made it into the signature. If the entitlements path
#    was wrong, the build still succeeds — it just ships unsandboxed and is
#    rejected on upload.
if codesign -d --entitlements - --xml "$APP" 2>/dev/null | grep -q 'com.apple.security.app-sandbox'; then
  ok "Sandbox entitlement present"
else
  die "The signed app has NO app-sandbox entitlement — check that $APPSTORE_CONF was actually merged"
fi

# 2. The provisioning profile is embedded where the store expects it.
[[ -f "$APP/Contents/embedded.provisionprofile" ]] \
  || die "embedded.provisionprofile missing from the bundle — check bundle.macOS.files in $APPSTORE_CONF"
ok "Provisioning profile embedded"

# 3. LSApplicationCategoryType is mandatory for the App Store. Tauri derives it
#    from bundle.category, so this fails only if that key is ever dropped.
CATEGORY="$("$PLISTBUDDY" -c 'Print :LSApplicationCategoryType' "$APP/Contents/Info.plist" 2>/dev/null || true)"
[[ -n "$CATEGORY" ]] || die "LSApplicationCategoryType missing — set bundle.category in tauri.conf.json"
ok "Category: $CATEGORY"

# 4. The build number landed. The App Store refuses any CFBundleVersion it has
#    already seen for this bundle ID, so a build that quietly reused the
#    previous number would be rejected after upload.
BUILT_BUILD="$("$PLISTBUDDY" -c 'Print :CFBundleVersion' "$APP/Contents/Info.plist" 2>/dev/null || true)"
[[ "$BUILT_BUILD" == "$BUILD_NUMBER" ]] \
  || die "CFBundleVersion in the built app is '$BUILT_BUILD', expected '$BUILD_NUMBER' — check bundle.macOS.bundleVersion in $APPSTORE_CONF"
ok "Build number: $BUILT_BUILD"

# ── package ──────────────────────────────────────────────────────────────────
# The App Store takes a signed installer package, not a .app or a .dmg. The
# /Applications argument is the install destination, not a local path.
step "Building the installer package"
rm -f "$PKG"
productbuild --sign "$INSTALLER_IDENTITY" --component "$APP" /Applications "$PKG"
pkgutil --check-signature "$PKG" >/dev/null || die "The .pkg signature did not verify"
ok "Signed package: $PKG"

# ── validate + upload ────────────────────────────────────────────────────────
# Both tools take the same two credentials but spell everything else
# differently: altool uses --apiKey/--apiIssuer with a mode flag, while
# iTMSTransporter uses -m verify/upload with -apiKey/-apiIssuer.
if [[ -z "${APPLE_API_KEY_ID:-}" || -z "${APPLE_API_ISSUER:-}" ]]; then
  warn "Skipping validation: APPLE_API_KEY_ID / APPLE_API_ISSUER not set"
  warn "You can still upload $PKG by hand by dragging it into Transporter.app."
elif [[ -z "$UPLOADER" ]]; then
  warn "Skipping validation: no upload tool installed"
  warn "Install Transporter from the Mac App Store, or drag $PKG into it by hand."
else
  step "Validating with App Store Connect ($UPLOADER)"
  case "$UPLOADER" in
    altool)
      xcrun altool --validate-app --type macos --file "$PKG" \
        --apiKey "$APPLE_API_KEY_ID" --apiIssuer "$APPLE_API_ISSUER"
      ;;
    transporter)
      "$TRANSPORTER" -m verify -assetFile "$PKG" \
        -apiKey "$APPLE_API_KEY_ID" -apiIssuer "$APPLE_API_ISSUER"
      ;;
  esac
  ok "Validated"

  if [[ "$UPLOAD" == "1" ]]; then
    step "Uploading to App Store Connect ($UPLOADER)"
    case "$UPLOADER" in
      altool)
        xcrun altool --upload-app --type macos --file "$PKG" \
          --apiKey "$APPLE_API_KEY_ID" --apiIssuer "$APPLE_API_ISSUER"
        ;;
      transporter)
        "$TRANSPORTER" -m upload -assetFile "$PKG" \
          -apiKey "$APPLE_API_KEY_ID" -apiIssuer "$APPLE_API_ISSUER"
        ;;
    esac
    ok "Uploaded — the build appears in App Store Connect after processing (10–30 min)"
  fi
fi

# ── summary ──────────────────────────────────────────────────────────────────
step "Done"
echo ""
echo "App Store package:"
echo "  $PROJECT_DIR/$PKG"
echo ""
echo "Sandboxed, universal, signed for distribution — version $VERSION, build $BUILD_NUMBER."
if [[ "$UPLOAD" == "1" ]]; then
  echo "Next: pick this build in App Store Connect, fill in the listing, and submit for review."
  echo "Bump bundle.macOS.bundleVersion in src-tauri/tauri.appstore.conf.json before the next upload."
else
  echo "Re-run with UPLOAD=1 to send it to App Store Connect."
fi
