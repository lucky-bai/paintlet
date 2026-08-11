# Releasing Paintlet to the Mac App Store

How to ship Paintlet through the Mac App Store: a **sandboxed**, **universal** (Apple Silicon + Intel) build, signed for distribution, wrapped in a signed `.pkg`, and uploaded to App Store Connect.

This is a **second, independent distribution track**, not a replacement for the DMG. Both can ship from the same commit. [`docs/RELEASING.md`](RELEASING.md) still governs the Developer ID DMG on GitHub Releases, and nothing in this document changes it.

|                   | DMG ([`release.sh`](../scripts/release.sh)) | App Store ([`release-mas.sh`](../scripts/release-mas.sh)) |
| ----------------- | ------------------------------------------- | --------------------------------------------------------- |
| app certificate   | Developer ID Application                    | Apple Distribution                                        |
| installer cert    | —                                           | Mac Installer Distribution                                |
| provisioning      | —                                           | `embedded.provisionprofile`                               |
| sandbox           | no                                          | yes, mandatory                                            |
| notarization      | yes, via `notarytool`                       | no — Apple does it server-side                            |
| artifact          | stapled `.dmg`                              | signed `.pkg`                                             |
| distribution      | GitHub Releases                             | App Store Connect → review → store                        |

Most of the mechanics are automated by [`scripts/release-mas.sh`](../scripts/release-mas.sh). The one-time setup below has to happen first.

## 0. The publishing account

Paintlet ships under **Elaine Ye's (Yinan Ye) Apple Developer account**, Apple Team ID **`R3557XH9FY`** — the same account the Developer ID DMG signs under. Every certificate, identifier, and profile below belongs to that team.

Two consequences worth knowing up front:

- **The store listing names her as the seller.** Unlike a DMG, where the signing identity only surfaces in Gatekeeper, the App Store shows the account holder publicly and permanently.
- **Everything below is done signed in as her Apple ID**, as the Account Holder — the certificates, the App ID, the provisioning profile, the API key, and the App Store Connect listing. There is no separate team member to invite. Expect two-factor prompts to land on her devices, so the initial setup is easiest done together in one sitting.

If the account ever changes, update the team ID in **both** keys of [`src-tauri/Entitlements.plist`](../src-tauri/Entitlements.plist). The release script cross-checks them against the signing certificate and refuses to build on a mismatch, so a stale value fails immediately rather than as an opaque rejection after upload.

## 1. One-time setup

### Register the App ID

At [developer.apple.com → Identifiers](https://developer.apple.com/account/resources/identifiers), register an **explicit** App ID (not a wildcard) matching `identifier` in `tauri.conf.json`:

```
io.efficientnlp.paintlet
```

Paintlet needs no additional capabilities enabled — no iCloud, no push, no App Groups.

### Certificates

A **Developer ID Application certificate does not work for the App Store.** You need two new certificates, both created at [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates) and imported into the login keychain with their private keys (same `.p12` export/import dance as `RELEASING.md` §1):

1. **Apple Distribution** — signs the `.app`. Older accounts may show this as *3rd Party Mac Developer Application*; the release script accepts either name.
2. **Mac Installer Distribution** — signs the `.pkg`. Older name: *3rd Party Mac Developer Installer*.

Confirm both landed:

```bash
security find-identity -v -p codesigning | grep -E 'Apple Distribution|3rd Party Mac Developer Application'
security find-certificate -a -c 'Mac Installer Distribution' -Z | grep alis
```

### Provisioning profile

Create a **Mac App Store** distribution profile for `io.efficientnlp.paintlet` at [developer.apple.com → Profiles](https://developer.apple.com/account/resources/profiles), download it, and save it as:

```
src-tauri/Paintlet_MAS.provisionprofile
```

It is gitignored on purpose. The profile holds no private key, but it is tied to one Apple account and **expires yearly** — a stale committed copy would be a build failure waiting to happen. Re-download it when it expires.

### App Store Connect API key

Create an API key under [App Store Connect → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api) with the **App Manager** role (Admin also works). Save the downloaded `AuthKey_<KEYID>.p8` to `~/.appstoreconnect/private_keys/` — the upload tools find it by convention, so the path matters. It downloads exactly once. Then export the two non-secret identifiers, which the release script reads:

```bash
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

An API key is preferred over an Apple ID plus app-specific password: it is scoped, revocable, and works unattended in CI. It also decouples uploads from the account holder — once the key exists, `release-mas.sh` uploads without anyone signing in or clearing a two-factor prompt. Only listing edits and review submission still need the web session.

To confirm the key authenticates before relying on it, ask the API who you are:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer <jwt>" \
  'https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=io.efficientnlp.paintlet'
```

The JWT has to be an ES256 assertion signed with the `.p8`, so this is easier from a script than by hand — but a `200` proves the key ID, issuer ID and key file all agree, which is worth knowing before a slow build.

### An upload tool

**Neither uploader ships with the Command Line Tools.** `altool` comes only with full Xcode; `iTMSTransporter` comes with Xcode or with Apple's standalone **Transporter** app. This surprises people because `notarytool` *is* in the CLT — so a Mac that happily notarizes a Developer ID DMG can still be unable to upload to the App Store.

Install **[Transporter](https://apps.apple.com/us/app/transporter/id1450874784)** from the Mac App Store. It is a few hundred MB against Xcode's 10+ GB, and it bundles `iTMSTransporter` at:

```
/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter
```

`release-mas.sh` detects whichever is present, prefers `altool`, and refuses to start an `UPLOAD=1` run if neither exists. Failing that check costs a second; discovering it after a full universal build costs several minutes.

Transporter can also be used by hand: drag the `.pkg` onto its window. The script path is preferred because it validates first and keeps the credentials out of a GUI login.

### Create the app record

In [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**, with platform **macOS**, the bundle ID registered above, and any SKU. Accept the **Free Applications** agreement when prompted — a free app needs no banking or tax forms.

## 2. Cutting a build

Bump the build number in [`src-tauri/tauri.appstore.conf.json`](../src-tauri/tauri.appstore.conf.json) → `bundle.macOS.bundleVersion`. This is separate from the SemVer in `tauri.conf.json` by design: the App Store permanently refuses any `CFBundleVersion` it has already seen for this bundle ID, so **every upload attempt needs a fresh number**, including re-uploads after a rejection. The marketing version only moves for real releases.

```bash
scripts/release-mas.sh            # build, sign, package, validate
UPLOAD=1 scripts/release-mas.sh   # …and upload to App Store Connect
```

The signed package lands at:

```
src-tauri/target/universal-apple-darwin/release/bundle/macos/Paintlet_X.Y.Z.pkg
```

After a successful upload the build takes 10–30 minutes to finish processing before it can be selected in App Store Connect. Then fill in the listing (§4) and submit for review.

## 3. What the script does

In order, exiting on the first failure, and doing every cheap check before the slow build:

1. Refuses to continue if `tauri-plugin-updater` ever appears in the dependencies — App Store apps may not download and execute code (guideline 2.5.2); the store handles updates.
2. Auto-detects the Apple Distribution and Mac Installer Distribution identities from the keychain (nothing hardcoded).
3. Cross-checks the certificate's team ID against `com.apple.developer.team-identifier` and `com.apple.application-identifier` in `Entitlements.plist`. A team mismatch is the most common cause of a post-upload "Invalid Signature" rejection, and it is free to catch here.
4. Confirms the provisioning profile exists and mentions the right bundle ID.
5. Verifies the App Store Connect credentials **before** spending minutes compiling, if `UPLOAD=1`.
6. Builds `--bundles app --target universal-apple-darwin` with `tauri.appstore.conf.json` merged in, signing with the distribution identity and the sandbox entitlements.
7. Asserts the four things the store rejects silently: the **app-sandbox entitlement is actually in the signature**, `embedded.provisionprofile` **is in the bundle**, `LSApplicationCategoryType` **is set**, and `CFBundleVersion` **matches** what was configured.
8. `productbuild --sign` to produce the `.pkg`, then `pkgutil --check-signature` to verify it.
9. Validates the package with whichever upload tool is installed, and with `UPLOAD=1`, uploads it. `altool --validate-app` / `--upload-app`, or `iTMSTransporter -m verify` / `-m upload` — the two take the same credentials but spell every other flag differently.

## 4. The listing

### Metadata: where the trademark line actually falls

Two guidelines govern this, and both are narrower than they first appear:

- **4.1(c):** "You cannot use another developer's icon, brand, or product name in your app's **icon or name**, without approval from the developer."
- **5.2.1:** don't use third-party trademarks without permission, and no "misleading, false, or copycat representations, names, or metadata in your app **bundle or developer name**."

Neither forbids *referring* to MS Paint in the description. Both squarely forbid it in the **name and icon**. (Guideline 5.2.5 is sometimes cited here but is irrelevant — it covers Apple's own products and interfaces.)

The rule of thumb that follows: **compare freely in the description, never in the name.**

So:

- **Name:** `Paintlet` — nothing else. Not "Paintlet - MS Paint for Mac".
- **Subtitle:** `Simple raster image editor` *(30 char limit)*
- **Keywords:** `paint, draw, drawing, bitmap, raster, pixel, sketch, image editor, canvas` *(100 char limit)*. Leave the trademark out here too. A keyword is not referential use — it is search interception — so it carries the risk of a description mention without the benefit.
- **Description:** the MS Paint comparison belongs here, phrased as a comparison rather than a claim of identity or endorsement. Something like: *"Paintlet is a small raster image editor for macOS, similar in spirit to MS Paint and modelled on the layout of Windows 11's Paint."* Then the tool list — pencil, brush, shapes, flood fill, text, selections, resize, crop, flip, rotate — and what it is not: no subscription, no account, no telemetry, and makes no network requests. Say "makes no network requests", not "no network access" — see §5 for why the distinction matters.
- **Disclaimer:** close the description with an explicit non-affiliation line — *"Not affiliated with or endorsed by Microsoft. Microsoft Paint and Windows are trademarks of Microsoft Corporation."*

Also confirm every bundled icon and cursor is original artwork. Reproducing MS Paint's 20-color palette is fine — those are just RGB values — but traced or copied icon art is both a rejection under 4.1(c) and a real legal exposure.

Enforcement is not perfectly consistent, so treat the description mention as low risk rather than zero risk. If it does draw a rejection, the fix is a one-line metadata edit, not a rebuild.

### Required assets and answers

- **Screenshots** at exactly 1280×800, 1440×900, 2560×1600, or 2880×1800 — all 16:10. The landing page captures in `site/assets/` are 2496×1886 and 2600×1892, roughly 4:3, so they will be refused and cannot simply be scaled. Re-capture with the window at 1440×900 on a Retina display for a 2880×1800 result.
- **Privacy policy URL:** <https://lucky-bai.github.io/paintlet/privacy.html> — required even for a free app that collects nothing.
- **App Privacy questionnaire:** "Data Not Collected" across the board. Accurate, and the fastest path through review.
- **Age rating:** no objectionable content in any category.
- **Price:** Free.
- **Export compliance:** already answered statically by `ITSAppUsesNonExemptEncryption` in [`src-tauri/Info.plist`](../src-tauri/Info.plist), so review will not ask per upload.

### Review notes worth pre-empting

Paintlet is a WebView-based app, so expect possible pushback under guideline 4.2 (minimum functionality / repackaged website). The answer, worth stating in the review notes, is that it is not a wrapped website: it ships a native menu bar, a native `NSSavePanel` with a real format popup, native About and dialog windows, AppKit appearance integration, and it works entirely offline with no server component.

## 5. Sandbox notes

Paintlet needs a small entitlement set — no printing, no camera, no location, no recents — because of how it already does file I/O. `read_image_file` and `write_image_file` in `src-tauri/src/lib.rs` call `std::fs` on paths that came back from a native panel, and `save_panel.rs` drives `NSSavePanel` directly. The panel is the sandbox's Powerbox: choosing a file grants this process an extension for that exact path, and `std::fs` inherits it. So for file access, `com.apple.security.files.user-selected.read-write` is the whole story.

### Why a network entitlement is needed anyway

`com.apple.security.network.client` is required for the window to render at all, even though Paintlet makes no network requests. WKWebView runs its networking in a separate XPC service, and under App Sandbox that service cannot initialise without the entitlement — even when every asset is local and served over Tauri's custom scheme. The web content process dies silently and the window opens completely blank, with nothing in the system log to explain it.

This was verified in both directions on an already-created container, so it is not a first-launch artefact: two entitlements renders nothing, adding the third and changing nothing else renders correctly.

The entitlement *permits* outbound connections; it does not create any. There is still no network code in the app. But it means user-facing copy must be worded carefully: **"makes no network requests"** is accurate and defensible, **"no network access"** contradicts an entitlement a curious reviewer can read in one command. Keep the App Store description and `site/privacy.html` on the right side of that line.

Two things to watch:

- **Test open and save on a sandboxed build before uploading.** Nothing else in the app touches the filesystem, but this is the one behaviour the sandbox can break.
- **A recents menu would need more.** Reopening a file across launches from a stored path string will be denied. That feature would require `com.apple.security.files.bookmarks.app-scope` plus real security-scoped bookmarks — plan for it before building the UI, not after.

`NSUserDefaults` (used to suppress the injected Edit-menu items) is container-scoped and works unchanged under the sandbox.

## 6. Troubleshooting

- **"No 'Apple Distribution' identity in the keychain"** — you have a Developer ID cert, which the App Store will not accept. Create an Apple Distribution certificate (§1).
- **"The signed app has NO app-sandbox entitlement"** — the overlay config was not merged. The script passes it as an absolute path; if you built by hand, make sure `--config` points at `src-tauri/tauri.appstore.conf.json`.
- **`ITMS-90283: Invalid Provisioning Profile`** — the profile is expired, is for the wrong bundle ID, or belongs to a different team than the signing certificate.
- **`ITMS-90186: Invalid Pre-Release Train`** or a duplicate-version complaint — the `CFBundleVersion` was already used. Bump `bundle.macOS.bundleVersion` and rebuild.
- **`ITMS-90238: Invalid Signature`** — usually a team mismatch or an unsigned nested binary. The script's team cross-check covers the first; for the second, re-run `codesign --verify --deep --strict`.
- **"failed to bundle project: failed to run xattr"** — a `pyenv`/`conda` shim is shadowing `/usr/bin/xattr`. The script prepends `/usr/bin` to `PATH`; a bare `pnpm tauri build` needs the same prefix.
- **`xcrun: error: unable to find utility "altool"`** — you have the Command Line Tools but not Xcode, and `altool` ships only with Xcode. Install Transporter (§1). The `.pkg` is already built and valid at this point; only the upload leg failed.
- **The upload tool cannot find the API key** — it searches `./private_keys`, `~/private_keys`, `~/.private_keys`, and `~/.appstoreconnect/private_keys` only. A path elsewhere will not be picked up.
- **An Apple ID on multiple teams** confuses the uploaders. Set `bundle.macOS.providerShortName` to disambiguate.
- **A window that opens completely blank** — the sandboxed build is missing `com.apple.security.network.client`. See §5.

## 7. CI (optional, later)

The same secrets as `RELEASING.md` §6, with the Developer ID material swapped for the distribution certificates, plus `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, and the base64 of the `.p8`. Worth setting up only once the manual path has succeeded end to end at least once — the first submission always surfaces something.
