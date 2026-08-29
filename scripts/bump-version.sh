#!/usr/bin/env bash
#
# Compute the next version and write it into every file that carries one.
#
#   scripts/bump-version.sh              # bump the patch component
#   scripts/bump-version.sh 0.4.0        # set an explicit version
#   DRY_RUN=1 scripts/bump-version.sh    # print the next version, change nothing
#
# Prints the resulting version to stdout (and nothing else, so it can be
# captured), with the human-readable progress on stderr.
#
# The version lives in three files that nothing keeps in sync — plus Cargo.lock,
# which records it a fourth time — so a hand bump that misses one produces a DMG
# named for one version containing a binary that reports another. That failure is
# silent: release.sh reads only tauri.conf.json. Hence a script.
#
# Run from anywhere; paths are resolved from the script's own location.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DRY_RUN="${DRY_RUN:-0}"

# Progress goes to stderr so stdout carries only the version string.
step() { printf "\033[1;34m==> %s\033[0m\n" "$*" >&2; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*" >&2; }
die()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

cd "$PROJECT_DIR"

TAURI_CONF="src-tauri/tauri.conf.json"
CARGO_TOML="src-tauri/Cargo.toml"
PACKAGE_JSON="package.json"

# ── read the current version ─────────────────────────────────────────────────
# tauri.conf.json is the source of truth: it is the file release.sh reads to
# name the DMG and the git tag.
CURRENT="$(sed -nE 's/.*"version": *"([^"]+)".*/\1/p' "$TAURI_CONF" | head -n1 || true)"
[[ -n "$CURRENT" ]] || die "No \"version\" in $TAURI_CONF"

# Every file must already agree, or we are bumping from an ambiguous base and
# the mismatch would survive into the release.
PKG_CURRENT="$(sed -nE 's/.*"version": *"([^"]+)".*/\1/p' "$PACKAGE_JSON" | head -n1 || true)"
CARGO_CURRENT="$(sed -nE 's/^version *= *"([^"]+)".*/\1/p' "$CARGO_TOML" | head -n1 || true)"
[[ "$PKG_CURRENT" == "$CURRENT" ]] \
  || die "$PACKAGE_JSON says $PKG_CURRENT but $TAURI_CONF says $CURRENT — reconcile them before bumping"
[[ "$CARGO_CURRENT" == "$CURRENT" ]] \
  || die "$CARGO_TOML says $CARGO_CURRENT but $TAURI_CONF says $CURRENT — reconcile them before bumping"

# ── decide the next version ──────────────────────────────────────────────────
if [[ $# -ge 1 && -n "${1:-}" ]]; then
  NEXT="$1"
  [[ "$NEXT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "'$NEXT' is not a MAJOR.MINOR.PATCH version"
else
  IFS='.' read -r MAJOR MINOR PATCH <<<"$CURRENT"
  # Every component stays a single digit: the version is an odometer that carries
  # at ten rather than a SemVer triple whose parts grow without bound. So
  # 0.1.9 → 0.2.0, and 0.9.9 → 1.0.0. Passing a version explicitly still skips
  # anywhere, which is how a release jumps ahead of the count.
  PATCH=$((PATCH + 1))
  if [[ "$PATCH" -ge 10 ]]; then
    PATCH=0
    MINOR=$((MINOR + 1))
  fi
  if [[ "$MINOR" -ge 10 ]]; then
    MINOR=0
    MAJOR=$((MAJOR + 1))
  fi
  NEXT="$MAJOR.$MINOR.$PATCH"
fi

[[ "$NEXT" != "$CURRENT" ]] || die "The next version equals the current one ($CURRENT)"
step "$CURRENT → $NEXT"

# A tag that already exists means this version shipped: the release would either
# fail or silently re-point at an older build.
if git rev-parse -q --verify "refs/tags/v$NEXT" >/dev/null 2>&1; then
  die "Tag v$NEXT already exists — this version has already been released"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  ok "Dry run — no files changed"
  echo "$NEXT"
  exit 0
fi

# ── write it everywhere ──────────────────────────────────────────────────────
# Each pattern is anchored to the one line that carries the version:
#   • the JSON files — the full `"version": "<current>"` pair. Both files hold
#     exactly one, asserted below rather than assumed, because a global replace
#     against a pattern that grew a second match would corrupt a dependency
#     pin silently. (GNU sed's `0,/re/` "first match only" address would avoid
#     the question, but BSD sed on macOS ignores it without erroring, which is
#     worse than not having it.)
#   • Cargo.toml — a bare `version = "…"` at the start of a line appears only in
#     [package]; dependency versions are indented or inline in a table.
# `sed -i ''` is the BSD/macOS spelling, which is what the macOS runners use.
step "Writing $NEXT into the version files"
for f in "$TAURI_CONF" "$PACKAGE_JSON"; do
  n="$(grep -c "\"version\": *\"$CURRENT\"" "$f" || true)"
  [[ "$n" == "1" ]] || die "$f has $n version fields matching $CURRENT, expected exactly 1"
  sed -i '' -E "s/\"version\": *\"$CURRENT\"/\"version\": \"$NEXT\"/" "$f"
done
sed -i '' -E "s/^version *= *\"$CURRENT\"/version = \"$NEXT\"/" "$CARGO_TOML"

# Cargo.lock records the crate's own version too. `cargo update -p` rewrites
# just that entry without touching any dependency, so the lockfile stays a
# one-line diff.
#
# --offline is tried first because nothing needs to be fetched to renumber a
# local package, and a warm checkout should not reach out to crates.io for a
# version bump. It cannot be the only attempt, though: --offline still needs a
# registry index to read, and a CI runner that has not run a cargo command yet
# has none — so the bump would fail there on a cold cache while working
# perfectly on any developer's Mac.
cargo update --manifest-path "$CARGO_TOML" --offline -p paintlet >/dev/null 2>&1 \
  || cargo update --manifest-path "$CARGO_TOML" -p paintlet >/dev/null 2>&1 \
  || die "cargo update could not renumber paintlet in Cargo.lock"

# ── verify every file landed ─────────────────────────────────────────────────
# The sed patterns are the fragile part of this script, so assert rather than
# assume. A missed file here is a mismatched release later.
step "Verifying"
for f in "$TAURI_CONF" "$PACKAGE_JSON" "$CARGO_TOML"; do
  grep -q "\"$NEXT\"" "$f" || die "$f was not updated to $NEXT"
done
grep -A1 '^name = "paintlet"$' src-tauri/Cargo.lock | grep -q "version = \"$NEXT\"" \
  || die "Cargo.lock still records the old version for paintlet"
ok "tauri.conf.json, package.json, Cargo.toml, Cargo.lock → $NEXT"

echo "$NEXT"
