# STiX Apps — altsource

An [AltStore](https://altstore.io) source curated by STiX, built and validated automatically.

| | URL |
|---|---|
| AltStore PAL source | `https://stixzoor.github.io/altsource/source.pal.json` |
| AltStore Classic / SideStore source | `https://stixzoor.github.io/altsource/source.json` |
| Add to AltStore (universal link) | https://altstore.io/source/stixzoor.github.io/altsource/source.pal.json |
| Website | https://stixzoor.github.io/altsource/ (apps, news, status) |

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
npm run assets:placeholder  regenerate the placeholder icon and header

altsource app add …         create apps/<bundleId>.json (see below)
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
source as a website at build time. On phones it mirrors the AltStore app and
[altsource-viewer](https://github.com/therealFoxster/altsource-viewer): tinted app rows with GET/VIEW pills, solid-tint
news cards, a translucent nav bar whose title and GET button appear on scroll, a screenshot carousel, permission
cards with plain-English explanations, iOS action sheets for install choices. On desktop it reads like an App Store
product page: large header, wide gallery, description beside a sticky Information sidebar, grids for lists.

Stack: no UI framework (native `<dialog>`, ARIA tabs, small inline scripts), [Hugeicons](https://hugeicons.com)
rendered at build time, shadcn-style design tokens (`--background`, `--card`, `--primary`, …) so shadcn components could
be dropped in later, light/dark themes, tint colours corrected for contrast, skip link, focus rings, reduced-motion
support. `site/src/data/*.mjs` (permission descriptions) come from altsource-viewer, see `THIRD_PARTY.md`.

## Automation

| Workflow | When | What it does |
|---|---|---|
| `sync.yml` | every 6 hours, or `gh workflow run Sync` | For every app with an `upstream` block: fetch the newest version, download and inspect IPAs, prepend the version, create a news item, validate, build, commit as `github-actions[bot]`, redeploy. Per-app failures become warnings in the job summary; nothing invalid can ship. |
| `links.yml` | Mondays 06:00 UTC, or `gh workflow run "Link check"` | HEAD-checks every URL in both outputs, records `state/link-check.json`, opens (or updates, or closes) an issue labelled `link-check`, redeploys the status page. |
| `deploy.yml` | every push to `main`, and after the two above | Tests, build, `status.json`, GitHub Pages. |

The status dashboard lives at https://stixzoor.github.io/altsource/status/ (also `npm run serve` → `/status/`): counts,
QR codes that add the source when scanned, local vs upstream version per app, recent sync activity, and broken links.
It is public and read-only; maintainer actions live in the GitHub Actions tab, not on the page.

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
