# STiX Apps — altsource

An [AltStore](https://altstore.io) source curated by STiX, built and validated automatically.

| | URL |
|---|---|
| AltStore PAL source | `https://stixzoor.github.io/altsource/source.pal.json` |
| AltStore Classic / SideStore source | `https://stixzoor.github.io/altsource/source.json` |
| Add to AltStore (universal link) | https://altstore.io/source/stixzoor.github.io/altsource/source.pal.json |
| Website | https://stixzoor.github.io/altsource/ (apps, news) |

AltStore PAL installs Apple-notarized apps (EU, Japan, Brazil). AltStore Classic and SideStore
sideload plain IPAs anywhere. Both read the same JSON format, so this repo builds two files from
one content tree: apps with ADP versions land in `source.pal.json`, apps with IPA versions in
`source.json`, and an app with both kinds appears in both.

## Layout

```
source.meta.json        source-level fields (name, description, icon, tint colour, featuredApps…)
apps/<bundleId>.json    one app per file; the file name must equal bundleIdentifier
news/<identifier>.json  one news item per file; the file name must equal identifier
assets/                 icon.png, header.png, apps/<bundleId>/… (icons, screenshots)
site/                   the Astro + Tailwind website (pages, components, permission dictionaries)
schema/                 JSON Schemas; every content file has a "$schema" for editor autocompletion
dist/                   build output (ignored by git)
```

Any URL may be written relative to the repo, e.g. `assets/apps/com.example/icon.png`; the build
resolves it against `baseURL`. Screenshots that point at local PNG/JPEG files get `width` and
`height` filled in automatically.

## Commands

```
npm test                    unit tests
npm run validate            check content; add -- --check-urls to probe every URL
npm run build               JSON + assets into .altsource/, then the Astro site into dist/
npm run dev                 Astro dev server with hot reload (http://localhost:4321/altsource/)
npm run serve               full build (site + offline status.json) served at http://localhost:4173/
npm run assets:brand        regenerate assets/ (icon, header, wordmark) from src/lib/brand.mjs

altsource app add …         create apps/<bundleId>.json (see below)
altsource app assets <id> --icon URL --screenshot URL…   vendor the icon and screenshots into assets/apps/<id>/
altsource app list          apps with kinds, latest version and upstream
altsource app remove <id>   delete an app (and drop it from featuredApps)
altsource version add …     prepend a release to an app
altsource news add …        create news/<id>.json
```

Run the CLI as `node bin/altsource.mjs …` or `npx altsource …` inside the repo. `validate` prints
errors (`E..`) that block the build and warnings (`W..`) that do not.

## Adding an app

Pick the flow that matches where the app lives. `--upstream` records the origin so the sync job
(milestone 3) can keep the app current.

```
# plain IPA published on GitHub Releases (AltStore Classic / SideStore)
altsource app add --from-github owner/repo --upstream [--asset '*.ipa'] [--tag v1.2] [--prerelease]

# app listed in another developer's AltStore source (copies the whole listing)
altsource app add com.example.app --from-source https://dev.example/source.json --upstream

# notarized ADP hosted by its developer (AltStore PAL)
altsource app add --from-adp https://dev.example/app/adp/<uuid>/ --name "App" --icon https://… --developer "Dev" --upstream

# an IPA you host yourself
altsource app add --from-ipa ./build/App.ipa --download-url https://cdn.example/App.ipa --icon assets/apps/com.example.app/icon.png

# interactive prompts
altsource app add
```

Every flow that sees an IPA reads `Info.plist` and the embedded entitlements, so `appPermissions`
is filled in for you. Override any field with `--name --developer --subtitle --description --icon
--category --tint --marketplace-id`. The command prints notes for placeholders it had to invent
(for example an icon taken from the GitHub avatar) and any validation issues for the new file.

Behind the scenes each app is one JSON file:

```json
{
  "$schema": "../schema/app.schema.json",
  "name": "Example",
  "bundleIdentifier": "com.example.app",
  "marketplaceID": "6445840140",
  "developerName": "Example Dev",
  "subtitle": "One sentence.",
  "localizedDescription": "Longer description.",
  "iconURL": "assets/apps/com.example.app/icon.png",
  "tintColor": "#3B82F6",
  "category": "utilities",
  "screenshots": ["assets/apps/com.example.app/1.png"],
  "versions": [
    {
      "version": "1.0",
      "buildVersion": "1",
      "date": "2026-09-02",
      "localizedDescription": "First release.",
      "downloadURL": "https://dev.example/app/adp/<uuid>/",
      "size": 12345678,
      "minOSVersion": "17.4"
    }
  ],
  "appPermissions": { "entitlements": [], "privacy": {} },
  "upstream": { "type": "adp", "url": "https://dev.example/app/adp/<uuid>/" }
}
```

- ADP (AltStore PAL): `downloadURL` is the ADP directory (trailing `/`) or its `manifest.json`; `marketplaceID` is the app's Apple ID from App Store Connect.
- IPA (AltStore Classic / SideStore): `downloadURL` ends in `.ipa`; no `marketplaceID` needed.
- New versions go **first** in `versions`; AltStore treats index 0 as the latest release.
- `upstream` is stripped from the published JSON; it only drives automation.

Then optionally add the bundle identifier to `featuredApps` in `source.meta.json`, run
`npm run validate` and `npm run build`, commit, and push to `main`.

## Releasing an update

```
altsource version add com.example.app --from-github owner/repo          # newest release asset
altsource version add com.example.app --from-adp https://…/manifest.json [--release https://github.com/o/r/releases/download/v2]
altsource version add com.example.app --from-ipa ./App.ipa --download-url https://cdn.example/App-2.ipa
altsource news add --title "App 2.0" --caption "What changed" --app com.example.app [--notify]
```

`version add` refuses a version/build that already exists unless `--force`, refreshes
`appPermissions` from the IPA, and `--release BASE_URL` turns an ADP into `assetURLs` so the
package can live on GitHub Releases.

## Site

`site/` is an [Astro](https://astro.build) 7 + [Tailwind CSS](https://tailwindcss.com) 4 project that renders the
source as a website at build time, following Apple's Human Interface Guidelines and the anatomy of the App Store web app.

- **Desktop (from 1000 px)** is an App Store shell: a 260 px sidebar (lockup, Home / Apps / News, the store
  switch, appearance), the home hero with an information ribbon and Today-style featured cards, snapping shelves with
  hover arrows, small-lockup app rivers, and product pages with the Store's anatomy (blurred-artwork hero with the
  194 px icon, ribbon of facts, screenshot shelf, description with "more", What's New with a Version History sheet,
  App Privacy-style permission cards, Information grid, links, "More by").
- **Phones** feel like the AltStore app: a transparent bar that turns to glass as the large title scrolls under it,
  a floating glass tab bar, tinted header cards, 87 px tinted app rows with uppercase pills, snapping strips, bottom
  sheets that slide up on iOS's curve, Dynamic Type through the system font, safe-area padding, a Settings sheet
  (appearance, project links) behind the gear in the home bar instead of a footer, and nothing technical on screen (no
  identifiers, file names or build numbers).
- **Content.** `altsource app assets <bundleId> --icon … --screenshot …` vendors icons (1024 px PNG, JPEG when heavy) and
  screenshots (JPEG ≤ 1600 px tall) under `assets/apps/<bundleId>/` and writes them into the app JSON; release notes and
  descriptions are Markdown rendered through an allowlist (`site/src/lib/notes.mjs`), with installation and issue
  sections and tables dropped.
- **Store switch.** `html[data-store]` is `all | pal | classic | sidestore` (remembered in `localStorage.store`).
  Elements with `data-stores="pal classic"` show when the chosen store is listed (always under All); elements with
  `data-store-only="pal"` show in exactly that state. Rows, install pills, source URL chips and counts use it, so a
  SideStore user only sees what SideStore can install and Add/Get become direct links.
- **Tokens.** iOS semantic colours through `light-dark()`, two type scales (`t-large-title` … `t-caption`: iOS sizes on
  phones, apps.apple.com sizes on desktop), App Store radii and shadows, `.get` / `.pill` / `.approw` / `.ribbon` /
  `.shelf` / `.today` / `.sheet` component classes in `site/src/styles/global.css`.
- **Brand.** `src/lib/brand.mjs` builds the Obsidian icon, wordmark and header image; `npm run assets:brand`
  regenerates `assets/` (Chakra Petch is vendored in `brand/fonts/`, OFL).

Stack: no UI framework (native `<dialog>`, ARIA tabs, small inline scripts), [Hugeicons](https://hugeicons.com)
rendered at build time, light/dark themes with a three-state control, tint colours corrected for contrast, skip link,
focus rings, reduced-motion and reduced-transparency support, cross-document view transitions that morph the app icon
from list to page. `site/src/data/*.mjs` (permission descriptions) come from altsource-viewer, see `THIRD_PARTY.md`.

## Automation

| Workflow | When | What it does |
|---|---|---|
| `sync.yml` | every 6 hours, or `gh workflow run Sync` | For every app with an `upstream` block: fetch the newest version, download and inspect IPAs, prepend the version, create a news item, validate, build, commit as `github-actions[bot]`, redeploy. Per-app failures become warnings in the job summary; nothing invalid can ship. |
| `links.yml` | Mondays 06:00 UTC, or `gh workflow run "Link check"` | HEAD-checks every URL in both outputs, records `state/link-check.json`, opens (or updates, or closes) an issue labelled `link-check`, redeploys. |
| `deploy.yml` | every push to `main`, and after the two above | Tests, build, `status.json`, GitHub Pages. |

`altsource status` prints the maintainer report (counts, local vs upstream version per app, recent sync activity, broken
links); the deploy job writes the same data to `status.json` next to the sources and to the Actions step summary. There is
no status page on the site.

`upstream` keys inside an app file:

| Key | Types | Meaning |
|---|---|---|
| `type` | all | `altstore` (another source JSON), `github` (release assets), `adp` (hosted manifest) |
| `url` | altstore, adp | source URL or ADP directory/manifest URL |
| `repo`, `asset`, `prerelease` | github | `owner/name`, asset glob (default `*.ipa`), include prereleases |
| `notes` | github | `body` (default) uses the release notes; `none` leaves them out |
| `sync` | altstore | keys to copy from upstream, default `["versions"]`; `"*"` copies everything except the bundle id |
| `news` | all | `false` to skip the automatic news item |
| `notify` | all | `true` to push-notify users about each update (off by default) |

`state/` holds bot-written files (`sync-log.json`, `link-check.json`); commit them but do not edit them.

## Publishing your own notarized app

> **Not yet exercised against a real notarized build.** Every step below is unit-tested with mocked
> API responses and a fake `gh`, but the first real run will be the first real test. Use `--dry-run`
> and `adp status` liberally the first time.

1. Request the [Alternative EU Terms Addendum](https://developer.apple.com/contact/request/alternative-eu-terms-addendum/) (skip if distributing only in Japan).
2. Register with AltStore PAL and connect the marketplace:
   ```
   altsource adp register --developer-id <Apple Developer ID> --email you@example.com
   ```
   Paste the printed token in App Store Connect → Users and Access → Integrations → Marketplace,
   pick the app(s), and choose "Yes, send notifications" so AltStore processes builds automatically.
3. In App Store Connect set the app's review type to **Notarization** and submit. Note the ADP ID
   (Distribution → Alternative Distribution Package).
4. Create the listing once: `altsource app add com.your.app --from-adp <manifest URL>` is only
   possible after step 6, so for the first release create `apps/com.your.app.json` by hand (template
   above) with a placeholder version, or run `altsource app add` interactively.
5. Wait for processing: `altsource adp status <ADP ID>` (or `altsource adp process <ADP ID>` if you
   declined notifications).
6. Publish — either run the **Publish release** workflow (`gh workflow run "Publish release"
   -f bundle_id=com.your.app -f adp_id=<ADP ID> -f tag=v1.0.0 -f notes="First release"`) or locally:
   ```
   altsource adp download <ADP ID> --out adp --wait
   altsource release publish com.your.app --adp-dir adp --tag v1.0.0 --notes "First release" --dry-run
   altsource release publish com.your.app --adp-dir adp --tag v1.0.0 --notes "First release"
   git add apps && git commit -m "feat(release): com.your.app v1.0.0" && git push
   ```
   The package files go to a GitHub Release and the version entry gets `assetURLs`, exactly as the
   AltStore docs describe for GitHub-hosted ADPs. Nothing in the package is modified.
7. Optional: set `fediUsername` in `source.meta.json` (permanent), deploy, then `altsource federate`
   to list the source on https://explore.alt.store/.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`: tests, build, GitHub Pages. Pull requests
and other branches run `ci.yml`. Nothing invalid can deploy because the build refuses to write
when validation fails.
