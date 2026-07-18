# Releasing Paintlet

How to cut a distributable macOS build: a **universal** (Apple Silicon + Intel) `.dmg` that is code-signed with a Developer ID, notarized by Apple, and stapled, so it opens on any Mac (macOS 10.15+) with no Gatekeeper warning. Distribution is via GitHub Releases.

Most of this is automated by [`scripts/release.sh`](../scripts/release.sh). The one-time setup below has to happen first.

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

Set the same SemVer version in all three files:

- `src-tauri/tauri.conf.json` → `"version"`
- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`

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
  "src-tauri/target/universal-apple-darwin/release/bundle/dmg/Paintlet_X.Y.Z_universal.dmg" \
  --title "Paintlet X.Y.Z" --generate-notes
```

## 3. What the script does

In order, exiting on the first failure:

1. Auto-detects the Developer ID Application identity from the keychain (nothing hardcoded).
2. Confirms the `paintlet-notary` profile exists.
3. Adds the universal Rust targets if missing.
4. `pnpm tauri build --target universal-apple-darwin` — Tauri signs the app with the hardened runtime using that identity.
5. `codesign --verify` on the built `.app`.
6. `notarytool submit --wait` on the DMG (usually 2–10 min).
7. `stapler staple` + `stapler validate`.
8. `spctl --assess` — confirms Gatekeeper trusts it.
9. If `PUBLISH=1`, creates/updates the GitHub release and uploads the DMG.

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

## 6. CI (optional, later)

`tauri-apps/tauri-action` can build, sign, and notarize on tag push. It needs these repo secrets:

- `APPLE_CERTIFICATE` — base64 of the `.p12` (`base64 -i Certificates.p12 | pbcopy`)
- `APPLE_CERTIFICATE_PASSWORD` — the `.p12` export password
- `APPLE_SIGNING_IDENTITY` — `Developer ID Application: Bai Li (TEAMID)`
- `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID`
- `KEYCHAIN_PASSWORD` — any string, for the temporary CI keychain
