# Releasing Paintlet

How to cut a distributable macOS build: a **universal** (Apple Silicon + Intel) `.dmg` that is code-signed with a Developer ID, notarized by Apple, and stapled, so it opens on any Mac (macOS 10.15+) with no Gatekeeper warning. Distribution is via GitHub Releases.

There are two ways to cut one:

- **[The Release workflow](#6-releasing-from-github-actions)** — a manual button in the Actions tab that bumps the version, builds, notarizes, and publishes. This is the normal path.
- **[`scripts/release.sh`](../scripts/release.sh)** on your own Mac, which is what the workflow runs and remains the fallback when Actions is unavailable or you want the DMG without publishing.

The one-time setup below is a prerequisite for the local path, and its certificate and notary credentials are the same material the workflow needs as secrets.

Shipping to the **Mac App Store** is a separate track with different certificates, mandatory sandboxing, and no notarization step — see [`RELEASING-MAS.md`](RELEASING-MAS.md). The same workflow drives both, from the same commit, and either can be run without the other.

## 1. One-time setup

> **Paintlet's signing identity.** Releases are signed and notarized under **Elaine Ye's (Yinan Ye) Developer ID Application** certificate, Apple Team ID **`R3557XH9FY`**, shared from her Apple Developer account — there is no separate Bai Li Developer ID. Signed releases therefore show **"Yinan Ye"** as the verified developer in Gatekeeper. The credentials themselves (her Apple ID and an app-specific password) live only in the local login keychain as the `paintlet-notary` profile and are **never committed to this repo**. The identity name and Team ID above are not secret — they are embedded in every signed build and visible via `codesign -dv`. If you set up your own account instead, substitute your own values throughout.

### Apple Developer account + certificate

1. Enroll in the **Apple Developer Program** ($99/yr) at [developer.apple.com](https://developer.apple.com).
2. Create a **Developer ID Application** certificate — Xcode (Settings → Accounts → Manage Certificates → +) or [the portal](https://developer.apple.com/account/resources/certificates). This is the only cert type that works for notarized, outside-the-App-Store distribution; *Apple Development*, *Apple Distribution*, and *Mac Development* certs will not.
3. Export the certificate **with its private key** as a `.p12` from Keychain Access (right-click the cert → Export). Keep the password.

### Import the certificate into the login keychain

Double-click the `.p12` in Finder (Keychain Access prompts for the export password), or from the command line without putting the password in shell history:

```bash
read -s -p "p12 password: " PW; echo
security import ~/Desktop/Certificates.p12 \
  -k ~/Library/Keychains/login.keychain-db -P "$PW" -T /usr/bin/codesign
unset PW
```

Confirm it landed:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

You should see `Developer ID Application: Yinan Ye (R3557XH9FY)` (or, for your own account, `Developer ID Application: <name> (<TEAMID>)`). The value in parentheses is the Apple Team ID — you'll need it next.

If the certificate imports but `security find-identity -v -p codesigning` reports **0 valid identities**, the Apple Developer ID intermediate is missing from the keychain — install it once:

```bash
curl -O https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer
security import DeveloperIDG2CA.cer -k ~/Library/Keychains/login.keychain-db
```

Re-run `find-identity` and it should now report `1 valid identities found`.

### Store notary credentials

1. Create an **app-specific password** at [appleid.apple.com](https://appleid.apple.com) → Sign-In & Security → App-Specific Passwords.
2. Store it once in a named keychain profile the release script expects:

```bash
xcrun notarytool store-credentials paintlet-notary \
  --apple-id "<elaine's apple id>" \
  --team-id "R3557XH9FY" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

Use Elaine's Apple ID and an app-specific password generated from *her* account (the Team ID `R3557XH9FY` belongs to it). The password is saved securely in the keychain; you never type it again, and it is never written to this repo.

### Rust targets

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

The release script also adds these if missing.

## 2. Cutting a release

### Bump the version

The version is recorded in four places — `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` — and nothing keeps them in sync. `release.sh` reads only `tauri.conf.json`, so a hand bump that misses one produces a DMG named for one version containing a binary that reports another, with no error anywhere. Use the script:

```bash
scripts/bump-version.sh           # bump the patch component
scripts/bump-version.sh 0.4.0     # or set an explicit version
DRY_RUN=1 scripts/bump-version.sh # print the next version, change nothing
```

It refuses to run if the files disagree or if the target version already has a tag, and verifies every file afterwards.

**The version is an odometer, not a SemVer triple.** Every component stays a single digit and carries at ten: `0.1.9` → `0.2.0`, and `0.9.9` → `1.0.0`. Passing a version explicitly still skips anywhere, which is how a release jumps ahead of the count.

Then commit and push:

```bash
git commit -am "Release vX.Y.Z"
git push
```

### Build, sign, notarize

```bash
scripts/release.sh
```

This produces a notarized, stapled DMG at:

```
src-tauri/target/universal-apple-darwin/release/bundle/dmg/Paintlet_X.Y.Z_universal.dmg
```

### Publish to GitHub Releases

Either let the script do it (creates the `vX.Y.Z` tag and release, uploads the DMG):

```bash
PUBLISH=1 scripts/release.sh
```

…or publish manually:

```bash
gh release create vX.Y.Z \
  "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Paintlet-macOS.dmg" \
  --title "Paintlet X.Y.Z" --generate-notes
```

**Publish exactly one DMG, always under the fixed name `Paintlet-macOS.dmg`.** The landing page's download button points at `releases/latest/download/Paintlet-macOS.dmg`, which GitHub resolves to the newest release at request time — but only if the newest release carries an asset with that exact filename. Tauri's own output name changes every version, so the script copies it to the fixed name and publishes that.

Older versions are still individually reachable, because the tag lives in the URL rather than the filename: `releases/download/v0.1.2/Paintlet-macOS.dmg`. Publishing a second, versioned copy would add nothing and split each release's download count across two assets.

`v0.1.1` carries both names for historical reasons — its versioned URL was public before the fixed name existed, so it stays. Every release after it has one asset.

## 3. What the script does

In order, exiting on the first failure:

1. Auto-detects the Developer ID Application identity from the keychain (nothing hardcoded).
2. Resolves notary credentials and confirms they authenticate — the `paintlet-notary` keychain profile, or an App Store Connect API key if `NOTARY_KEY`, `NOTARY_KEY_ID` and `NOTARY_ISSUER` are all set. A CI runner has no login keychain to have stored a profile in, which is why the second form exists.
3. Adds the universal Rust targets if missing.
4. `pnpm tauri build --target universal-apple-darwin` — Tauri signs the app with the hardened runtime using that identity.
5. `codesign --verify` on the built `.app`.
6. `notarytool submit --wait` on the DMG (usually 2–10 min).
7. `stapler staple` + `stapler validate`.
8. `spctl --assess` — confirms Gatekeeper trusts it.
9. Copies the DMG to `Paintlet-macOS.dmg` and re-validates the staple. The copy happens after stapling because the ticket lives inside the DMG.
10. If `PUBLISH=1`, creates/updates the GitHub release and uploads that one DMG.

## 4. Verifying a build

To sanity-check the DMG (ideally on a Mac that has never run Paintlet):

```bash
spctl -a -t open --context context:primary-signature -v Paintlet_*.dmg   # → accepted, source=Notarized Developer ID
xcrun stapler validate Paintlet_*.dmg                                     # → The validate action worked!
```

Then mount it, drag Paintlet to Applications, and launch — there should be no "unidentified developer" prompt.

## 5. Troubleshooting

- **"The executable does not have the hardened runtime enabled"** — notarization requires it. Tauri applies it automatically when `APPLE_SIGNING_IDENTITY` is set, which the script does; make sure you build via the script, not a bare `pnpm tauri build`.
- **Notarization status `Invalid`** — pull the detailed log with the submission ID printed by `notarytool`:
  ```bash
  xcrun notarytool log <submission-id> --keychain-profile paintlet-notary
  ```
  Usual causes: an unsigned nested binary, missing hardened runtime, or a non–Developer ID certificate.
- **"No 'Developer ID Application' identity"** — the `.p12` imported the wrong certificate type. Re-export a *Developer ID Application* cert **with its private key**.
- **Gatekeeper blocks the app copied out of the DMG** — the DMG is stapled and the app is notarized, so it validates online on first launch; stapling the DMG is the standard for DMG distribution.
- **"failed to bundle project: failed to run xattr"** — a `pyenv`/`conda` shim is shadowing the system `xattr` with the Python `xattr` package, which lacks the `-r` flag Tauri's bundler needs. The release script prepends `/usr/bin` to `PATH` to force `/usr/bin/xattr`; if you build with a bare `pnpm tauri build`, prefix it the same way: `PATH="/usr/bin:$PATH" pnpm tauri build …`.

## 6. Releasing from GitHub Actions

[`.github/workflows/release.yml`](../.github/workflows/release.yml) ships **both** distribution tracks from one button in the **Actions** tab: the notarized DMG described above, and the sandboxed App Store package described in [`RELEASING-MAS.md`](RELEASING-MAS.md). It runs `scripts/bump-version.sh`, `scripts/release.sh` and `scripts/release-mas.sh` unchanged — the workflow's only job is to hand them credentials, so the local and CI paths cannot drift apart.

### Running it

**Actions → Release → Run workflow**, with three inputs:

- **`mode`** — `dry-run` (the default) builds, signs, notarizes, packages and validates without publishing, uploading or committing anything; the version bump is applied to the working tree and thrown away with the runner, and both artifacts are attached to the run. `publish` does the whole thing.
- **`tracks`** — `both` by default. `github-only` skips the store; `app-store-only` skips the DMG and, importantly, **reuses the committed version instead of bumping**, which is what makes it the right way to retry a failed upload.
- **`version`** — leave blank to bump the patch component; set it explicitly for a minor or major release.

A publish takes roughly an hour end to end: two universal builds, notarization, and then up to half an hour waiting on Apple to process the uploaded build before it can be submitted.

### Which branch to run from

**Publish from `main`.** A publish pushes its `Release vX.Y.Z` commit to whichever branch it ran from and tags that exact commit, so the tag always names what is inside the DMG.

Run it from a feature branch and that stops being tidy: the tag points at the branch commit, and a later squash-merge creates a *different* commit on main, so the released commit is never an ancestor of main and survives only because the tag holds it. The DMG also goes public before the code is on main. Nothing breaks, but `git describe` stops telling the truth.

`dry-run` is safe from any branch — it commits and publishes nothing.

A build failure leaves the branch bumped with nothing released, which costs a version number and nothing else: the next run bumps again from there.

### Who commits

The bump commit is authored and committed by `github-actions[bot]`, pushed with the built-in `GITHUB_TOKEN`, and unsigned. Commits pushed with that token deliberately do not trigger other workflows, so the `Release vX.Y.Z` commit gets no CI run of its own — harmless, since the same job runs the typecheck, build and unit tests immediately beforehand.

### Required secrets

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE_P12_BASE64` | The Developer ID Application `.p12`, base64-encoded: `base64 -i Certificates.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | The export password, shared by all three `.p12` files |
| `APPLE_DISTRIBUTION_P12_BASE64` | The Apple Distribution `.p12` — signs the App Store `.app` |
| `APPLE_INSTALLER_P12_BASE64` | The Mac Installer Distribution `.p12` — signs the `.pkg` |
| `MAS_PROVISIONING_PROFILE_BASE64` | The Mac App Store provisioning profile, base64-encoded |
| `NOTARY_API_KEY_BASE64` | The App Store Connect `AuthKey_<KEYID>.p8`, base64-encoded |
| `NOTARY_API_KEY_ID` | The key ID (the `<KEYID>` in that filename) |
| `NOTARY_API_ISSUER` | The issuer UUID from App Store Connect |

One App Store Connect API key covers everything: notarization needs no particular role beyond access to the team, and the same key creates versions and submits for review. It is staged into `private_keys/` inside the workspace, which is where `altool` and `scripts/asc.mjs` both look by convention, and passed to `notarytool` by path.

There is no `KEYCHAIN_PASSWORD` secret: the workflow generates a random one per run for a throwaway keychain that it deletes on the way out, so nothing about it needs to outlive the job.

The provisioning profile is the only credential with an expiry date — **2027-08-11**. The workflow checks it before building and fails immediately if it has lapsed, warning a month ahead.

### What it does not do

Edit the store listing. Screenshots, description, keywords and pricing carry forward from the previous version untouched; the automation writes only the "What's New" text. Apple also reviews every version, updates included, and there is no way around that — see [`RELEASING-MAS.md`](RELEASING-MAS.md) §7.

### A note on whose credentials these are

The certificate and the API key belong to Elaine's Apple Developer account (§1). Storing them as Actions secrets on a **public** repository is safe from fork pull requests — GitHub withholds secrets from those, provided no workflow here ever uses `pull_request_target` — but anyone who can push a branch to this repo can read them out through a workflow. Today that is one person. It is still her signing identity, so treat adding these secrets as a decision to make with her rather than a configuration step.
