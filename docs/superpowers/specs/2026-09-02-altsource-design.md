# altsource — Design Spec

**Date:** 2026-09-02
**Repo:** `~/projects/altsource` → `github.com/STiXzoOR/altsource` (public)
**Display name:** STiX Apps
**Status:** approved design, awaiting spec review

## 1. Purpose

A self-hosted AltStore source that STiX curates. Today it starts empty. Next it aggregates
other developers' apps. Later it distributes STiX's own notarized app. It must stay current
without manual work, be safe to publish (nothing invalid ever deploys), and give the
maintainer a clear view of what is live.

AltStore has two clients that read the same JSON format but install different packages:

| Client | Installs | Availability |
|---|---|---|
| AltStore PAL | Apple-notarized Alternative Distribution Packages (ADP) | EU, Japan, Brazil; iOS 17.4+ |
| AltStore Classic / SideStore | plain `.ipa` files re-signed with the user's Apple ID | worldwide |

PAL cannot install an `.ipa`; Classic cannot install an ADP. Therefore this repo builds
**two outputs from one content tree**:

| Output | For | Contains |
|---|---|---|
| `source.pal.json` | AltStore PAL | apps with at least one ADP version |
| `source.json` | AltStore Classic, SideStore | apps with at least one IPA version |

This mirrors what existing developers do (e.g. `source.json` + `source.pal.json`).

## 2. Hosting and URLs

GitHub Pages, deployed from a `dist/` folder by GitHub Actions (`actions/upload-pages-artifact`
+ `actions/deploy-pages`). No other services.

| Thing | URL |
|---|---|
| PAL source | `https://stixzoor.github.io/altsource/source.pal.json` |
| Classic source | `https://stixzoor.github.io/altsource/source.json` |
| Add to PAL / Classic (universal link) | `https://altstore.io/source/stixzoor.github.io/altsource/source.pal.json` and `.../source.json` |
| Scheme fallbacks | `altstore-pal://source?url=…`, `altstore://source?url=…`, `sidestore://source?url=…` |
| Per-app deep link | append `?app=<bundleIdentifier>` to the universal link |
| Landing page | `https://stixzoor.github.io/altsource/` |
| Status dashboard | `https://stixzoor.github.io/altsource/status/` |
| Machine status | `https://stixzoor.github.io/altsource/status.json` |

Custom domain later: add a `CNAME` file to `public/` and change `baseURL` in `source.meta.json`.

## 3. Content model (what the maintainer edits)

All content is plain JSON with a `$schema` key for editor autocompletion. Keys that are not
part of the AltStore format (`$schema`, `baseURL`, `upstream`, `kind`, `overrides`) are
stripped at build time.

```
source.meta.json          source-level fields
apps/<bundleIdentifier>.json   one file per app, file name must equal bundleIdentifier
news/<identifier>.json    one file per news item, file name must equal identifier
assets/                   icon.png, header.png, apps/<bundleIdentifier>/{icon.png,screenshots/*}
public/                   static files copied verbatim into dist/ (index.html, status/, .nojekyll)
state/                    bot-written JSON (sync-log.json, link-check.json), committed
```

### 3.1 `source.meta.json`

AltStore source keys per the docs (`name`, `subtitle`, `description`, `iconURL`, `headerURL`,
`website`, `fediUsername`, `patreonURL`, `tintColor`, `nsfw`, `featuredApps`, optional
`identifier`) plus:

- `baseURL` (required): absolute HTTPS URL with trailing slash. Relative URLs anywhere in the
  content tree resolve against it.
- `overrides` (optional): `{ "pal": {…}, "classic": {…} }` — source-level keys merged over
  the base for one output (e.g. a different subtitle for the Classic source).

Initial values: name "STiX Apps", identifier `com.stixzoor.altsource`,
`baseURL` `https://stixzoor.github.io/altsource/`, `nsfw` false, `featuredApps` `[]`.

### 3.2 `apps/<bundleIdentifier>.json`

The full AltStore App object (`name`, `bundleIdentifier`, `marketplaceID`, `developerName`,
`subtitle`, `localizedDescription`, `iconURL`, `tintColor`, `category`, `screenshots`,
`versions`, `appPermissions`, `patreon`, and the PAL 2.2 `localized*` keys passed through)
plus:

- `versions[].kind` (optional): `"adp"` or `"ipa"`. Inferred when absent:
  `assetURLs` present → `adp`; `downloadURL` path ends with `manifest.json` or `/` → `adp`;
  ends with `.ipa` → `ipa`; otherwise a validation error asks for an explicit `kind`.
- `versions[].sha256` (optional, Classic only): passed through.
- `upstream` (optional): how the sync job keeps this app current. One of:

```jsonc
{ "type": "altstore", "url": "https://dev.example/source.json",
  "sync": ["versions"],            // app keys to overwrite from upstream; "*" = all except bundleIdentifier
  "news": true, "notify": false }  // create a news item per new version; push notification flag

{ "type": "github", "repo": "owner/name", "asset": "*.ipa", "prerelease": false,
  "notes": "body",                 // "body" = release notes become version.localizedDescription; "none"
  "news": true, "notify": false }

{ "type": "adp", "url": "https://dev.example/app/adp/<uuid>/manifest.json",
  "news": true, "notify": false }
```

Relative URL fields (`iconURL`, screenshot `imageURL` or bare string) resolve against
`baseURL`. When a screenshot resolves to a local file under `assets/`, the build reads the
PNG or JPEG header and emits `{ imageURL, width, height }`, so iPad screenshots never need
hand-typed dimensions.

### 3.3 `news/<identifier>.json`

The AltStore News Item object. Relative `imageURL` resolves against `baseURL`.
Sync-generated items use identifier `update-<bundleIdentifier>-<version>-<buildVersion>`.

## 4. Build

`altsource build [--out dist]` — no network access.

1. Load meta, apps, news. File-name/identifier mismatches are errors.
2. Resolve relative URLs; fill screenshot dimensions from local files.
3. Validate (section 5). Any error aborts before writing.
4. For each output (`pal`, `classic`):
   - filter each app's `versions` to that kind; drop apps left with none;
   - sort apps by `name` (case-insensitive);
   - filter `featuredApps` to apps present in the output;
   - include news items whose `appID` is absent or present in the output;
   - apply `overrides[output]`;
   - strip extension keys; write pretty-printed JSON with stable key order.
5. Copy `assets/` and `public/` into `dist/`; write `.nojekyll`.

Output is deterministic: the same inputs always produce byte-identical files.

## 5. Validation

`altsource validate [--check-urls[=warn]] [--json]`. Exit 1 on any error.

**Layer 1 — JSON Schema** (`schema/meta.schema.json`, `app.schema.json`, `news.schema.json`,
`version.schema.json`, composed into `source.schema.json`), validated with `ajv`.
Schemas allow additional properties so undocumented AltStore keys never break the build;
unknown keys surface as warnings instead.

**Layer 2 — semantic rules.**

Errors:
- E01 schema violation (types, required keys, enums)
- E02 `bundleIdentifier` differs from file name; E03 duplicate `bundleIdentifier`
- E04 news `identifier` differs from file name or is duplicated
- E05 `featuredApps` entry is not a known app
- E06 any URL is not absolute `https://` after resolution
- E07 relative URL does not resolve to an existing file under `assets/` or `public/`
- E08 `tintColor` is not `#RRGGBB` or `RRGGBB`
- E09 `date` is not ISO 8601 (`YYYY-M-D`, `YYYY-MM-DD`, or full datetime with `Z`/offset)
- E10 `category` not in the documented set
- E11 `versions` empty, or duplicate `(version, buildVersion)` within an app
- E12 `size` is not a positive integer
- E13 iPad screenshot without `width` and `height` after autofill
- E14 version `kind` cannot be inferred
- E15 `appPermissions` present but malformed: `entitlements` not an array of strings, or `privacy` not an object of strings
- E16 `upstream` malformed for its `type`
- E17 `minOSVersion`/`maxOSVersion` not dotted numerics
- E18 (PAL output only) app has an ADP version but no `marketplaceID`

Warnings:
- W01 unknown key (likely a typo such as `iconUrl`)
- W02 more than five `featuredApps`
- W03 versions not in descending `date` order (AltStore uses index 0, not dates)
- W04 `maxOSVersion` present (PAL ignores it; most apps should not set it)
- W05 missing recommended fields: app `subtitle`, `screenshots`; version `minOSVersion`, `localizedDescription`
- W06 news `appID` is not a known app
- W07 `appPermissions` missing (the docs require it; AltStore tolerates its absence, and many community sources omit it)

`--check-urls` sends a HEAD (falling back to a ranged GET) to every unique URL and reports
non-2xx responses as errors, or as warnings with `--check-urls=warn`.

## 6. CLI — `altsource`

`bin/altsource.mjs` dispatching to `src/cli/<command>.mjs`. Argument parsing with
`node:util.parseArgs`; interactive prompts with `node:readline/promises`. Every command
supports `--json` where output is data, and `--markdown` where it feeds a job summary.

| Command | Purpose |
|---|---|
| `validate [--check-urls]` | section 5 |
| `build [--out]` | section 4 |
| `serve [--port 4173]` | build, then serve `dist/` locally for previewing landing and status pages |
| `app add [bundleId] (--from-source URL \| --from-github owner/repo [--asset GLOB] \| --from-adp URL \| --from-ipa PATH\|URL) [--upstream]` | create `apps/<id>.json`. `--from-source` copies the whole app object from another AltStore source. `--from-github` downloads the latest matching asset and inspects it. `--from-adp` and `--from-ipa` read identity, version, and (IPA) permissions from the package. `bundleId` is required only for `--from-source`; interactive prompts when no `--from-*` is given. `--upstream` records the matching `upstream` block. |
| `app list` / `app remove <id>` | list apps with kinds and latest version; delete file and drop from `featuredApps` |
| `version add <id> (--from-adp URL [--release BASE] \| --from-ipa PATH\|URL \| --from-github owner/repo [--tag]) [--notes TEXT] [--date ISO] [--force]` | prepend a version; refuses an existing `(version, buildVersion)` unless `--force` |
| `news add --title --caption [--app] [--url] [--image] [--notify] [--tint] [--id]` | create `news/<id>.json` (id derived from title when omitted) |
| `sync [ids…] [--dry-run]` | section 7.1 |
| `check-links [--write]` | section 7.2 |
| `status [--write]` | section 8 |
| `adp status <adpId>` / `adp download <adpId> --out DIR` / `adp process <adpId>` | AltStore REST API wrappers (`GET /adps/:id`, `POST /adps`); download fetches the returned `downloadURL` archive and extracts it, preserving hierarchy |
| `adp register --developer-id ID --email EMAIL` | `POST /register`; prints the marketplace token and expiry |
| `federate [--source-url]` | `POST /federate` with the PAL source URL |
| `release publish <id> --adp-dir DIR --tag TAG [--repo owner/name] [--notes]` | upload `manifest.json`, `signature`, `variant/*.ipa`, `delta/*.ipa` to a GitHub Release via `gh`, then `version add` with `assetURLs` keyed by file name minus extension |

API base URL comes from `ALTSTORE_API_BASE` (default `https://api.altstore.io`).
GitHub calls use `GITHUB_TOKEN` when set, for rate limits and private repos.

### 6.1 ADP manifest mapping (verified against a live manifest)

| manifest.json | version entry |
|---|---|
| `shortVersionString` | `version` |
| `bundleVersion` | `buildVersion` |
| `minimumSystemVersions.ios` | `minOSVersion` |
| largest `variants[].variantDetails.compressedSize` | `size` |
| `appleItemId` | app `marketplaceID` |
| `bundleId` | app `bundleIdentifier` |
| manifest URL directory (trailing `/`) | `downloadURL` |
| `manifest`, `signature`, each `variants[].publicId`, each `deltas[].publicId` | `assetURLs` keys when `--release BASE` is given; values `BASE/<name>` (`manifest.json`, `signature`, `<uuid>.ipa`) |

`date` is the manifest's HTTP `Last-Modified` when available, else now.

### 6.2 IPA inspection (`src/lib/ipa.mjs`)

Pure JS, no external binaries: `fflate` unzips only the needed entries; `bplist-parser`
decodes binary plists (XML plists parsed directly).

- `Payload/*.app/Info.plist` → `CFBundleIdentifier`, `CFBundleShortVersionString`,
  `CFBundleVersion`, `MinimumOSVersion`, every `*UsageDescription` key → `appPermissions.privacy`.
- Main executable (`CFBundleExecutable`) → scan for the embedded entitlements blob
  (magic `0xFADE7171`, XML plist) → keys → `appPermissions.entitlements`, minus
  `application-identifier` and `com.apple.developer.team-identifier` which the docs say to omit.
  App extensions under `PlugIns/*.appex` are scanned the same way and merged.
- `sha256` and byte size of the file.

## 7. Automations (GitHub Actions)

Commits made with `GITHUB_TOKEN` do not trigger `push` workflows, so `deploy.yml` is a
reusable workflow (`workflow_call`) that every bot job invokes after committing.

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | pull_request, push to non-main | `npm ci`, `npm test`, `validate`, `build` |
| `deploy.yml` | push to main, `workflow_call` | test, `build`, `status --write`, upload + deploy Pages |
| `sync.yml` | cron every 6 h, manual (inputs: `apps`, `dry_run`) | `sync` → if diff: `validate`, commit `chore(sync): …`, push → call deploy |
| `links.yml` | cron weekly, manual | `check-links --write` → commit `state/link-check.json` if changed → open/update issue labelled `link-check` when broken → call deploy |
| `release.yml` | manual (inputs: `bundle_id`, `adp_id`, `tag`, `notes`) | `adp download` → `release publish` → commit → call deploy. **Untested until a notarized build exists**; README says so. |

Concurrency group `pages` serialises deploys. Bot commits use `github-actions[bot]`.
Every job writes a markdown summary to `$GITHUB_STEP_SUMMARY`.

### 7.1 Sync algorithm

For each app with `upstream` (or only the ids given):

- **altstore**: fetch the upstream source; find the app by `bundleIdentifier`; for each key in
  `sync` copy the upstream value over the local one. New version detected when
  `versions[0]` `(version, buildVersion)` changed. If the app still lacks `appPermissions`
  and its newest version is an IPA, download and inspect that IPA to fill them (same path
  as `github`). `app add --from-source` does the same on creation.
- **github**: list releases; take the newest non-draft (prereleases only if enabled); match
  the asset by glob; skip if a local version already has that `downloadURL`. Otherwise download
  the asset, inspect it (bundle id must match, else error), prepend a version
  (`date` = `published_at`, `size` = asset size, `localizedDescription` = release body when
  `notes: "body"`, `sha256`), and refresh `appPermissions` from the IPA.
- **adp**: fetch the manifest; skip if `(shortVersionString, bundleVersion)` exists; else
  prepend per 6.1.

When a version is added and `news` is true, write
`news/update-<id>-<version>-<build>.json` with `appID`, `notify` from upstream config, and
caption "Version X is now available". Append an entry to `state/sync-log.json` (keep 100).
Per-app failures are reported (`::warning::` annotation + summary) but never abort other apps;
the command exits 0 unless the repo itself cannot be read. Validation and build gate the
commit, so bad upstream data never deploys.

### 7.2 Link check

HEAD every unique URL across both outputs and assets. Write
`state/link-check.json` `{ checkedAt, total, broken: [{ url, status, where }] }`.

## 8. Status dashboard

`altsource status --write` (network) produces `dist/status.json`:

```jsonc
{ "generatedAt", "commit", "sourceURLs": { "pal", "classic" },
  "qr": { "pal": "<svg>", "classic": "<svg>" },          // via `qrcode` at build time
  "counts": { "apps", "pal", "classic", "news" },
  "apps": [{ "bundleIdentifier", "name", "kinds", "latest": { "version", "buildVersion", "date" },
             "upstream": { "type", "ref", "latest", "state": "in-sync|behind|ahead|unknown|none", "checkedAt" } }],
  "linkCheck": …contents of state/link-check.json or null,
  "recent": …last 20 entries of state/sync-log.json }
```

`public/status/index.html` is a static page reading `../status.json` and both source files:
counts, both source URLs with copy buttons and QR codes, apps table with upstream state
badges, recent activity, broken links, and links to "Run sync" / "Run link check" /
"Publish release" workflow pages. Public but read-only; it contains no secrets. When
`status.json` is absent (local `serve` preview) the page renders the source data alone and
says so.

## 9. Landing page

`public/index.html`, static, no framework. Fetches both source files at runtime and renders:
source icon, name, subtitle, description; buttons "Add to AltStore PAL", "Add to AltStore
Classic", "Add to SideStore"; an app grid with icon, name, subtitle, latest version, a
PAL/Sideload badge, and per-app deep links. Light and dark themes via `prefers-color-scheme`.

## 10. Code layout and testing

Node 24, ES modules. Runtime dependencies: `ajv`, `fflate`, `bplist-parser`, `qrcode`.
Tests use `node:test` (`npm test` → `node --test`). All network goes through an injectable
`fetch` so tests never touch the internet. Test-driven per the user's CLAUDE.md: failing test,
minimal code, refactor.

```
bin/altsource.mjs
src/cli/*.mjs                thin command handlers
src/lib/urls.mjs             resolve, https checks
src/lib/load.mjs             read meta/apps/news, file-name checks
src/lib/kinds.mjs            version kind inference
src/lib/images.mjs           PNG/JPEG dimensions
src/lib/build.mjs            merge, split, sort, strip, write
src/lib/validate.mjs         schema + rules → { errors, warnings }
src/lib/adp.mjs              manifest → version entry, assetURLs
src/lib/ipa.mjs              IPA inspection
src/lib/github.mjs           releases API, asset matching, gh release upload
src/lib/sync.mjs             upstream handlers
src/lib/news.mjs             news creation
src/lib/links.mjs            link checker
src/lib/status.mjs           status.json
src/lib/altstore-api.mjs     REST wrappers
schema/*.schema.json
test/**/*.test.mjs, test/fixtures/ (trimmed real ADP manifest, synthetic IPA built in-test,
                                    binary plist sample, sample upstream sources)
```

## 11. Milestones

1. **Core**: repo, schemas, content files, build (dual output), validate, tests, `ci.yml`,
   `deploy.yml`, landing page, README; create the GitHub repo with `gh`, enable Pages with
   build type `workflow` through the API, first deploy. Source is live with zero apps and a
   welcome news item.
2. **CLI**: `app`, `version`, `news`, `serve`; ADP mapping; IPA inspection; `--from-*` inputs.
3. **Automation + dashboard**: `sync`, `check-links`, `status`, `sync.yml`, `links.yml`,
   status page, QR codes, job summaries.
4. **Own-app pipeline**: `adp *`, `federate`, `release publish`, `release.yml`, README
   checklist (EU addendum → `adp register` → token in App Store Connect → notarize →
   `adp download` → `release publish`).

Each milestone ends with tests green, a deploy, and a check on a real device.

## 12. Out of scope (documented as later add-ons)

- Download counts: GitHub Pages cannot count fetches by AltStore; would need a redirect
  worker in front of download URLs.
- Tooling for localized metadata (keys pass through untouched).
- Patreon gating (object passes through untouched).
- Hosting IPAs or ADPs inside this repo (use GitHub Releases).

## 13. Open risk

Whether AltStore PAL renders a source with zero apps has not been confirmed. Milestone 1
ends by adding the empty source on a device; if PAL rejects it, milestone 2 is pulled forward
to add the first app before announcing the URL.
