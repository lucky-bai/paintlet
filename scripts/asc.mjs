#!/usr/bin/env node
//
// App Store Connect API client for the release scripts.
//
// Covers the three things that otherwise have to be done by hand in a browser
// after an upload: choosing a build number that Apple will accept, waiting for
// the uploaded build to finish processing, and creating + submitting the new
// App Store version for review.
//
//   node scripts/asc.mjs status
//   node scripts/asc.mjs next-build-number
//   node scripts/asc.mjs wait-for-build <buildNumber> [--timeout-min 45]
//   node scripts/asc.mjs submit <version> <buildNumber> [--notes-file <path>] [--dry-run]
//
// Credentials come from the environment, never from a file in this repo:
//   APPLE_API_KEY_ID     the ten-character key ID
//   APPLE_API_ISSUER     the issuer UUID from App Store Connect
//   APPLE_API_KEY_PATH   optional explicit path to AuthKey_<id>.p8; otherwise
//                        the conventional ~/.appstoreconnect/private_keys/ is
//                        searched, which is also where the upload tools look.
//
// No dependencies: Node 18+ has global fetch, and the ES256 assertion the API
// wants is a dozen lines of node:crypto.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.appstoreconnect.apple.com'
const PLATFORM = 'MAC_OS'

const PROJECT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// ── output ───────────────────────────────────────────────────────────────────
// Progress goes to stderr so a command's single meaningful value is the only
// thing on stdout and can be captured by the shell scripts that call this.
const step = (m) => console.error(`\x1b[1;34m==> ${m}\x1b[0m`)
const ok = (m) => console.error(`\x1b[1;32m✓ ${m}\x1b[0m`)
const warn = (m) => console.error(`\x1b[1;33m! ${m}\x1b[0m`)
const die = (m) => {
  console.error(`\x1b[1;31m✗ ${m}\x1b[0m`)
  process.exit(1)
}

// ── auth ─────────────────────────────────────────────────────────────────────
function keyPath(keyId) {
  if (process.env.APPLE_API_KEY_PATH) return process.env.APPLE_API_KEY_PATH
  // The same search order the upload tools use, so a key that works for
  // release-mas.sh's upload also works here without extra configuration.
  const candidates = [
    path.join(process.cwd(), 'private_keys'),
    path.join(os.homedir(), 'private_keys'),
    path.join(os.homedir(), '.private_keys'),
    path.join(os.homedir(), '.appstoreconnect', 'private_keys'),
  ].map((d) => path.join(d, `AuthKey_${keyId}.p8`))
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found) {
    die(
      `No AuthKey_${keyId}.p8 found. Looked in:\n  ${candidates.join('\n  ')}\n` +
        `Set APPLE_API_KEY_PATH to point at it directly.`,
    )
  }
  return found
}

// A fresh assertion per process. They are cheap, and capping the lifetime at
// ten minutes keeps a leaked token useless almost immediately. Apple rejects
// anything longer than 20 minutes anyway.
function makeToken() {
  const keyId = process.env.APPLE_API_KEY_ID || die('APPLE_API_KEY_ID is not set')
  const issuer = process.env.APPLE_API_ISSUER || die('APPLE_API_ISSUER is not set')
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' })
  const body = b64({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })
  // JWS carries the raw r||s pair; node's default DER encoding is rejected.
  const sig = crypto
    .createSign('SHA256')
    .update(`${head}.${body}`)
    .sign({ key: fs.readFileSync(keyPath(keyId), 'utf8'), dsaEncoding: 'ieee-p1363' })
    .toString('base64url')
  return `${head}.${body}.${sig}`
}

let TOKEN = null
async function api(method, endpoint, body) {
  TOKEN ??= makeToken()
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) {
    // Apple's errors are genuinely informative; surfacing them verbatim beats
    // any summary this script could invent.
    let detail = text
    try {
      detail = JSON.parse(text)
        .errors.map((e) => `${e.title}: ${e.detail}`)
        .join('\n  ')
    } catch {}
    die(`${method} ${endpoint} → ${res.status}\n  ${detail}`)
  }
  return text ? JSON.parse(text) : null
}

// ── project facts ────────────────────────────────────────────────────────────
const bundleId = () => {
  const conf = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'src-tauri/tauri.conf.json'), 'utf8'))
  return conf.identifier
}

async function getApp() {
  const id = bundleId()
  const res = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(id)}`)
  if (!res.data.length) die(`No app record in App Store Connect for ${id}`)
  return res.data[0]
}

// ── commands ─────────────────────────────────────────────────────────────────

// Every build number Apple has ever seen for this app, so the next one is
// max + 1. Deliberately not "current + 1" from the config file: a rejected or
// failed upload burns a number, and the file has no way of knowing that.
async function highestBuildNumber(appId) {
  const res = await api(
    'GET',
    `/v1/builds?filter[app]=${appId}&limit=200&fields[builds]=version`,
  )
  // Compared numerically, not lexicographically — "9" must not outrank "10".
  const numbers = res.data.map((b) => Number(b.attributes.version)).filter((n) => Number.isFinite(n))
  return numbers.length ? Math.max(...numbers) : 0
}

async function cmdNextBuildNumber() {
  const app = await getApp()
  const next = (await highestBuildNumber(app.id)) + 1
  console.error(`highest build so far: ${next - 1}`)
  console.log(String(next))
}

// Resolve a build number and record it in the App Store overlay config, so the
// file always states the number that was actually built and release-mas.sh's
// CFBundleVersion assertion still has something to check against.
//
// With an explicit number this makes no API call at all — which is what lets
// the release workflow choose the number once, commit it next to the version
// bump, and hand it to the build later without asking Apple twice.
async function cmdSetBuildNumber(explicit) {
  const build = explicit ?? String((await highestBuildNumber((await getApp()).id)) + 1)
  if (!/^\d+$/.test(build)) die(`'${build}' is not a build number`)

  const file = path.join(PROJECT_DIR, 'src-tauri/tauri.appstore.conf.json')
  const conf = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (conf.bundle?.macOS?.bundleVersion !== build) {
    conf.bundle.macOS.bundleVersion = build
    fs.writeFileSync(file, JSON.stringify(conf, null, 2) + '\n')
    console.error(`wrote bundleVersion ${build} into ${path.basename(file)}`)
  }
  console.log(build)
}

async function cmdStatus() {
  const app = await getApp()
  console.error(`App: ${app.attributes.name} (${app.id})`)
  const versions = await api(
    'GET',
    `/v1/apps/${app.id}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,createdDate`,
  )
  console.error('\nVersions:')
  for (const v of versions.data) {
    console.error(`  ${v.attributes.versionString.padEnd(8)} ${v.attributes.appStoreState}`)
  }
  const builds = await api(
    'GET',
    `/v1/builds?filter[app]=${app.id}&limit=5&sort=-uploadedDate&fields[builds]=version,processingState,uploadedDate`,
  )
  console.error('\nBuilds:')
  for (const b of builds.data) {
    console.error(
      `  build ${String(b.attributes.version).padEnd(6)} ${b.attributes.processingState.padEnd(12)} ${b.attributes.uploadedDate}`,
    )
  }
}

async function findBuild(appId, buildNumber) {
  const res = await api(
    'GET',
    `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(buildNumber)}` +
      `&fields[builds]=version,processingState,expired`,
  )
  return res.data[0] ?? null
}

// An upload is accepted long before the build is usable: Apple re-signs and
// scans it first, which takes 10–30 minutes and occasionally fails. Attaching a
// build that is still PROCESSING silently does nothing, so this has to block.
async function cmdWaitForBuild(buildNumber, timeoutMin) {
  const app = await getApp()
  const deadline = Date.now() + timeoutMin * 60_000
  step(`Waiting for build ${buildNumber} to finish processing (up to ${timeoutMin} min)`)
  for (;;) {
    const build = await findBuild(app.id, buildNumber)
    const state = build?.attributes.processingState ?? 'NOT_YET_VISIBLE'
    if (state === 'VALID') {
      ok(`Build ${buildNumber} is VALID`)
      return
    }
    if (state === 'FAILED' || state === 'INVALID') {
      die(`Build ${buildNumber} finished as ${state} — check the email from App Store Connect`)
    }
    if (Date.now() > deadline) {
      die(`Build ${buildNumber} was still ${state} after ${timeoutMin} min`)
    }
    console.error(`  ${state} …`)
    // A minute between polls: processing is measured in tens of minutes, and
    // the API is rate-limited per hour.
    await new Promise((r) => setTimeout(r, 60_000))
  }
}

// States an existing version can be in and still be edited and resubmitted.
// Anything else (WAITING_FOR_REVIEW, IN_REVIEW, READY_FOR_SALE) means a
// submission is already in flight or done, and this run should stop rather
// than interfere with it.
const EDITABLE = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
])

async function cmdSubmit(version, buildNumber, notes, dryRun) {
  const app = await getApp()

  const build = await findBuild(app.id, buildNumber)
  if (!build) die(`Build ${buildNumber} does not exist for this app — was the upload accepted?`)
  if (build.attributes.processingState !== 'VALID') {
    die(`Build ${buildNumber} is ${build.attributes.processingState}, not VALID — run wait-for-build first`)
  }

  // Reuse an existing editable version for this version string if there is one;
  // a rerun after a rejection must not try to create a duplicate.
  const existing = await api(
    'GET',
    `/v1/apps/${app.id}/appStoreVersions?filter[versionString]=${encodeURIComponent(version)}` +
      `&fields[appStoreVersions]=versionString,appStoreState`,
  )
  let versionId
  if (existing.data.length) {
    const state = existing.data[0].attributes.appStoreState
    if (!EDITABLE.has(state)) {
      die(`Version ${version} already exists in state ${state} — nothing to do, or handle it in the browser`)
    }
    versionId = existing.data[0].id
    ok(`Reusing existing version ${version} (${state})`)
  } else if (dryRun) {
    warn(`Dry run — would create version ${version}`)
    versionId = null
  } else {
    step(`Creating App Store version ${version}`)
    const created = await api('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: {
          platform: PLATFORM,
          versionString: version,
          // Ship as soon as review approves, with no second manual step. The
          // live 0.1.2 version is already set this way.
          releaseType: 'AFTER_APPROVAL',
        },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    })
    versionId = created.data.id
    ok(`Version ${version} created`)
  }

  if (dryRun) {
    warn(`Dry run — would attach build ${buildNumber}, set release notes, and submit for review`)
    return
  }

  step(`Attaching build ${buildNumber}`)
  await api('PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
    data: { type: 'builds', id: build.id },
  })
  ok('Build attached')

  // "What's New" is mandatory for every version after the first. Metadata
  // otherwise carries forward from the previous version untouched, which is
  // why nothing else needs to be sent here.
  step('Setting release notes')
  const locs = await api(
    'GET',
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`,
  )
  if (!locs.data.length) die('The version has no localizations — set up the listing in App Store Connect first')
  for (const loc of locs.data) {
    await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: loc.id,
        attributes: { whatsNew: notes },
      },
    })
    console.error(`  ${loc.attributes.locale}`)
  }
  ok('Release notes set')

  // Submission is a two-object dance: a submission, an item pointing at the
  // version, then a flip to submitted. An open submission may already exist
  // from an interrupted run, so reuse one rather than failing.
  step('Submitting for review')
  const open = await api(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW&fields[reviewSubmissions]=state`,
  )
  let submissionId
  if (open.data.length) {
    submissionId = open.data[0].id
    ok('Reusing an open review submission')
  } else {
    const sub = await api('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: PLATFORM },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    })
    submissionId = sub.data.id
  }

  // Adding an item that is already attached errors; tolerate that so a rerun
  // after a network failure can get to the submit step.
  const items = await api(
    'GET',
    `/v1/reviewSubmissions/${submissionId}/items?fields[reviewSubmissionItems]=state`,
  )
  if (!items.data.length) {
    await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    })
  }

  await api('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
    data: { type: 'reviewSubmissions', id: submissionId, attributes: { submitted: true } },
  })
  ok(`Submitted ${version} (build ${buildNumber}) for review — it goes live automatically on approval`)
}

// ── dispatch ─────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i === -1 ? fallback : rest[i + 1]
}
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))

switch (cmd) {
  case 'status':
    await cmdStatus()
    break
  case 'next-build-number':
    await cmdNextBuildNumber()
    break
  case 'set-build-number':
    await cmdSetBuildNumber(positional[0])
    break
  case 'wait-for-build': {
    const build = positional[0] || die('usage: asc.mjs wait-for-build <buildNumber>')
    await cmdWaitForBuild(build, Number(flag('timeout-min', '45')))
    break
  }
  case 'submit': {
    const version = positional[0] || die('usage: asc.mjs submit <version> <buildNumber>')
    const build = positional[1] || die('usage: asc.mjs submit <version> <buildNumber>')
    const notesFile = flag('notes-file')
    const notes = notesFile ? fs.readFileSync(notesFile, 'utf8').trim() : `Bug fixes and improvements.`
    if (!notes) die('Release notes are empty — App Store versions after the first require "What\'s New" text')
    await cmdSubmit(version, build, notes, rest.includes('--dry-run'))
    break
  }
  default:
    die(
      'usage:\n' +
        '  asc.mjs status\n' +
        '  asc.mjs next-build-number\n' +
        '  asc.mjs set-build-number [<number>]\n' +
        '  asc.mjs wait-for-build <buildNumber> [--timeout-min 45]\n' +
        '  asc.mjs submit <version> <buildNumber> [--notes-file <path>] [--dry-run]',
    )
}
