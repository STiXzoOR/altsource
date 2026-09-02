# M9b — Nothing technical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every technical artefact from the storefront (Status page, JSON links, bundle IDs, build numbers, raw URLs on phones) and give phones a Settings sheet instead of a footer, while keeping the copy-the-source-URL flow on desktop and inside the Add sheet.

**Architecture:** Navigation loses Status; a `SettingsSheet.astro` (Appearance, project links, one-line store explanation) opens from a gear that lives in a new always-visible `actions` slot of `NavBar.astro`; the footer becomes desktop-only; the home hero gets store-neutral Add labels and an icon-only Share on phones; `ActionSheet.astro` learns `copy` rows and QR tiles; one copy script in `Base.astro` serves chips and sheet rows; the app page drops identifiers and file links and shows a project link instead.

**Tech Stack:** Astro 7, Tailwind 4, `qrcode-generator` (already a dependency), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-02-m9-finish-design.md` (sections 3, 4, 5).

## Global Constraints

- Every change starts with a failing test in `test/site/*.test.mjs` (the site suite builds one fixture with Astro; run `node --test test/site/site.test.mjs`).
- No bundle identifiers, `.json` file names, build numbers or commit hashes in any visible text. Attributes and hrefs may still carry URLs.
- Tabs: Home, Apps, News. The `altsource status` command, `status.json` and the CI summary stay.
- Hero button copy: "Add to AltStore" for All, PAL and Classic; "Add to SideStore" for SideStore. Share is icon-only under 1000 px with `aria-label="Share"`.
- Copy rows in the Add sheet: "Copy PAL link" (`data-stores="pal"`) and "Copy Classic link" (`data-stores="classic sidestore"`).
- Commit after every task with the repo's trailer lines.

---

### Task 1: Three tabs, Status page removed, README updated

**Files:**
- Modify: `site/src/lib/nav.mjs`, `test/site/nav.test.mjs`, `test/site/site.test.mjs`, `README.md`
- Delete: `site/src/pages/status/index.astro`

- [ ] **Step 1: Failing tests**

`test/site/nav.test.mjs` — first test becomes:

```js
test('navItems are Home, Apps, News under the base path with a Hugeicon each', () => {
  assert.deepEqual(navItems(base).map((i) => [i.label, i.href]), [['Home', '/altsource/'], ['Apps', '/altsource/apps/'], ['News', '/altsource/news/']]);
  for (const i of navItems(base)) assert.match(i.icon, /Icon$/);
});
```

`test/site/site.test.mjs`:
- In the first test's file list remove `'status/index.html'` and add after the loop: `assert.equal(await exists('status/index.html'), false, 'the Status page is gone');`
- In `shell:` change `4, 'four tabs'` to `3, 'three tabs'` and add `assert.equal((html.match(/<aside[\s\S]*?<\/aside>/)[0].match(/aria-label="Primary"[\s\S]*?<\/ul>/)[0].match(/<li>/g) ?? []).length, 3, 'three sidebar rows');`
- Remove `'status/index.html'` from the page lists in `every internal link resolves…` and `remaining pages…`.

- [ ] **Step 2: Run** `node --test test/site/nav.test.mjs test/site/site.test.mjs` — FAIL (four items, page still built).

- [ ] **Step 3: Implement**

`site/src/lib/nav.mjs`:

```js
/** Primary navigation shared by the desktop sidebar and the phone tab bar. */
export const navItems = (base) => [
  { label: 'Home', href: base, icon: 'Home01Icon' },
  { label: 'Apps', href: `${base}apps/`, icon: 'Grid2X2Icon' },
  { label: 'News', href: `${base}news/`, icon: 'News01Icon' },
];
```

(keep `isCurrent` as is). Delete the page: `git rm -r site/src/pages/status`.

`README.md`:
- Line 10: `(apps, news, status)` → `(apps, news)`.
- Site section, desktop bullet: `Home / Apps / News / Status` → `Home / Apps / News`.
- Automation table, `links.yml` row: `redeploys the status page.` → `redeploys.`
- Replace the paragraph starting `The status dashboard lives at` with:

```
`altsource status` prints the maintainer report (counts, local vs upstream version per app, recent sync activity, broken
links); the deploy job writes the same data to `status.json` next to the sources and to the Actions step summary. There is
no status page on the site.
```

Also check `grep -rn status test/cli/serve.test.mjs src/cli/serve.mjs`; if the serve test requests `/status/`, change that request to `/news/` with the same expectation.

- [ ] **Step 4: Run** the two test files (and `node --test test/cli/serve.test.mjs` if touched) — passing.

- [ ] **Step 5: Commit**

```bash
git add -A site/src/lib/nav.mjs site/src/pages/status test/site README.md test/cli/serve.test.mjs
git commit -m "feat(site): three tabs — the Status page is gone; the CLI report stays"
```

### Task 2: Settings sheet and the always-visible nav bar action

**Files:**
- Create: `site/src/components/SettingsSheet.astro`
- Modify: `site/src/components/NavBar.astro` (`actions` slot), `site/src/styles/global.css` (`.navbar-action`), `site/src/pages/index.astro` (gear + sheet)
- Test: `test/site/site.test.mjs`

**Interfaces:**
- Produces: `<NavBar>` accepts `<slot name="actions">` (rendered always, even before collapse); `<SettingsSheet />` renders `<dialog id="settings">`.

- [ ] **Step 1: Failing test**

```js
test('home: a gear in the bar opens the Settings sheet with appearance, project links and the store note', async () => {
  const html = await page('index.html');
  assert.match(html, /<button type="button" class="navbar-action[^"]*" data-sheet="settings" aria-label="Settings" aria-haspopup="dialog">\s*<svg/, 'gear in the nav bar');
  const sheet = html.match(/<dialog id="settings"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(sheet, 'settings dialog');
  assert.match(sheet, /class="sheet[^"]*lg:hidden/, 'phones and tablets only');
  assert.match(sheet, /role="radiogroup" aria-label="Appearance"/, 'appearance control inside');
  assert.match(sheet, /<a href="https:\/\/example\.org\/repo" rel="noopener" class="info-row[^"]*"><span>Website<\/span>/, 'website row');
  assert.doesNotMatch(sheet, /Report a problem/, 'no issues row when the website is not GitHub');
  assert.match(sheet, /AltStore PAL installs notarized apps in the EU, Japan and Brazil\. AltStore Classic and SideStore sideload apps everywhere\./);
  assert.doesNotMatch(await page('apps/index.html'), /data-sheet="settings"/, 'only the home bar has the gear');
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`site/src/components/SettingsSheet.astro`:

```astro
---
import Sheet from './Sheet.astro';
import ThemeToggle from './ThemeToggle.astro';
import Icon from './Icon.astro';
import { getSite } from '../lib/data.mjs';
/** Settings bottom sheet for phones and tablets: appearance, project links, the one-line store note. Opened by the gear in the home nav bar. */
const site = await getSite();
const website = site.meta.website ? site.meta.website.replace(/\/$/, '') : null;
const github = website ? /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(website) : false;
const rows = [
  website && { label: github ? 'Source on GitHub' : 'Website', href: website },
  github && { label: 'Report a problem', href: `${website}/issues` },
].filter(Boolean);
---
<Sheet id="settings" title="Settings" class="lg:hidden">
  <section aria-labelledby="settings-appearance">
    <h3 id="settings-appearance" class="mb-2 px-1 t-footnote-em uppercase text-label-2">Appearance</h3>
    <ThemeToggle />
  </section>
  {rows.length > 0 && (
    <section class="mt-6" aria-labelledby="settings-about">
      <h3 id="settings-about" class="mb-2 px-1 t-footnote-em uppercase text-label-2">About</h3>
      <div class="info">
        {rows.map((r) => <a href={r.href} rel="noopener" class="info-row items-center text-key"><span>{r.label}</span><Icon name="ArrowUpRight01Icon" class="size-4 shrink-0" strokeWidth={2} /></a>)}
      </div>
    </section>
  )}
  <p class="mt-6 px-1 t-footnote text-label-2">AltStore PAL installs notarized apps in the EU, Japan and Brazil. AltStore Classic and SideStore sideload apps everywhere.</p>
</Sheet>
```

`site/src/components/NavBar.astro` — replace the trailing `<div>`:

```astro
    <div class="relative flex min-w-11 items-center justify-end gap-1 pr-1">
      <div class="navbar-trailing flex items-center gap-2" data-nav-trailing>
        <slot name="trailing" />
      </div>
      <slot name="actions" />
    </div>
```

and extend the doc comment: "`actions` holds controls that stay visible before the bar collapses (the home gear)."

`site/src/styles/global.css` — after the `.navbar[data-collapsed] :is(.navbar-title, .navbar-trailing)` rule:

```css
.navbar-action { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 9999px; color: var(--key); transition: color 0.2s ease-out, background-color 0.2s ease-out; }
.navbar-action:active { opacity: 0.6; }
```

and in the M8c block change the tinted-back rule to cover both: `.navbar[data-tinted]:not([data-collapsed]) :is(.navbar-back, .navbar-action) { color: #fff; background: rgba(0, 0, 0, 0.25); }`.

`site/src/pages/index.astro`:
- import `SettingsSheet from '../components/SettingsSheet.astro'`.
- The NavBar becomes `<NavBar slot="nav" icon={meta.iconURL} tinted>` and gains, after the trailing span:

```astro
    <button slot="actions" type="button" class="navbar-action" data-sheet="settings" aria-label="Settings" aria-haspopup="dialog"><Icon name="Settings01Icon" class="size-6" strokeWidth={1.75} /></button>
```

- Before the closing `</Base>` add `<SettingsSheet />` (next to the add-source `ActionSheet`).

- [ ] **Step 4: Run** `node --test test/site/site.test.mjs` — passing (the existing bar regex `<header class="navbar[^"]*" data-navbar(?: data-tinted)?>` allows the new `data-tinted`).

- [ ] **Step 5: Commit**

```bash
git add site/src/components/SettingsSheet.astro site/src/components/NavBar.astro site/src/styles/global.css site/src/pages/index.astro test/site/site.test.mjs
git commit -m "feat(site): Settings sheet from a gear in the home bar"
```

### Task 3: Footer desktop-only; sidebar and footer without file names

**Files:**
- Modify: `site/src/components/Footer.astro`, `site/src/components/Sidebar.astro`, `site/src/layouts/Base.astro` (main bottom padding)
- Test: `test/site/site.test.mjs`

- [ ] **Step 1: Failing test**

```js
test('no file names anywhere: the footer is desktop-only with one GitHub link, the sidebar links GitHub, phones pad for the tab bar', async () => {
  const html = await page('index.html');
  assert.match(html, /<footer class="hidden bg-footer[^"]*lg:block">/, 'footer hidden under 1000px');
  assert.doesNotMatch(html, />source\.pal\.json<|>source\.json<|Source code</, 'no JSON file names or "Source code" labels in text');
  assert.match(html.match(/<footer[\s\S]*?<\/footer>/)[0], /<a class="[^"]*" href="https:\/\/example\.org\/repo" rel="noopener">GitHub<\/a>/, 'footer GitHub link');
  assert.doesNotMatch(html.match(/<footer[\s\S]*?<\/footer>/)[0], /aria-label="Appearance"/, 'no theme toggle in the footer');
  assert.match(html.match(/<aside[\s\S]*?<\/aside>/)[0], /aria-label="Appearance"[\s\S]*?<a class="[^"]*" href="https:\/\/example\.org\/repo" rel="noopener">GitHub<\/a>/, 'sidebar keeps appearance and links GitHub');
  assert.match(html, /<main id="main"[^>]*class="[^"]*pb-\[calc\(100px\+env\(safe-area-inset-bottom\)\)\][^"]*lg:pb-10/, 'main pads for the floating tab bar on phones');
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`site/src/components/Footer.astro`:

```astro
---
import { getSite } from '../lib/data.mjs';
/** App Store footer, desktop only: one line about the stores and the project link. Phones get the Settings sheet instead. */
const site = await getSite();
---
<footer class="hidden bg-footer px-10 py-[15px] text-label-2 t-footnote lg:block">
  <div class="mx-auto flex max-w-[1680px] min-h-[58px] flex-wrap items-center justify-between gap-3">
    <p>{site.meta.name} · AltStore PAL installs notarized apps in the EU, Japan and Brazil. AltStore Classic and SideStore sideload apps everywhere.</p>
    {site.meta.website && <a class="hover:text-key" href={site.meta.website} rel="noopener">GitHub</a>}
  </div>
</footer>
```

`site/src/components/Sidebar.astro` — the bottom block:

```astro
  <div class="mt-auto px-[25px] pb-5">
    <ThemeToggle />
    {site.meta.website && <p class="mt-3 t-subhead text-label-2"><a class="hover:text-key" href={site.meta.website} rel="noopener">GitHub</a></p>}
  </div>
```

and the doc comment: "lockup, primary navigation, store switch, appearance, GitHub link".

`site/src/layouts/Base.astro` — the `<main>` class: replace `pb-10` with `pb-[calc(100px+env(safe-area-inset-bottom))] lg:pb-10`.

- [ ] **Step 4: Run** — passing.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/Footer.astro site/src/components/Sidebar.astro site/src/layouts/Base.astro test/site/site.test.mjs
git commit -m "feat(site): footer only on desktop; GitHub link instead of file names"
```

### Task 4: Home hero copy, icon-only Share, desktop-only chips, Add sheet with copy rows and QR codes

**Files:**
- Modify: `site/src/pages/index.astro`, `site/src/components/ActionSheet.astro`, `site/src/components/SourceURLChip.astro` (drop its script), `site/src/layouts/Base.astro` (shared copy script), `site/src/lib/data.mjs` (`qr`), `site/src/styles/global.css` (`.sheet-qr`)
- Test: `test/site/site.test.mjs`, `test/site/data.test.mjs`

**Interfaces:**
- Produces: `getSite().qr = { pal: '<svg…', classic: '<svg…' }`; `ActionSheet` props `actions[].copy` and `qr: [{ label, svg, stores? }]`; one `[data-copy]` click handler in `Base.astro` that swaps `[data-copy-label]` text to "Copied" and toggles `[data-copy-icon]`/`[data-copied-icon]`.

- [ ] **Step 1: Failing tests**

`test/site/data.test.mjs` (`getSite merges…`): `assert.match(s.qr.pal, /^<svg/, 'QR for the PAL universal link'); assert.match(s.qr.classic, /^<svg/);`

`test/site/site.test.mjs` — in `home: hero ribbon…` change the PAL line to expect `data-store-only="pal">Add to AltStore<` and add:

```js
  assert.match(html, /class="get get-blue[^"]*" data-store-only="classic">Add to AltStore</, 'Classic label is store-neutral too');
  assert.match(html, /<button type="button" class="get get-glass px-\[7px\] lg:gap-2 lg:px-4" data-share[^>]*aria-label="Share">\s*<svg[\s\S]*?<span class="hidden lg:inline">Share<\/span>/, 'icon-only share on phones');
  assert.match(html, /<div class="mt-4 hidden max-w-\[840px\] gap-2 lg:grid lg:grid-cols-2">/, 'URL chips only from 1000px');
```

In `sheets:` add:

```js
  assert.match(html, /<button type="button" data-copy="https:\/\/stixzoor\.github\.io\/altsource\/source\.pal\.json" class="sheet-action" data-stores="pal"><span data-copy-label>Copy PAL link<\/span><\/button>/, 'copy PAL row');
  assert.match(html, /data-copy="https:\/\/stixzoor\.github\.io\/altsource\/source\.json" class="sheet-action" data-stores="classic sidestore"><span data-copy-label>Copy Classic link<\/span>/, 'copy Classic row');
  assert.match(html, /<div class="sheet-qr hidden sm:grid">\s*<div class="sheet-qr-item" data-stores="pal"><div class="sheet-qr-tile"><svg/, 'QR tiles from 640px');
  assert.equal((html.match(/dataset\.copy\b/g) ?? []).length, 1, 'one copy script for chips and rows');
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`site/src/lib/data.mjs`: add `import { qrSVG } from '../../../src/lib/status.mjs';` and in `getSite` set `cache = { meta, base, urls, apps, featured, news, counts: {…}, qr: { pal: qrSVG(universalLink(urls.pal)), classic: qrSVG(universalLink(urls.classic)) } };`.

`site/src/components/ActionSheet.astro`:

```astro
---
/**
 * iOS action sheet: grouped actions and a Cancel row. `actions: [{ label, href, download?, primary?, stores?, copy? }]`;
 * a `copy` row copies that text instead of navigating. `qr: [{ label, svg, stores? }]` shows QR tiles from 640px.
 */
const { id, title, message, actions = [], qr = [] } = Astro.props;
---
<dialog id={id} class="sheet sheet-actions" aria-labelledby={`${id}-title`}>
  <div class="sheet-grabber" aria-hidden="true"></div>
  <div class="sheet-group">
    <div class="sheet-title"><span id={`${id}-title`} tabindex="-1" autofocus>{title}</span>{message && <p>{message}</p>}</div>
    {qr.length > 0 && (
      <div class="sheet-qr hidden sm:grid">
        {qr.map((q) => <div class="sheet-qr-item" data-stores={q.stores}><div class="sheet-qr-tile" set:html={q.svg}></div><p>{q.label}</p></div>)}
      </div>
    )}
    {actions.map((a) => a.copy
      ? <button type="button" data-copy={a.copy} class="sheet-action" data-stores={a.stores}><span data-copy-label>{a.label}</span></button>
      : <a href={a.href} download={a.download ? '' : undefined} class={`sheet-action ${a.primary ? 'font-semibold' : ''}`} data-stores={a.stores}>{a.label}</a>
    )}
  </div>
  <button type="button" data-close class="sheet-cancel">Cancel</button>
</dialog>
```

`site/src/styles/global.css` — in the M8c components block after the `.sheet-actions .sheet-grabber` rule:

```css
  .sheet-qr { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 4px 8px 12px; }
  .sheet-qr-tile { width: 120px; margin: 0 auto; padding: 6px; border-radius: 12px; background: #fff; }
  .sheet-qr-tile svg { display: block; width: 100%; height: auto; }
  .sheet-qr-item p { margin-top: 6px; text-align: center; font-size: calc(12 * var(--u)); line-height: 1.33; color: var(--label-2); }
```

`site/src/components/SourceURLChip.astro`: delete its `<script>…</script>` block (markup unchanged).

`site/src/layouts/Base.astro` — extend the body script with the shared copy handler:

```js
    for (const b of document.querySelectorAll('[data-copy]')) {
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); } catch { return; }
        const label = b.querySelector('[data-copy-label]'), icon = b.querySelector('[data-copy-icon]'), done = b.querySelector('[data-copied-icon]'), status = b.querySelector('[data-copy-status]');
        const was = label?.textContent;
        if (label) label.textContent = 'Copied';
        icon?.classList.add('hidden'); done?.classList.remove('hidden');
        if (status) status.textContent = 'Copied';
        setTimeout(() => { if (label) label.textContent = was; icon?.classList.remove('hidden'); done?.classList.add('hidden'); if (status) status.textContent = ''; }, 1500);
      });
    }
```

`site/src/pages/index.astro`:
- facts: append `.filter((f) => f.value !== '0')` to the array (zero counts disappear).
- links:

```js
const addLinks = [
  { store: 'pal', cta: 'Add to AltStore', label: 'Add to AltStore PAL', href: universalLink(site.urls.pal), primary: true },
  { store: 'classic', cta: 'Add to AltStore', label: 'Add to AltStore Classic', href: universalLink(site.urls.classic) },
  { store: 'sidestore', cta: 'Add to SideStore', label: 'Add to SideStore', href: `sidestore://source?url=${encodeURIComponent(site.urls.classic)}` },
];
const addActions = [
  ...addLinks.map(({ store, cta, ...a }) => a),
  { label: 'Copy PAL link', copy: site.urls.pal, stores: 'pal' },
  { label: 'Copy Classic link', copy: site.urls.classic, stores: 'classic sidestore' },
];
const qrs = [
  { label: 'AltStore PAL', svg: site.qr.pal, stores: 'pal' },
  { label: 'AltStore Classic · SideStore', svg: site.qr.classic, stores: 'classic sidestore' },
];
```

- hero buttons: `{addLinks.map((l) => <a href={l.href} class="get get-blue min-h-8" data-store-only={l.store}>{l.cta}</a>)}` and the Share button:

```astro
          <button type="button" class="get get-glass px-[7px] lg:gap-2 lg:px-4" data-share data-share-url={site.urls.pal} data-share-title={meta.name} aria-label="Share"><Icon name="Share01Icon" class="size-4" strokeWidth={2} /><span class="hidden lg:inline">Share</span></button>
```

- chips wrapper: `<div class="mt-4 hidden max-w-[840px] gap-2 lg:grid lg:grid-cols-2">` (replacing `mt-3 grid gap-2 sm:grid-cols-2 lg:mt-4 lg:max-w-[840px]`).
- sheet: `<ActionSheet id="add-source" title={`Add "${meta.name}"`} message="Choose the app you use. The source keeps your apps updated." actions={addActions} qr={qrs} />`.

- [ ] **Step 4: Run** `node --test test/site/data.test.mjs test/site/site.test.mjs` — passing. The older assertion `Add to AltStore PAL<\/a>` inside the sheet test still matches the sheet row (the sheet keeps the full labels).

- [ ] **Step 5: Commit**

```bash
git add site/src/pages/index.astro site/src/components/ActionSheet.astro site/src/components/SourceURLChip.astro site/src/layouts/Base.astro site/src/lib/data.mjs site/src/styles/global.css test/site
git commit -m "feat(site): store-neutral Add, icon-only Share on phones, copy rows and QR codes in the Add sheet"
```

### Task 5: App page without identifiers; project link; ribbon fade

**Files:**
- Modify: `site/src/pages/apps/[id]/index.astro`, `site/src/styles/global.css` (`.ribbon` mask)
- Test: `test/site/site.test.mjs`

- [ ] **Step 1: Failing tests**

Fixture: give `com.both` `upstream: { type: 'github', repo: 'o/r' }` (add to its `app(...)` overrides).

In `app pages: GET follows…` flip `assert.match(both, /Bundle ID/)` to `assert.doesNotMatch(both, /Bundle ID/)`.

In `app page: two heroes…` replace the information/download assertions with:

```js
  assert.match(both, /<span class="ribbon-label">Store<\/span>\s*<span class="ribbon-value">AltStore<\/span>\s*<span class="ribbon-sub">PAL · Classic<\/span>/, 'store fact');
  assert.match(both, /<dl class="info">[\s\S]*?<dt>Version<\/dt>\s*<dd>2\.0 · 1 Sept 2026<\/dd>/, 'version row without build');
  assert.match(both, /<dt>Available on<\/dt>\s*<dd>AltStore PAL, AltStore Classic, SideStore<\/dd>/, 'stores in words');
  assert.doesNotMatch(both, /<dt>Bundle ID|source JSON|Download \.ipa<span/, 'no identifiers or file links on the page');
  assert.match(both, /class="sheet-action[^"]*">Download \.ipa<\/a>/, 'the download stays in the Get sheet');
  assert.match(both, /<a href="https:\/\/github\.com\/o\/r" rel="noopener" class="[^"]*">Project on GitHub<span aria-hidden="true">↗<\/span><\/a>/, 'project link');
  assert.doesNotMatch(await page('apps/com.pal/index.html'), /Project on GitHub/, 'no project link without a GitHub upstream');
```

In `app page CSS` add: `assert.match(css, /\.ribbon\{[^}]*mask-image:linear-gradient\((?:to right|90deg),\s*#000 calc\(100% - 40px\),\s*(?:transparent|#0000)\)/, 'ribbon fade on phones');`

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`site/src/pages/apps/[id]/index.astro` frontmatter:

```js
const stores = kinds.map((k) => (k === 'adp' ? 'AltStore PAL' : 'AltStore Classic'));
const availableOn = kinds.map((k) => (k === 'adp' ? 'AltStore PAL' : 'AltStore Classic, SideStore')).join(', ');
const facts = [
  { label: 'Size', value: sizeValue, sub: sizeUnit },
  { label: 'Version', value: versionLabel(latest), sub: formatDate(latest.date) },
  ...(latest.minOSVersion ? [{ label: 'Requires', value: `iOS ${latest.minOSVersion}`, sub: 'or later' }] : []),
  { label: 'Developer', value: app.developerName, sub: 'developer' },
  { label: 'Category', value: categoryLabel(app.category), sub: 'category' },
  { label: 'Store', value: 'AltStore', sub: kinds.length === 2 ? 'PAL · Classic' : kinds[0] === 'adp' ? 'PAL' : 'Classic · SideStore' },
];
const info = [
  ['Developer', app.developerName],
  ['Size', latest.size ? formatBytes(latest.size) : null],
  ['Category', categoryLabel(app.category)],
  ['Compatibility', latest.minOSVersion ? `Requires iOS ${latest.minOSVersion} or later.` : null],
  ['Version', `${versionLabel(latest)} · ${formatDate(latest.date)}`],
  ['Available on', availableOn],
].filter(([, v]) => v);
```

(remove the old `stores`-based `Available on`/`Latest`/`Bundle ID` rows; keep `stores` for the price line). Replace the links paragraph after the `<dl>` with:

```astro
      {entry.project && <p class="mt-6 flex t-body text-key lg:justify-center lg:t-callout-em"><a href={entry.project.href} rel="noopener" class="hover:underline">{entry.project.label}<span aria-hidden="true">↗</span></a></p>}
```

More-by grid: `grid gap-2.5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 lg:gap-x-5 lg:gap-y-6`.

`site/src/styles/global.css` — `.ribbon` gains `mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent);` and the `@media (min-width: 1000px) .ribbon` rule gains `mask-image: none;`.

- [ ] **Step 4: Run** `node --test test/site/site.test.mjs` — passing.

- [ ] **Step 5: Commit**

```bash
git add 'site/src/pages/apps/[id]/index.astro' site/src/styles/global.css test/site/site.test.mjs
git commit -m "feat(site): app page without identifiers or file links; project link; ribbon fade"
```
