# STiX Apps — altsource

An [AltStore](https://altstore.io) source curated by STiX, built and validated automatically.

| | URL |
|---|---|
| AltStore PAL source | `https://stixzoor.github.io/altsource/source.pal.json` |
| AltStore Classic / SideStore source | `https://stixzoor.github.io/altsource/source.json` |
| Add to AltStore (universal link) | https://altstore.io/source/stixzoor.github.io/altsource/source.pal.json |
| Landing page | https://stixzoor.github.io/altsource/ |

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
public/                 static files copied into the site as-is (landing page)
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
npm run build               write dist/
npm run serve               build and preview at http://localhost:4173/
npm run assets:placeholder  regenerate the placeholder icon and header
```

`validate` prints errors (`E..`) that block the build and warnings (`W..`) that do not.

## Adding an app

1. Create `apps/<bundleIdentifier>.json` from this template:

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
  "appPermissions": { "entitlements": [], "privacy": {} }
}
```

- ADP (AltStore PAL): `downloadURL` is the ADP directory (trailing `/`) or its `manifest.json`; `marketplaceID` is the app's Apple ID from App Store Connect.
- IPA (AltStore Classic / SideStore): `downloadURL` ends in `.ipa`; no `marketplaceID` needed.
- Put new versions **first** in `versions`; AltStore treats index 0 as the latest release.
- List every entitlement and every `*UsageDescription` key in `appPermissions`.

2. Optionally add the bundle identifier to `featuredApps` in `source.meta.json`.
3. `npm run validate`, `npm run build`, commit, push to `main`. The Deploy workflow publishes the site.

## Releasing an update

Prepend a new object to the app's `versions` array with a new `version`/`buildVersion`, `date`,
`downloadURL`, and `size`, then push. Do not rely on `date` for ordering.

## Publishing your own notarized app (later)

1. Request the [Alternative EU Terms Addendum](https://developer.apple.com/contact/request/alternative-eu-terms-addendum/).
2. Register your Developer ID with AltStore PAL: `POST https://api.altstore.io/register` with `developerID` and `email`; paste the returned token in App Store Connect → Users and Access → Integrations → Marketplace.
3. Set the app's review type to Notarization and submit.
4. `GET https://api.altstore.io/adps/<ADP ID>` until `downloadURL` appears; download and host the ADP without modifying any file (or use GitHub Releases with `assetURLs`).
5. Add the version here with `marketplaceID` set.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`: tests, build, GitHub Pages. Pull requests
and other branches run `ci.yml`. Nothing invalid can deploy because the build refuses to write
when validation fails.
