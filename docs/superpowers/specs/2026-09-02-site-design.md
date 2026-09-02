# altsource — Site (Milestone 5) Design Addendum

**Date:** 2026-09-02 · **Extends:** `2026-09-02-altsource-design.md` (sections 2, 9)

## 1. Purpose

Replace the single-file landing page with a full, App Store-like website for this source, inspired
by [therealFoxster/altsource-viewer](https://github.com/therealFoxster/altsource-viewer) (MIT):
source overview, per-app pages with screenshots, release notes, version history and plain-English
permissions, a news page, and the existing status dashboard restyled to match. The site is for this
source only (no "paste any source URL" mode), mobile-first and desktop-ready, generated at build
time from the content tree so it needs no runtime fetch and no CORS.

## 2. Stack

Astro 7 (static output) + Tailwind CSS 4 (`@tailwindcss/vite`), Node 24. No UI framework: interactivity
(search/filter, screenshot lightbox, copy buttons, theme toggle, status dashboard) is plain
`<script>` blocks that Astro bundles. Icons are inline SVG via a local `Icon.astro` map. System font
stack, no external requests. Dev dependencies only; the CLI keeps its four runtime deps.

## 3. Pipeline

```
npm run build   = altsource build --out .altsource  →  astro build
npm run dev     = altsource build --out .altsource  →  astro dev
altsource serve = the same two steps + offline status.json, then a static server on dist/
```

- Astro config: `srcDir: site/src`, `publicDir: .altsource` (the JSON build output: `source.json`,
  `source.pal.json`, `assets/`, `.nojekyll`), `outDir: dist`, `site: https://stixzoor.github.io`,
  `base: /altsource`, `trailingSlash: 'always'`. Env `ALTSOURCE_ROOT` (content tree, default cwd) and
  `ALTSOURCE_PUBLIC` (default `.altsource`) let tests build from fixtures.
- Pages read the content tree through the existing library (`loadContent` → `resolveContent` →
  `buildOutput`) in `site/src/lib/data.mjs`, memoised per build. The JSON files are still published
  verbatim from `publicDir`.
- `altsource status --write` still writes `dist/status.json` after the site build (CI) — the status
  page fetches it client-side, as today. `.altsource/` is git-ignored. `public/` is removed.

## 4. Pages and URLs (all under `/altsource/`)

| Route | Content |
|---|---|
| `/` | Hero (blurred header image, icon, name, subtitle, description), three add buttons (PAL, Classic, SideStore) with copyable URLs, featured apps strip, latest news (3), app grid with search + category/kind filters (client script) |
| `/apps/` | Full app grid with the same search/filter |
| `/apps/<bundleId>/` | Icon (tint colour), name, developer, subtitle; get buttons by kind (PAL → universal link with `?app=`, Classic → universal link on `source.json` + `altstore://install?url=` + direct `.ipa`, SideStore → `sidestore://install?url=`); meta row (version, size, min iOS, category, updated); screenshots (iPhone/iPad tabs, scroll-snap strip, `<dialog>` lightbox); description with "more"; What's New (latest notes) + link to versions; permissions (entitlements + privacy with names/descriptions from the ported dictionaries, unknown keys shown raw); "Add this source" footer |
| `/apps/<bundleId>/versions/` | Every version: marketing version, build, date, size, min iOS, notes |
| `/news/` | All news items newest first, tint colour, image, link, linked app banner |
| `/status/` | The existing dashboard (client-rendered from `status.json`), restyled |
| `/404.html` | Not found |

Apps that appear in both outputs show both kinds. Open Graph/Twitter meta on every page, `sitemap`
not needed (noindex on status only). Light and dark themes: `prefers-color-scheme` plus a toggle
persisted in `localStorage`; the source `tintColor` becomes the accent via a CSS variable.

## 5. Ported material (attribution)

`site/src/data/entitlements.mjs` and `privacy.mjs` come from altsource-viewer (MIT); a
`THIRD_PARTY.md` carries the licence text. No viewer code is copied; the design is re-implemented.

## 6. Testing

`test/site/site.test.mjs` builds a fixture content tree (two apps: one ADP-only, one with both
kinds, screenshots, permissions; two news items) with `astro build` into a temp dir, then asserts:
a page per app and per version list, the home page lists every app and the add links, internal
`href`s resolve to files in the output, JSON and assets are copied, no GitHub Actions/workflow
links, status page present. Unit tests cover `data.mjs` (merge of kinds, install links, permission
lookups, size/date formatting). CI and deploy run `npm run build` (site included).

## 7. Out of scope

Generic "view any source" mode, Lighthouse CI, i18n of the UI (localized source fields are shown
when present for `en` only), image optimisation of remote screenshots.
