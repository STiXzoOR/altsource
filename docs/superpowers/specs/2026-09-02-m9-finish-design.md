# M9 — Finish: real content, nothing technical, native feel

Status: approved 2026-09-02. Follows M8 (`2026-09-02-m8-storefront-design.md`); the shell, tokens, store switch and page anatomy from M8 stay unless a section below changes them.

## 1. Goals

1. Real content for the seeded apps: app icons, screenshots, curated names, release notes that read like the App Store's "What's New".
2. Nothing technical on screen: no bundle identifiers, file names, JSON links, commit hashes, build numbers, raw entitlement keys, UTC timestamps.
3. Phones feel like AltStore in the browser: no footer, a Settings sheet, no horizontal overflow on any page, press states everywhere, iPad rows in two columns.
4. The Status page goes away. Three tabs.
5. Pixel checks at 375 / 390 / 430 (phones), 768 / 1024 (iPad), 1280 / 1580 (desktop), light and dark, WebKit for the phone sizes.

## 2. Content pipeline

### 2.1 Vendored assets and the `app assets` command

Assets live in the repo under `assets/apps/<bundleId>/` and are served from the site base (same as `assets/icon.png`). The app JSON refers to them with repo-relative paths (`assets/apps/<id>/icon.png`), which `resolveContent` already turns into absolute URLs at build.

`altsource app assets <bundleId> [--icon URL|PATH] [--screenshot URL|PATH]... [--ipad URL|PATH]... [--replace]`

- `--icon`: fetched or read, decoded with sharp, made square (cover, centred), resized to 1024, alpha flattened on white, written as `icon.png`. `iconURL` in the app JSON becomes `assets/apps/<id>/icon.png`.
- `--screenshot` (repeatable, in order): resized so the height is at most 1600 px, written as `iphone-<n>.jpg` (quality 82, mozjpeg). `--ipad` does the same into `ipad-<n>.jpg`. `screenshots` becomes the list form `[{ imageURL, width, height }]` when only iPhone shots exist, otherwise `{ iphone: [...], ipad: [...] }`.
- Without `--replace`, new screenshots are appended after the existing ones in that group; with it, the group's files are deleted first.
- Pure core in `src/lib/assets.mjs`: `normalizeIcon(buffer)`, `normalizeScreenshot(buffer)` (both return `{ data, width, height }`), `assetPaths(id, { iphone, ipad })`. CLI wrapper in `src/cli/app.mjs` (`assets` sub-command) with the usual `ctx.fetch` injection so tests use `fakefetch`.
- sharp moves from devDependencies to dependencies (the CLI uses it in CI).

### 2.2 Release notes as Markdown

`site/src/lib/notes.mjs` exports `renderNotes(markdown) → html` and `trimNotes(markdown) → markdown`.

`trimNotes`: normalise CRLF; split at ATX headings; drop every section whose heading text starts with `Installation`, `Install`, `Issue`, `Known issue`, `Download`, `Support`, `Link`, `Checksum` or `SHA` (case-insensitive) up to the next heading of the same or a higher level; drop GFM tables (any run of lines starting with `|`); trim surrounding whitespace.

`renderNotes`: `trimNotes` then `marked` (GFM, no HTML passthrough) with a custom renderer that emits only: `<p>`, `<ul>`/`<ol>`/`<li>`, `<strong>`, `<em>`, `<code>`, `<a href rel="noopener" target="_blank">` (http/https only, anything else rendered as text), `<br>`. Headings render as `<p class="notes-h"><strong>…</strong></p>`; block quotes as paragraphs; code blocks as `<p><code>…</code></p>`; images, horizontal rules and raw HTML render as nothing (HTML is escaped to text). `marked` is a devDependency (build-time only).

`Text.astro` gains `markdown` (boolean). With it, the body is `renderNotes(text)`, the wrapper gets class `notes`, and `whitespace-pre-line` is not applied. Clamping (`line-clamp-3` on the wrapper, `-webkit-box` clamps across nested blocks) and the "more" button keep working. Styles in `@layer components`: `.notes > * + *` gets `margin-top: .5em`, `.notes ul` disc list with `padding-left: 1.25em`, `.notes ol` decimal, `.notes code` 0.92em on `--fill` with radius 4, `.notes a` key colour, `.notes-h` no extra weight beyond `<strong>`.

Used for: the inline What's New, every Version History row, and the app description (developers paste Markdown there too).

### 2.3 Curated metadata

- Developer names: UTM → "Turing Software", Provenance → "Provenance EMU", PojavLauncher → "PojavLauncher Team", Nuvio Enhanced → "Nuvio".
- Icons: UTM from `https://alt.getutm.app/icon.png`; Provenance from its `iTunesArtwork@2x.png`; PojavLauncher from the `PojavLauncher_iOS` app icon set; Nuvio from `NuvioMobile-iOS`. Screenshots: UTM's seven official ones; the other three from their READMEs or sites when they exist, otherwise none (the Today card falls back to icon art).
- `categoryLabel(id)` in `site/src/lib/data.mjs`: `developer` → "Developer Tools", `photo-video` → "Photo & Video", otherwise Title Case of the id with `-` as a space. Used everywhere a category is shown.
- `versionLabel(v)` becomes `marketingVersion ?? version` (no build number anywhere on the site).

## 3. Shell

### 3.1 Navigation

`navItems` drops Status: Home, Apps, News. Tab bar and sidebar render three rows. `site/src/pages/status/` is deleted together with its tests and README section; the `altsource status` command, `status.json` and the CI step summary stay for the maintainer.

### 3.2 Settings sheet (phones and tablets)

The Home nav bar's trailing slot holds a gear button (`Settings01Icon`, `aria-label="Settings"`, `data-sheet="settings"`) before the Add pill. `SettingsSheet.astro` renders `<Sheet id="settings" title="Settings">` with:

- "Appearance" group: the `ThemeToggle` segmented control.
- "About" group as an inset grouped list (`.info` rows): "Source on GitHub ↗" (`meta.website`), "Report a problem ↗" (`meta.website` + `/issues` when the website is a GitHub URL).
- Footnote (13 px secondary): "AltStore PAL installs notarized apps in the EU, Japan and Brazil. AltStore Classic and SideStore sideload apps everywhere."

Only the home page includes the sheet and the gear. The sheet's `sm:` centred-card variant is fine on tablets.

### 3.3 Footer and sidebar

`Footer.astro`: `hidden lg:block`; one line "STiX Apps · AltStore PAL installs notarized apps in the EU, Japan and Brazil. AltStore Classic and SideStore sideload apps everywhere." and a single "GitHub" link. No theme toggle, no file names.

`Sidebar.astro`: bottom keeps the `ThemeToggle`; the two JSON links become one "GitHub" link (`meta.website`).

### 3.4 Body

`html, body { overflow-x: clip }`. `.approw, .pill, .get, .segment, .tabbar a, .sheet-action, .navbar-back { user-select: none; -webkit-user-select: none }`. `.approw:active` and `.today:active` dim to opacity .7 over 120 ms (`motion-reduce` keeps it). `h1, h2, h3 { text-wrap: balance }`, `p { text-wrap: pretty }`.

## 4. Pages

### 4.1 Home

- Facts ribbon: any fact whose count is 0 is omitted. Labels: APPS "in this source", ALTSTORE PAL "notarized", SIDELOAD "Classic · SideStore", NEWS, UPDATED.
- Hero buttons: one primary per store state, labelled "Add to AltStore" for All, PAL and Classic and "Add to SideStore" for SideStore (the segmented control below says which). Share is one button: an icon-only 32 px translucent circle under 1000 px (`aria-label="Share"`), icon + "Share" from 1000 px.
- Source URL chips: `hidden lg:grid` (desktop only).
- Add sheet (`ActionSheet`) actions gain `copy` rows: `{ label: 'Copy PAL link', copy: urls.pal, stores: 'pal' }` and `{ label: 'Copy Classic link', copy: urls.classic, stores: 'classic sidestore' }` after the Add rows. `ActionSheet` renders a `copy` action as `<button data-copy=… class="sheet-action">` reusing the `SourceURLChip` copy script (moved to a shared `copy.mjs` inline script so both components use it) and shows "Copied" in the row for 1.5 s.
- Add sheet on desktop (`sm:` and up): a `qr` prop `[{ label, url, svg }]` renders a two-up grid of QR codes (120 px, white tile, radius 12, label under) above the actions. SVGs come from `qrSVG()` in `src/lib/status.mjs` (reused, not duplicated). Hidden under 640 px.
- About: link text "Source on GitHub".
- Phone app rows: `grid gap-2.5 sm:grid-cols-2`.

### 4.2 App page

- Ribbon: SIZE, VERSION (date), REQUIRES, DEVELOPER, CATEGORY (`categoryLabel`), STORE with value "AltStore" and sub "PAL · Classic" / "PAL" / "Classic · SideStore". Under 1000 px the ribbon gets a right-edge fade (`mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent)`) so a cut column reads as scrollable.
- What's New: "Version {versionLabel}" and the date; notes via `<Text markdown clamp={3}>`. Version History rows use `versionLabel` and `<Text markdown clamp={3}>`.
- Description via `<Text markdown clamp={5}>`.
- Permissions: privacy card unchanged. Entitlements card lists only entitlements with a dictionary entry; the rest collapse into one row "{n} more system entitlement(s)" whose alert lists the raw keys (12 px, monospace, secondary). The dictionary gains friendly entries for the common sideloading keys: `com.apple.developer.kernel.increased-memory-limit` ("Increased Memory Limit"), `com.apple.developer.kernel.extended-virtual-addressing` ("Extended Virtual Addressing"), `dynamic-codesigning` ("Just-In-Time Compilation"), `com.apple.private.hypervisor` ("Hypervisor"), `com.apple.vm.device-access` ("Virtual Machine Device Access"), `com.apple.security.exception.iokit-user-client-class` ("Hardware Access"), `com.apple.private.memorystatus` ("Memory Status"), `com.apple.system.diagnostics.iokit-properties` ("Hardware Diagnostics"), `com.apple.private.iokit.IOServiceSetAuthorizationID` ("Hardware Authorization"), `get-task-allow` stays "Debuggable".
- Information rows: Developer, Size, Category, Compatibility, Version ("{versionLabel} · {date}"), Available on ("AltStore PAL" / "AltStore Classic, SideStore" / both). Below the list a single link row "Project on GitHub ↗" when the app's upstream is a GitHub repo (`entry.project = { label, href }` computed in `getSite`; `upstream` itself is still not exposed). Bundle ID, JSON links and the download link are gone from the page; "Download .ipa" remains an action inside the Get sheet.
- "More by" rows: `sm:grid-cols-2`.

### 4.3 Apps index and News

Apps: rows `grid gap-2.5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`; category chips use `categoryLabel`. News: unchanged.

## 5. Removed

`site/src/pages/status/index.astro`, the Status nav item, `test/site` assertions for `/status/`, README "status dashboard" paragraph and the `(apps, news, status)` mention. `deploy.yml` keeps `status --write` (the JSON is still published for the maintainer) and the markdown step summary.

## 6. Testing

- `test/lib/assets.test.mjs`: `normalizeIcon` squares and resizes a 300×200 PNG to 1024×1024 opaque PNG; `normalizeScreenshot` keeps a 1170×2532 PNG's aspect at 1600 tall JPEG and leaves a 800×1200 image at its size; `assetPaths` names files.
- `test/cli/app.test.mjs` (`assets` cases): fetches `--icon` and two `--screenshot` URLs through `fakefetch`, writes `assets/apps/<id>/icon.png`, `iphone-1.jpg`, `iphone-2.jpg`, sets `iconURL` and `screenshots` with width/height; `--replace` clears old files; unknown app errors.
- `test/site/notes.test.mjs`: headings → bold paragraphs; `**bold**`, lists, links (http only, `rel="noopener"`); tables dropped; an "## Installation" section dropped up to the next `##`; raw HTML escaped; images dropped; CRLF normalised.
- `test/site/data.test.mjs`: `versionLabel` without build; `categoryLabel` mapping; `entry.project` for a GitHub upstream and `undefined` otherwise.
- `test/site/site.test.mjs`: no `/status/` page in the build; three tab-bar and three sidebar rows; Home has the settings gear and `#settings` dialog with the theme toggle; hero has one visible Add label per store and an icon-only share under `lg`; Add sheet has `data-copy` rows with `data-stores`; footer has `hidden lg:block` and no `.json` text; sidebar has no `.json` text; app page `dl.info` has no `Bundle ID` and no bundle identifier text; no `source JSON` links; What's New contains `<strong>` from Markdown; unknown entitlements collapse into the "more system entitlement" row; built CSS contains `overflow-x: clip` and the ribbon mask.
- `test/lib/permissions.test.mjs` or the site data test: the new dictionary entries resolve.
- Visual pass (not automated): Playwright at 375×667, 390×844, 430×932, 768×1024, 1024×768, 1280×900, 1580×1000, light and dark, `document.documentElement.scrollWidth === innerWidth` on every page at every size; phone sizes also in WebKit.

## 7. Milestones

- **M9a Content**: assets core + CLI, notes renderer, `Text markdown`, `categoryLabel`, `versionLabel`, dictionary entries, curated names, real icons and screenshots committed.
- **M9b Nothing technical**: navigation and Status removal, Settings sheet, footer and sidebar, hero buttons and chips, Add sheet copy rows and QR codes, app page ribbon / info / permissions / links, README.
- **M9c Native polish and QA**: body rules, press states, two-column rows, ribbon fade, viewport pass with fixes, deploy, docs and vault notes.
