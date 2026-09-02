# M9c — Native polish and QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page behave like an app on real phones and tablets (no sideways scroll, press states, no text selection on controls, two-column rows on iPad), verify every viewport in Chromium and WebKit, fix what the pass finds, update the docs and ship.

**Architecture:** CSS-only rules in `site/src/styles/global.css` asserted through the built CSS; grid tweaks on two pages; a scratchpad Playwright script that screenshots every route at seven sizes in two engines and asserts `scrollWidth === innerWidth`; README and vault updates; push to `main` (deploy is automatic) and a live check.

**Tech Stack:** Tailwind 4, Playwright (Chromium through the MCP server, WebKit through `npx playwright`), `gh` for the deploy run.

**Spec:** `docs/superpowers/specs/2026-09-02-m9-finish-design.md` (sections 3.4, 4.1/4.3 row grids, 6 visual pass, 7).

## Global Constraints

- `html, body { overflow-x: clip }`; no page may be wider than the viewport at 320, 375, 390, 430, 768, 1024, 1280 or 1580 px.
- Controls (`.approw, .pill, .get, .segment, .tabbar a, .sheet-action, .navbar-back, .navbar-action, .today, .newscard`) are not text-selectable and dim on press.
- App rows: two columns from 640 px on Home (phone list), Apps and More by.
- Deploy only from `main` after `npm test` passes locally.

---

### Task 1: Body and touch rules

**Files:**
- Modify: `site/src/styles/global.css`
- Test: `test/site/site.test.mjs`

- [ ] **Step 1: Failing test**

```js
test('native feel CSS: no sideways scroll, controls are not selectable and dim on press, balanced headings', async () => {
  const css = await allCss();
  assert.match(css, /html,body\{[^}]*overflow-x:clip/, 'clip horizontal overflow');
  assert.match(css, /\.approw,\.pill,\.get,\.segment,\.tabbar a,\.sheet-action,\.navbar-back,\.navbar-action,\.today,\.newscard\{[^}]*user-select:none/, 'controls are not selectable');
  assert.match(css, /\.today:active\{[^}]*opacity:\.85/, 'Today card press state');
  assert.match(css, /h1,h2,h3\{[^}]*text-wrap:balance/, 'balanced headings');
});
```

- [ ] **Step 2: Run** `node --test test/site/site.test.mjs` — FAIL.

- [ ] **Step 3: Implement** — in `@layer base` after the `html {…}` line add `html, body { overflow-x: clip; }`. In the M8b `@layer components` block after the `.newscard` rules add:

```css
/* Controls behave like native ones: no text selection, a press state */
.approw, .pill, .get, .segment, .tabbar a, .sheet-action, .navbar-back, .navbar-action, .today, .newscard { -webkit-user-select: none; user-select: none; }
.today:active { opacity: 0.85; }
```

- [ ] **Step 4: Run** — passing. If Lightning CSS reorders the selector list, copy the exact emitted order from the built CSS into the assertion (the rule content is the contract).

- [ ] **Step 5: Commit**

```bash
git add site/src/styles/global.css test/site/site.test.mjs
git commit -m "feat(site): native feel — clip sideways scroll, unselectable controls with press states"
```

### Task 2: Two-column rows from 640 px

**Files:**
- Modify: `site/src/pages/index.astro` (phone rows), `site/src/pages/apps/index.astro`
- Test: `test/site/site.test.mjs`

- [ ] **Step 1: Failing test**

```js
test('app rows sit in two columns from 640px on Home, Apps and More by', async () => {
  assert.match(await page('index.html'), /<div class="lg:hidden" data-app-list>[\s\S]*?<div class="grid gap-2\.5 sm:grid-cols-2">/, 'home phone list');
  assert.match(await page('apps/index.html'), /<div class="grid gap-2\.5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-6 xl:grid-cols-3 2xl:grid-cols-4">/, 'apps index');
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** — `index.astro`: `<div class="grid gap-2.5">{rows.map(…)}</div>` → `<div class="grid gap-2.5 sm:grid-cols-2">`. `apps/index.astro`: `grid gap-2.5 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-6 xl:grid-cols-3 2xl:grid-cols-4` → `grid gap-2.5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-x-5 lg:gap-y-6 xl:grid-cols-3 2xl:grid-cols-4`. (More by was done in M9b Task 5.)

- [ ] **Step 4: Run** — passing.

- [ ] **Step 5: Commit**

```bash
git add site/src/pages/index.astro site/src/pages/apps/index.astro test/site/site.test.mjs
git commit -m "feat(site): two-column app rows from 640px"
```

### Task 3: Viewport pass in Chromium and WebKit, with fixes

**Files:**
- Create (machine-local, scratchpad): `qa.mjs`
- Modify: whatever the pass finds (each fix gets its own failing assertion in `test/site/site.test.mjs` when it is markup or CSS).

- [ ] **Step 1: Build and serve the real content locally**

```bash
npm run build && (lsof -t -iTCP:4321 | xargs -r kill); npx astro preview --root site --port 4321 &
```

(`site/astro.config.*` reads `ALTSOURCE_ROOT` etc.; the repo root is the default. If preview refuses the port, pick another and pass it to the script.)

- [ ] **Step 2: Write the script** in the scratchpad directory:

```js
// qa.mjs — screenshots every route at every size in both engines and fails on sideways scroll
import { chromium, webkit } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4321/altsource';
const routes = ['/', '/apps/', '/apps/com.utmapp.UTM/', '/apps/org.provenance-emu.provenance/', '/news/', '/404.html'];
const sizes = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 900], [1580, 1000]];
const dir = new URL('./shots/', import.meta.url).pathname;
await (await import('node:fs/promises')).mkdir(dir, { recursive: true });
let bad = 0;
for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ colorScheme: scheme, deviceScaleFactor: 2, isMobile: false });
    const page = await ctx.newPage();
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      for (const r of routes) {
        await page.goto(base + r, { waitUntil: 'networkidle' });
        const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, wide: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map((e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').slice(0, 2).join('.') : '')) }));
        if (over.sw > over.iw) { bad++; console.log(`OVERFLOW ${name} ${scheme} ${w}x${h} ${r}: ${over.sw} > ${over.iw} ${over.wide.join(', ')}`); }
        if (name === 'webkit' || w === 390 || w === 1280) await page.screenshot({ path: `${dir}${name}-${scheme}-${w}${r.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true, animations: 'disabled' });
      }
    }
    await ctx.close();
  }
  await browser.close();
}
console.log(bad ? `${bad} overflow(s)` : 'no overflow'); process.exit(bad ? 1 : 0);
```

Run: `cd <scratchpad> && npm init -y >/dev/null && npm i playwright@latest && npx playwright install webkit chromium && node qa.mjs`

- [ ] **Step 3: Read the screenshots** (the 390 and 1280 sets in both schemes, and every WebKit set) with the image viewer. Look for: text or buttons cut at the viewport edge, wrapped hero buttons, the Settings gear over the hero, the Add sheet on 768 showing QR tiles, the ribbon fade, tinted rows in two columns at 768, real icons and screenshots on the app pages, Markdown notes with bold subheads and bullets, no raw entitlement keys, the version sheet, dark mode surfaces, the 404.

- [ ] **Step 4: Fix each finding** — a markup or CSS fix gets a failing assertion in `test/site/site.test.mjs` first, then the change, then `node --test test/site/site.test.mjs`. Re-run `node qa.mjs` until it prints `no overflow` and the screenshots look right. Typical fixes to expect: a long developer name overflowing a ribbon column (`overflow-wrap: anywhere` on `.ribbon-value` only from 1000 px, `white-space: nowrap` stays on phones because the strip scrolls), the phone hero tile crowding the wordmark at 320 px (`size-20` under `xs`), the Version History sheet wider than 320 px (`width: min(28rem, calc(100vw - 32px))`).

- [ ] **Step 5: Commit the fixes**

```bash
git add site test/site
git commit -m "fix(site): viewport pass — <what was fixed>"
```

### Task 4: Docs, vault, ship

**Files:**
- Modify: `README.md` (Site section), `docs/superpowers/specs/2026-09-02-m9-finish-design.md` (status line), `~/Vault/Projects/altsource.md`, `~/Vault/Resources/native-feel-web-patterns.md` (only if the pass taught something new)

- [ ] **Step 1: README Site section** — phones bullet: replace "safe-area padding." with "safe-area padding, a Settings sheet (appearance, project links) from the gear in the home bar instead of a footer, and nothing technical on screen (no identifiers, file names or build numbers)." Add a bullet:

```
- **Content.** `altsource app assets <bundleId> --icon … --screenshot …` vendors icons (1024 px PNG) and screenshots
  (JPEG ≤ 1600 px tall) under `assets/apps/<bundleId>/` and writes them into the app JSON; release notes and
  descriptions are Markdown rendered through an allowlist (`site/src/lib/notes.mjs`), with installation/issue
  sections and tables dropped.
```

Add the command to the `## Commands` list next to the other `app` lines.

- [ ] **Step 2: Spec status** — first line under the title: `Status: shipped 2026-09-02 (M9a–c).`

- [ ] **Step 3: Vault** — append to `~/Vault/Projects/altsource.md` under the milestones list:

```
- [x] M9 finish (2026-09-02): `app assets` command vendors icons/screenshots; Markdown release notes; Status page removed (3 tabs); Settings sheet on phones instead of a footer; store-neutral Add, icon-only Share; copy rows + QR in the Add sheet; app page without identifiers; native-feel CSS; viewport pass in Chromium and WebKit.
```

- [ ] **Step 4: Test, push, watch**

```bash
npm test && git push origin main && gh run watch --exit-status $(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

- [ ] **Step 5: Live check** — with Playwright (MCP) at 390 and 1280: `https://stixzoor.github.io/altsource/`, `/apps/com.utmapp.UTM/`, `/apps/`; confirm the real UTM icon and screenshots load, no `/status/` link in the tab bar, the gear opens Settings, the ribbon fades, and `document.documentElement.scrollWidth === innerWidth`.

- [ ] **Step 6: Commit docs**

```bash
git add README.md docs/superpowers/specs/2026-09-02-m9-finish-design.md
git commit -m "docs: M9 shipped — content command, Settings sheet, three tabs"
git push origin main
```
