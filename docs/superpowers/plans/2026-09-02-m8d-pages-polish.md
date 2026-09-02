# M8d Pages, Polish and Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the remaining pages (Apps, News, Status, 404, version history) onto the Storefront tokens and components, retire the M6 aliases and unused components, verify every page in both colour schemes at four widths, document the result, and seed the live source with real sideloadable apps so the design is exercised end to end.

**Architecture:** No new subsystems. Pages adopt `t-*` type, `bg-surface`/`text-label-2`/`text-key` tokens, `AppRow`/`NewsCard`, the large-title bar and store-aware empty states; the search field gets an App Store treatment in `global.css`; the compatibility aliases in `@theme inline` go away once nothing references them, guarded by a test on the built HTML.

**Tech Stack:** Astro 7, Tailwind 4, node:test, Playwright MCP, the `altsource` CLI for seeding.

**Spec:** `docs/superpowers/specs/2026-09-02-m8-storefront-design.md` (§5.3, §5.4, §5.5, §8, §9).

## Global Constraints

- As before. Retired names after this milestone: `bg-background text-foreground bg-card text-muted-foreground border-border bg-glass text-primary bg-primary`, `var(--radius)`, `.snap-strip`, `SourceCard.astro`, `Badge.astro`.
- Search field: phones 38 px tall, radius 9, 16 px text (no zoom), `--fill` background; desktop 32 px, radius 4, 12 px text, 1 px `--label-divider` border, focus ring `0 0 0 4px` key colour at 60 %.
- Seeding only adds apps whose IPAs are published on GitHub Releases by their authors; nothing fabricated reaches the live source.

---

### Task 1: Apps, News, 404 and Version History pages on the tokens; search field

**Files:**
- Modify: `site/src/pages/apps/index.astro` (rewrite)
- Modify: `site/src/pages/news/index.astro` (rewrite)
- Modify: `site/src/pages/404.astro` (rewrite)
- Modify: `site/src/pages/apps/[id]/versions/index.astro` (rewrite)
- Modify: `site/src/components/Text.astro:10`
- Modify: `site/src/styles/global.css` (append)
- Test: `test/site/site.test.mjs`

- [ ] **Step 1: Write the failing test** — in `test/site/site.test.mjs` change the "more" test's `to-background` to `to-page`, then append:

```js
test('remaining pages: Apps search and rows with per-store empty states, News grid, 404, version history rows', async () => {
  const apps = await page('apps/index.html');
  assert.match(apps, /<input type="search" placeholder="Search" data-search class="search-field"/, 'search field');
  assert.match(apps, /data-app-list[\s\S]*?class="approw"[^>]*data-stores="pal"/, 'rows in a store-aware list');
  assert.match(apps, /data-empty data-empty-pal="Nothing for AltStore PAL yet\."/, 'per-store empty state on Apps');
  assert.doesNotMatch(apps, /screenshot 1/, 'the Apps page no longer previews screenshots');
  const news = await page('news/index.html');
  assert.match(news, /<h1 class="[^"]*t-large-title-em[^"]*">News<\/h1>/, 'News large title');
  assert.match(news, /class="newscard"[\s\S]*?First post/, 'news cards');
  const nf = await page('404.html');
  assert.match(nf, /<p class="t-header text-key">404<\/p>\s*<h1 class="[^"]*">That page does not exist\.<\/h1>/, '404 copy');
  assert.match(nf, /<a href="\/altsource\/" class="get get-blue">Home<\/a>/, '404 home pill');
  const versions = await page('apps/com.both/versions/index.html');
  assert.equal((versions.match(/data-version-row/g) ?? []).length, 3, 'version rows');
  for (const p of ['index.html', 'apps/index.html', 'apps/com.both/index.html', 'news/index.html', 'status/index.html', '404.html', 'apps/com.both/versions/index.html']) {
    assert.doesNotMatch(await page(p), /\b(bg-card|text-muted-foreground|bg-glass|text-primary|border-border|bg-background|text-foreground)\b|var\(--radius\)|snap-strip/, `${p} uses no retired names`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E 'AssertionError' | head -2`
Expected: the "more" test fails on `to-page` and the new test fails on `search field`.

- [ ] **Step 3: Write the pages**

`site/src/styles/global.css` (append):
```css

/* ==================== Search field (M8d): iOS on phones, App Store sidebar field from 1000px ==================== */
@layer components {
  .search-field { width: 100%; height: 38px; padding: 0 12px 0 36px; border-radius: 9px; border: 0; background: var(--fill); color: var(--label); font-size: max(16px, 1rem); outline: none; transition: box-shadow 0.14s ease-out; }
  .search-field::placeholder { color: var(--label-3); }
  .search-field:focus-visible { box-shadow: 0 0 0 4px color-mix(in srgb, var(--key) 60%, transparent); }
  @media (min-width: 1000px) {
    .search-field { height: 32px; padding-left: 30px; border-radius: 4px; border: 1px solid var(--label-divider); background: var(--page); font-size: calc(12 * var(--u)); }
  }
}
```

`site/src/pages/apps/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import NavBar from '../../components/NavBar.astro';
import Icon from '../../components/Icon.astro';
import AppRow from '../../components/AppRow.astro';
import { getSite } from '../../lib/data.mjs';
const { apps } = await getSite();
const base = import.meta.env.BASE_URL;
const emptyAttrs = { 'data-empty': '', 'data-empty-pal': 'Nothing for AltStore PAL yet.', 'data-empty-classic': 'Nothing for AltStore Classic yet.', 'data-empty-sidestore': 'Nothing for SideStore yet.' };
---
<Base title="Apps" description="Every app in this source." width="wide">
  <NavBar slot="nav" title="Apps" back={base} />
  <div class="flex flex-wrap items-end justify-between gap-4 pt-2 lg:pt-[11px]">
    <h1 class="t-large-title-em">Apps</h1>
    {apps.length > 0 && (
      <label class="relative block w-full lg:w-[260px]">
        <span class="sr-only">Search apps</span>
        <Icon name="Search01Icon" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label-3 lg:left-2.5 lg:size-3" strokeWidth={2} />
        <input type="search" placeholder="Search" data-search class="search-field" autocomplete="off" />
      </label>
    )}
  </div>
  <div data-nav-sentinel></div>
  {apps.length === 0 ? (
    <p class="mt-4 rounded-[20px] bg-surface p-6 text-center t-body text-label-2 lg:rounded-box">No apps yet.</p>
  ) : (
    <div class="mt-4" data-app-list>
      <div class="grid gap-2.5 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-6 xl:grid-cols-3 2xl:grid-cols-4">
        {apps.map((entry) => <AppRow entry={entry} morph />)}
      </div>
      <p class="hidden py-10 text-center t-body text-label-2" data-empty-search role="status">No apps match.</p>
      <p class="rounded-[20px] bg-surface p-6 text-center t-body text-label-2 lg:rounded-box" hidden {...emptyAttrs}></p>
    </div>
  )}
</Base>
<script>
  const search = document.querySelector('[data-search]');
  const list = document.querySelector('[data-app-list]');
  if (search && list) {
    const rows = [...list.querySelectorAll('[data-app]')];
    const empty = list.querySelector('[data-empty-search]');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const r of rows) { const ok = !q || r.dataset.name.includes(q); r.hidden = !ok; if (ok) shown++; }
      empty.hidden = shown > 0;
    });
  }
</script>
```

`site/src/pages/news/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import NavBar from '../../components/NavBar.astro';
import NewsCard from '../../components/NewsCard.astro';
import { getSite } from '../../lib/data.mjs';
const { news, apps } = await getSite();
const base = import.meta.env.BASE_URL;
---
<Base title="News" description="Announcements and updates." width="wide">
  <NavBar slot="nav" title="News" back={base} />
  <h1 class="t-large-title-em pt-2 lg:pt-[11px]">News</h1>
  <div data-nav-sentinel></div>
  {news.length === 0 ? (
    <p class="mt-4 rounded-[20px] bg-surface p-6 text-center t-body text-label-2 lg:rounded-box">Nothing yet.</p>
  ) : (
    <div class="mt-4 grid gap-5 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-6 xl:grid-cols-3">{news.map((item) => <NewsCard item={item} apps={apps} />)}</div>
  )}
</Base>
```

`site/src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import NavBar from '../components/NavBar.astro';
const base = import.meta.env.BASE_URL;
---
<Base title="Not found" noindex>
  <NavBar slot="nav" title="Not Found" back={base} />
  <div class="py-24 text-center">
    <p class="t-header text-key">404</p>
    <h1 class="mt-2 t-title-2-em">That page does not exist.</h1>
    <p class="mt-1 t-body text-label-2">Check the address, or start again from the source.</p>
    <p class="mt-6"><a href={base} class="get get-blue">Home</a></p>
  </div>
</Base>
```

`site/src/pages/apps/[id]/versions/index.astro`:
```astro
---
import Base from '../../../../layouts/Base.astro';
import NavBar from '../../../../components/NavBar.astro';
import Text from '../../../../components/Text.astro';
import { getSite, formatBytes, formatDate, versionLabel, inferKind, universalLink } from '../../../../lib/data.mjs';

export async function getStaticPaths() {
  const site = await getSite();
  return site.apps.map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}
const { entry } = Astro.props;
const site = await getSite();
const { app } = entry;
const base = import.meta.env.BASE_URL;
const link = (v) => (inferKind(v) === 'ipa' ? { href: v.downloadURL, label: 'Download .ipa', download: true } : { href: universalLink(site.urls.pal, app.bundleIdentifier), label: 'Get in AltStore PAL' });
---
<Base title={`${app.name} versions`} description={`Version history of ${app.name}.`} image={app.iconURL} tint={app.tintColor}>
  <NavBar slot="nav" title="Version History" back={`${base}apps/${encodeURIComponent(app.bundleIdentifier)}/`} />
  <h1 class="t-large-title-em pt-2 lg:pt-[11px]">Version History</h1>
  <p class="t-subhead text-label-2"><a href={`${base}apps/${encodeURIComponent(app.bundleIdentifier)}/`} class="text-key hover:underline">{app.name}</a></p>
  <div data-nav-sentinel></div>
  <ol class="mt-4 flex flex-col divide-y divide-separator">
    {app.versions.map((v) => { const l = link(v); return (
      <li class="py-4 first:pt-0" data-version-row>
        <div class="flex items-baseline justify-between gap-4"><p class="t-headline">{versionLabel(v)}</p><p class="t-subhead text-label-2">{formatDate(v.date)}</p></div>
        <p class="mt-0.5 t-footnote text-label-2">{[inferKind(v) === 'adp' ? 'AltStore PAL' : 'IPA', v.size ? formatBytes(v.size) : null, v.minOSVersion ? `iOS ${v.minOSVersion}+` : null].filter(Boolean).join(' · ')}</p>
        <div class="mt-2 t-body"><Text text={v.localizedDescription ?? 'No release notes.'} clamp={3} /></div>
        <a href={l.href} download={l.download ? '' : undefined} class="mt-2 inline-block t-subhead-em text-key hover:underline">{l.label}</a>
      </li>
    ); })}
  </ol>
</Base>
```

In `site/src/components/Text.astro` line 10, replace `via-background via-35% to-background` with `via-page via-35% to-page` and `text-primary` with `text-key`.

- [ ] **Step 4: Run the site tests**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)|AssertionError'`
Expected: only `status/index.html uses no retired names` still fails (Task 2).

---

### Task 2: Status page tokens; retire aliases and unused components

**Files:**
- Modify: `site/src/pages/status/index.astro` (class replacements)
- Modify: `site/src/styles/global.css` (remove the alias block, `--radius`, `.snap-strip`)
- Delete: `site/src/components/SourceCard.astro`, `site/src/components/Badge.astro`
- Test: `test/site/site.test.mjs` (Task 1's test)

- [ ] **Step 1: Replace classes in `status/index.astro`** (every occurrence): `text-muted-foreground` → `text-label-2`; `bg-card` → `bg-surface`; `rounded-[var(--radius)]` → `rounded-box`; `text-primary` → `text-key`; `border-border` → `border-separator`; `text-[0.75em] text-label-2` (tile labels, after the first replacement) → `t-subhead-em uppercase text-label-2`; `text-2xl font-bold` → `t-title-1-em`; `[&_th]:text-[0.75em] [&_th]:uppercase` → `[&_th]:t-subhead-em [&_th]:uppercase`; `text-[0.9em]` → `t-body`; `text-[0.85em]` → `t-subhead`; the JS `badge()` and `div.innerHTML` strings that contain `text-muted-foreground`/`text-primary`/`rounded-[var(--radius)]`/`bg-card` get the same replacements.

- [ ] **Step 2: Remove the aliases** — in `global.css` delete the eight `/* M6 names … */` lines (`--color-background` … `--color-primary-foreground`) from `@theme inline`, delete `--radius: 1.5rem; /* M6 card radius … */`, delete `.snap-strip { scrollbar-width: thin; }`. Delete `site/src/components/SourceCard.astro` and `site/src/components/Badge.astro`.

- [ ] **Step 3: Run the full suite**

Run: `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)|AssertionError'`
Expected: all pass. If Astro reports an unknown utility, a page still uses a retired name; the failing assertion names the page.

- [ ] **Step 4: Commit**

```bash
git add site/src test/site/site.test.mjs
git commit -m "feat(site): Apps, News, 404, Status and Version History on the Storefront tokens; retire M6 aliases"
```

---

### Task 3: Verification in both colour schemes

- [ ] **Step 1:** Rebuild the seed preview (port 4200).
- [ ] **Step 2:** Playwright: Apps page at 390 and 1280 (search, rows, switch to SideStore → the PAL-only row hides and the empty message appears only when nothing is left); News at 390 and 1280; Status at 1280; 404 at 390; then with `document.documentElement.classList.replace('light','dark')` the home page and an app page at 390 and 1280 (page black on phones, `#1f1f1f` on desktop, cards `#1c1c1e`/white 5 %, glass bar, hero unchanged, ribbon values `#c7c7cc`).
- [ ] **Step 3:** Fix in one pass, `npm test`, commit `fix(site): …`.

---

### Task 4: Docs and knowledge

- [ ] **Step 1:** README: in the website section describe the shell (sidebar from 1000 px, floating tab bar on phones), the store switch (`data-store`, `data-stores`, `data-store-only`), the type scales, the brand assets and `npm run assets:brand`. Keep the command table accurate.
- [ ] **Step 2:** Mark the M8 spec status line "shipped 2026-09-02"; update `~/Vault/Projects/altsource.md` and the memory file with M8 and the verified/unverified state.
- [ ] **Step 3:** Commit `docs: M8 storefront`, merge to main, push, watch the deploy.

---

### Task 5: Seed real apps

- [ ] **Step 1:** From the repo root, add apps whose IPAs are on GitHub Releases, one at a time, checking each result:

```bash
node bin/altsource.mjs app add --from-github illuminati945/NuvioMobile-iOS --upstream --category entertainment
node bin/altsource.mjs app add --from-github utmapp/UTM --upstream --asset 'UTM.ipa' --category utilities --subtitle "Virtual machines for iOS"
node bin/altsource.mjs app add --from-github Provenance-Emu/Provenance --upstream --asset '*.ipa' --category games
node bin/altsource.mjs app add --from-github PojavLauncherTeam/PojavLauncher_iOS --upstream --asset '*.ipa' --category games
```
Each run downloads the IPA to read `Info.plist` and entitlements; keep the notes it prints (icon fallbacks) and fix obvious gaps with `--icon`/`--tint` reruns using `--force`.

- [ ] **Step 2:** Set `featuredApps` in `source.meta.json` to the added bundle identifiers (in the order they should appear), add a news item with `node bin/altsource.mjs news add` announcing the first apps, then `npm run validate` and `npm test`.
- [ ] **Step 3:** Commit `content: first apps`, push, watch the deploy, and check the live home page shows Today cards and rows; open one app page.
