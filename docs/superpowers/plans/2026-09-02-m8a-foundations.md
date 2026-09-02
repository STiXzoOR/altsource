# M8a Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every page inside the Storefront shell: App Store tokens and two type scales, a desktop sidebar, a transparent-then-glass phone bar with chevron back and large titles, a floating tab bar, the store switch state, PWA metas and a manifest, and the 180 px touch icon.

**Architecture:** Design tokens live in `site/src/styles/global.css` as CSS custom properties resolved with `light-dark()` and exposed to Tailwind through `@theme inline`; type sizes are `@utility` classes reading `--fs-*`/`--lh-*` variables that switch at 1000 px and scale with iOS Dynamic Type through a `--u` unit. The shell is composed in `Base.astro` from `Sidebar`, `NavBar`, `TabBar` and `Footer`; shared nav and store definitions sit in `site/src/lib/nav.mjs` and `site/src/lib/stores.mjs` so the sidebar, tab bar, switch and (later) install buttons agree. Pages keep their content; they only adopt the new `NavBar` API and render visible large titles.

**Tech Stack:** Astro 7, Tailwind 4 (`@theme`, `@utility`, `light-dark()`), node:test, sharp, Playwright MCP for viewport checks.

**Spec:** `docs/superpowers/specs/2026-09-02-m8-storefront-design.md` (§2 Shell, §2.3 Head, §3 Tokens, §4 store state, §7, §8).

## Global Constraints

- Breakpoints: `xs 484`, `lg 1000`, `xl 1260`, `2xl 1580`, `3xl 1940` (Tailwind's `sm 640` and `md 768` stay). Gutters 16 px below 484, 25 px to 999, 40 px from 1000.
- Colour tokens use `light-dark()`; `color-scheme` is set on `:root` and forced by `.dark` / `.light`.
- The fixed header never carries `backdrop-filter`; only its `.navbar-material` child does, declared unprefixed only (Lightning CSS collapses a prefixed pair into the last one).
- No maintainer links on public pages (existing test); Hugeicons only; every control ≥ 44 px hit area on phones; all type in rem.
- Commit after every task with a conventional message; `npm test` must be green before each commit.
- Plan code blocks introduced by a line of the form `` `path/to/file`: `` are the complete file contents (materialize them verbatim).

---

### Task 1: Tokens, type scales and base layer

**Files:**
- Modify: `site/src/styles/global.css` (rewrite)
- Modify: `site/src/lib/tint.mjs:2`
- Modify: `test/site/tint.test.mjs:21`
- Test: `test/site/site.test.mjs`

**Interfaces:**
- Produces: Tailwind utilities `bg-page text-label text-label-2 text-label-3 border-separator border-divider bg-fill bg-fill-2 bg-sidebar bg-sidebar-selected bg-footer text-ribbon bg-material text-key bg-key text-red`, radius utilities `rounded-mini rounded-chip rounded-box rounded-card rounded-tile`, breakpoints `xs: lg: xl: 2xl: 3xl:`, type utilities `t-large-title[-em] t-header t-title-1[-em] t-title-2[-em] t-title-3[-em] t-headline t-body[-em] t-body-tall t-callout[-em] t-subhead[-em] t-footnote[-em] t-caption[-em]`, CSS classes `.navbar .navbar-material .navbar-title .navbar-trailing .tabbar .segmented .segment .hero-midnight .wordmark-lockup`, and the store-filter rules on `html[data-store]`. Old names (`bg-background text-foreground bg-card text-muted-foreground border-border bg-glass text-primary bg-primary`) keep working as aliases.

- [ ] **Step 1: Write the failing test** — replace the existing CSS guard test and add the token assertions. In `test/site/site.test.mjs`, replace the whole test `home nav bar overlays the hero, transparent until scrolled, with the lockup on the left; other pages keep the sticky bar with a centred title` with the two tests below (the second is completed in Task 4; add it now so it stays red until then), and add the `allCss` helper next to `page`/`exists`:

```js
const allCss = async () => (await Promise.all((await readdir(path.join(out, '_astro'))).filter((f) => f.endsWith('.css')).map((f) => page(path.join('_astro', f))))).join('');
```

```js
test('tokens: light-dark colours, the two type scales, the store filter rule, and a material that only the bar layer carries', async () => {
  const css = await allCss();
  assert.match(css, /--page:light-dark\(#fff,#000\)/, 'phone page colour');
  assert.match(css, /--page:light-dark\(#fff,#1f1f1f\)/, 'desktop page colour');
  assert.match(css, /--fs-large-title:calc\(34\s*\*\s*var\(--u\)\)/, 'iOS large title');
  assert.match(css, /--fs-large-title:calc\(26\s*\*\s*var\(--u\)\)/, 'App Store large title');
  assert.match(css, /--fs-body:calc\(17\s*\*\s*var\(--u\)\)/, 'iOS body');
  assert.match(css, /--fs-body:calc\(13\s*\*\s*var\(--u\)\)/, 'App Store body');
  assert.match(css, /font:-apple-system-body/, 'Dynamic Type');
  assert.match(css, /\[data-stores\]:not\(\[data-stores~=\\?"?pal\\?"?\]\)/, 'store filter rule');
  assert.match(css, /\.navbar-material\{[^}]*backdrop-filter:blur\(20px\)\s*saturate\(180%\)/, 'bar material');
  assert.doesNotMatch(css.match(/\.navbar\{[^}]*\}/)?.[0] ?? '', /backdrop-filter/, 'the fixed header itself never blurs');
  assert.match(css, /\.tabbar\{[^}]*position:fixed/, 'floating tab bar');
  assert.match(css, /\.segmented\{/, 'segmented control');
});

test('nav bar: transparent fixed bar with a material layer, chevron-only back, large titles with a sentinel; the 404 has no large title', async () => {
  for (const p of ['index.html', 'apps/index.html', 'apps/com.pal/index.html', '404.html']) {
    assert.match(await page(p), /<header class="navbar[^"]*" data-navbar>\s*<div class="navbar-material" aria-hidden="true"><\/div>/, `${p} bar`);
  }
  const apps = await page('apps/index.html');
  assert.match(apps, /<a href="\/altsource\/" class="[^"]*" aria-label="Back"><svg/, 'back is a chevron with an accessible name and no text');
  assert.match(apps, /<h1 class="[^"]*t-large-title-em[^"]*">Apps<\/h1>\s*<div data-nav-sentinel/, 'large title followed by the sentinel');
  assert.match(apps, /data-nav-title aria-hidden="true"[\s\S]*?<p class="truncate">Apps<\/p>/, 'small title is hidden until collapsed');
  assert.doesNotMatch(await page('404.html'), /data-nav-sentinel/, 'no large title on the 404');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)|AssertionError'`
Expected: both new tests FAIL (`--page:light-dark(#fff,#000)` missing; `navbar-material` missing).

- [ ] **Step 3: Write the stylesheet**

`site/src/styles/global.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

/* App Store web breakpoints: 484 / 1000 / 1260 / 1580 / 1940. sm (640) and md (768) stay for phone-to-tablet steps. */
@theme {
  --breakpoint-xs: 484px;
  --breakpoint-lg: 1000px;
  --breakpoint-xl: 1260px;
  --breakpoint-2xl: 1580px;
  --breakpoint-3xl: 1940px;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-wordmark: "Chakra Petch", system-ui, sans-serif;
  --radius-mini: 5px;
  --radius-chip: 9px;
  --radius-box: 12px;
  --radius-card: 17px;
  --radius-tile: 24px;
  --shadow-sm: 0 3px 9px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 3px 20px rgba(0, 0, 0, 0.08);
  --ease-standard: cubic-bezier(0.4, 0, 0.6, 1);
  --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);
}

@theme inline {
  --color-page: var(--page);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-label: var(--label);
  --color-label-2: var(--label-2);
  --color-label-3: var(--label-3);
  --color-label-4: var(--label-4);
  --color-separator: var(--separator);
  --color-divider: var(--label-divider);
  --color-fill: var(--fill);
  --color-fill-2: var(--fill-2);
  --color-sidebar: var(--sidebar);
  --color-sidebar-selected: var(--sidebar-selected);
  --color-footer: var(--footer);
  --color-ribbon: var(--ribbon-value);
  --color-material: var(--material);
  --color-key: var(--key);
  --color-tint: var(--tint);
  --color-red: var(--red);
  /* M6 names, kept until every page has moved to the tokens above */
  --color-background: var(--page);
  --color-foreground: var(--label);
  --color-card: var(--surface);
  --color-muted-foreground: var(--label-2);
  --color-border: var(--separator);
  --color-glass: var(--material);
  --color-primary: var(--key);
  --color-primary-foreground: #ffffff;
}

/* ---------- colour ---------- */
:root {
  color-scheme: light dark;
  --page: light-dark(#ffffff, #000000);
  --surface: light-dark(rgba(0, 0, 0, 0.05), #1c1c1e);
  --surface-2: light-dark(#f2f2f7, #2c2c2e);
  --label: light-dark(#000000, #ffffff);
  --label-2: light-dark(rgba(60, 60, 67, 0.6), rgba(235, 235, 245, 0.6));
  --label-3: light-dark(rgba(60, 60, 67, 0.3), rgba(235, 235, 245, 0.3));
  --label-4: light-dark(rgba(60, 60, 67, 0.18), rgba(235, 235, 245, 0.18));
  --separator: light-dark(rgba(60, 60, 67, 0.29), rgba(84, 84, 88, 0.6));
  --label-divider: light-dark(rgba(0, 0, 0, 0.15), rgba(255, 255, 255, 0.1));
  --fill: light-dark(rgba(120, 120, 128, 0.2), rgba(120, 120, 128, 0.36));
  --fill-2: light-dark(rgba(120, 120, 128, 0.16), rgba(120, 120, 128, 0.32));
  --sidebar: light-dark(rgba(60, 60, 67, 0.03), rgba(235, 235, 245, 0.03));
  --sidebar-selected: light-dark(rgba(31, 31, 31, 0.07), rgba(255, 255, 255, 0.08));
  --footer: light-dark(#f2f2f2, #323232);
  --ribbon-value: light-dark(#48484a, #c7c7cc);
  --material: light-dark(rgb(249 249 249 / 0.78), rgb(29 29 31 / 0.72));
  --red: light-dark(#ff383c, #ff4245);
  --tint: #007aff;
  --tint-readable: #007aff;
  --tint-readable-dark: #0a84ff;
  --key: light-dark(var(--tint-readable), var(--tint-readable-dark));
  --radius: 1.5rem; /* M6 card radius, still used by pages not yet migrated */
}
@media (min-width: 1000px) {
  :root {
    --page: light-dark(#ffffff, #1f1f1f);
    --surface: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.05));
  }
}
.dark { color-scheme: dark; }
.light { color-scheme: light; }
@media (prefers-contrast: more) {
  :root { --label-2: light-dark(rgba(0, 0, 0, 0.76), rgba(255, 255, 255, 0.8)); }
}

/* ---------- type: iOS Dynamic Type sizes on phones, apps.apple.com sizes from 1000px ---------- */
:root {
  --u: calc(1rem / 16);
  --fs-large-title: calc(34 * var(--u)); --lh-large-title: calc(41 * var(--u));
  --fs-header: calc(34 * var(--u)); --lh-header: calc(41 * var(--u));
  --fs-title-1: calc(28 * var(--u)); --lh-title-1: calc(34 * var(--u));
  --fs-title-2: calc(22 * var(--u)); --lh-title-2: calc(28 * var(--u));
  --fs-title-3: calc(20 * var(--u)); --lh-title-3: calc(25 * var(--u));
  --fs-headline: calc(17 * var(--u)); --lh-headline: calc(22 * var(--u)); --fw-headline: 600;
  --fs-body: calc(17 * var(--u)); --lh-body: calc(22 * var(--u)); --lh-body-tall: calc(22 * var(--u));
  --fs-callout: calc(16 * var(--u)); --lh-callout: calc(21 * var(--u));
  --fs-subhead: calc(15 * var(--u)); --lh-subhead: calc(20 * var(--u));
  --fs-footnote: calc(13 * var(--u)); --lh-footnote: calc(18 * var(--u)); --fw-footnote-em: 600;
  --fs-caption: calc(12 * var(--u)); --lh-caption: calc(16 * var(--u)); --fw-caption-em: 600;
}
@supports (font: -apple-system-body) and (-webkit-touch-callout: none) {
  html { font: -apple-system-body; }
  :root { --u: calc(1rem / 17); }
}
@media (min-width: 1000px) {
  :root {
    --fs-large-title: calc(26 * var(--u)); --lh-large-title: calc(32 * var(--u));
    --fs-header: calc(34 * var(--u)); --lh-header: calc(40 * var(--u));
    --fs-title-1: calc(22 * var(--u)); --lh-title-1: calc(26 * var(--u));
    --fs-title-2: calc(17 * var(--u)); --lh-title-2: calc(22 * var(--u));
    --fs-title-3: calc(15 * var(--u)); --lh-title-3: calc(20 * var(--u));
    --fs-headline: calc(13 * var(--u)); --lh-headline: calc(16 * var(--u)); --fw-headline: 700;
    --fs-body: calc(13 * var(--u)); --lh-body: calc(16 * var(--u)); --lh-body-tall: calc(18 * var(--u));
    --fs-callout: calc(12 * var(--u)); --lh-callout: calc(15 * var(--u));
    --fs-subhead: calc(11 * var(--u)); --lh-subhead: calc(14 * var(--u));
    --fs-footnote: calc(10 * var(--u)); --lh-footnote: calc(13 * var(--u)); --fw-footnote-em: 700;
    --fs-caption: calc(10 * var(--u)); --lh-caption: calc(13 * var(--u)); --fw-caption-em: 500;
  }
}
@utility t-large-title { font-size: var(--fs-large-title); line-height: var(--lh-large-title); }
@utility t-large-title-em { font-size: var(--fs-large-title); line-height: var(--lh-large-title); font-weight: 700; }
@utility t-header { font-size: var(--fs-header); line-height: var(--lh-header); font-weight: 700; }
@utility t-title-1 { font-size: var(--fs-title-1); line-height: var(--lh-title-1); }
@utility t-title-1-em { font-size: var(--fs-title-1); line-height: var(--lh-title-1); font-weight: 700; }
@utility t-title-2 { font-size: var(--fs-title-2); line-height: var(--lh-title-2); }
@utility t-title-2-em { font-size: var(--fs-title-2); line-height: var(--lh-title-2); font-weight: 700; }
@utility t-title-3 { font-size: var(--fs-title-3); line-height: var(--lh-title-3); }
@utility t-title-3-em { font-size: var(--fs-title-3); line-height: var(--lh-title-3); font-weight: 600; }
@utility t-headline { font-size: var(--fs-headline); line-height: var(--lh-headline); font-weight: var(--fw-headline); }
@utility t-body { font-size: var(--fs-body); line-height: var(--lh-body); }
@utility t-body-em { font-size: var(--fs-body); line-height: var(--lh-body); font-weight: 600; }
@utility t-body-tall { font-size: var(--fs-body); line-height: var(--lh-body-tall); }
@utility t-callout { font-size: var(--fs-callout); line-height: var(--lh-callout); }
@utility t-callout-em { font-size: var(--fs-callout); line-height: var(--lh-callout); font-weight: 600; }
@utility t-subhead { font-size: var(--fs-subhead); line-height: var(--lh-subhead); }
@utility t-subhead-em { font-size: var(--fs-subhead); line-height: var(--lh-subhead); font-weight: 600; }
@utility t-footnote { font-size: var(--fs-footnote); line-height: var(--lh-footnote); }
@utility t-footnote-em { font-size: var(--fs-footnote); line-height: var(--lh-footnote); font-weight: var(--fw-footnote-em); }
@utility t-caption { font-size: var(--fs-caption); line-height: var(--lh-caption); }
@utility t-caption-em { font-size: var(--fs-caption); line-height: var(--lh-caption); font-weight: var(--fw-caption-em); }

/* ---------- base ---------- */
@layer base {
  html { -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; scrollbar-gutter: stable; }
  body {
    font-family: var(--font-sans); font-size: var(--fs-body); line-height: var(--lh-body);
    background: var(--page); color: var(--label);
    font-optical-sizing: auto; letter-spacing: 0; -webkit-font-smoothing: antialiased;
  }
  a, button, [role="button"], label, summary { touch-action: manipulation; }
  input, select, textarea { font-size: max(16px, 1rem); }
  h1, h2, h3 { text-wrap: balance; }
  p { text-wrap: pretty; }
}

*:focus-visible { outline: 2px solid var(--key); outline-offset: 2px; border-radius: 6px; }

.skip-link { position: absolute; left: 1rem; top: -4rem; z-index: 100; padding: 0.5rem 0.75rem; border-radius: 9999px; background: var(--key); color: #fff; font-weight: 600; }
.skip-link:focus { top: 1rem; }

/* ---------- wordmark ---------- */
@font-face {
  font-family: "Chakra Petch"; font-style: normal; font-weight: 700; font-display: swap;
  src: url("../fonts/chakra-petch-700.woff2") format("woff2");
}
.wordmark-lockup { font-family: var(--font-wordmark); font-weight: 700; letter-spacing: 0.005em; }
.wordmark-lockup .wordmark-tail { font-family: var(--font-sans); font-weight: 600; font-size: 0.78em; }
.wordmark-lockup[data-stacked] .wordmark-tail { display: block; font-family: var(--font-wordmark); font-weight: 700; font-size: 0.42em; margin-top: 0.14em; opacity: 0.92; }

/* ---------- phone nav bar: fixed and transparent; the material is a child and appears when collapsed ---------- */
.navbar { position: fixed; inset-inline: 0; top: 0; z-index: 40; padding-top: env(safe-area-inset-top); background: transparent; }
.navbar-material { position: absolute; inset: 0; z-index: -1; background: var(--material); backdrop-filter: blur(20px) saturate(180%); box-shadow: 0 0.5px 0 var(--separator); opacity: 0; transition: opacity 0.25s ease-out; }
.navbar-title, .navbar-trailing { opacity: 0; translate: 0 6px; transition: opacity 0.2s ease-out, translate 0.2s ease-out; pointer-events: none; }
.navbar[data-collapsed] .navbar-material { opacity: 1; }
.navbar[data-collapsed] :is(.navbar-title, .navbar-trailing) { opacity: 1; translate: 0 0; pointer-events: auto; }
[data-nav-sentinel] { height: 1px; margin-top: -1px; pointer-events: none; }

/* ---------- phone tab bar: floating glass capsule ---------- */
.tabbar {
  position: fixed; left: 16px; right: 16px; bottom: max(12px, env(safe-area-inset-bottom)); z-index: 40;
  border-radius: 9999px; background: var(--material); backdrop-filter: blur(20px) saturate(180%);
  box-shadow: inset 0 1px 0 light-dark(rgb(255 255 255 / 0.6), rgb(255 255 255 / 0.12)), 0 8px 24px rgb(0 0 0 / 0.12);
  transition: translate 0.3s var(--ease-standard), opacity 0.3s var(--ease-standard);
}
.tabbar[data-hidden] { translate: 0 calc(100% + 24px); opacity: 0; }

/* ---------- iOS segmented control ---------- */
.segmented { display: inline-flex; padding: 2px; border-radius: 9px; background: var(--fill); }
.segment { flex: 1; height: 28px; padding: 0 10px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--label); white-space: nowrap; transition: background-color 0.14s ease-out; }
.segment[aria-checked="true"] { background: light-dark(#ffffff, #636366); box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 3px 1px rgba(0, 0, 0, 0.04); font-weight: 600; }

/* ---------- store switch: anything marked with data-stores hides when the chosen store is not listed ---------- */
html[data-store="pal"] [data-stores]:not([data-stores~="pal"]),
html[data-store="classic"] [data-stores]:not([data-stores~="classic"]),
html[data-store="sidestore"] [data-stores]:not([data-stores~="sidestore"]),
html:not([data-store="all"]) [data-stores="all"] { display: none !important; }

/* ---------- M6 pieces still in use ---------- */
.hero-midnight {
  color: #fff;
  background:
    radial-gradient(70% 90% at 78% 35%, rgba(59, 130, 246, 0.55), rgba(59, 130, 246, 0) 70%),
    linear-gradient(135deg, #070b14, #101a33);
}
.pill {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 78px; height: 32px; padding: 0 12px; border-radius: 9999px;
  font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em;
  color: var(--pill-fg, #fff); background-color: var(--pill-bg, var(--tint)); white-space: nowrap; cursor: pointer;
  transition: opacity 0.15s ease;
}
.pill:hover { opacity: 0.85; }
.pill:active { opacity: 0.7; }
.app-icon { border: 0.75px solid rgba(0, 0, 0, 0.12); }
.dark .app-icon { border-color: rgba(255, 255, 255, 0.12); }
.snap-strip { scrollbar-width: thin; }

/* ---------- preferences ---------- */
@media (prefers-reduced-transparency: reduce) {
  .navbar-material, .tabbar { background: var(--page); backdrop-filter: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; scroll-behavior: auto !important; }
  .tabbar[data-hidden] { translate: 0 0; opacity: 1; }
}
```

- [ ] **Step 4: Dark-mode reference colour for readable tints** — in `site/src/lib/tint.mjs` change line 2 to `const DARK_BG = '#1c1c1e';` and in `test/site/tint.test.mjs` line 21 change `'#1a191b'` to `'#1c1c1e'`.

- [ ] **Step 5: Run the site and tint tests**

Run: `node --test test/site/tint.test.mjs test/site/site.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)|AssertionError'`
Expected: tokens test PASS; nav bar test still FAIL (it belongs to Task 4); everything else PASS. Note: the `navbar-material` and `.tabbar` CSS rules are emitted even before the components exist because they are plain CSS, not utilities.

- [ ] **Step 6: Commit**

```bash
git add site/src/styles/global.css site/src/lib/tint.mjs test/site/tint.test.mjs test/site/site.test.mjs
git commit -m "feat(site): Storefront tokens — light-dark colours, iOS and App Store type scales, materials, store filter"
```

---

### Task 2: 180 px touch icon in the brand generator

**Files:**
- Modify: `scripts/make-brand-assets.mjs`
- Modify: `test/helpers/png.mjs`
- Test: `test/scripts/brand-assets.test.mjs`

**Interfaces:**
- Produces: `assets/apple-touch-icon.png` (180×180, RGB, no alpha), listed by `generateBrandAssets()`.

- [ ] **Step 1: Write the failing test** — in `test/helpers/png.mjs` add the colour type, and in the generator test extend the expected list and add the touch-icon assertions:

`test/helpers/png.mjs`:
```js
/** Width, height and colour type (2 = RGB, 6 = RGBA) from a PNG's IHDR chunk. */
export function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}
```

In `test/scripts/brand-assets.test.mjs` change the first test's expected list to `['apple-touch-icon.png', 'header.png', 'header.svg', 'icon.png', 'logo.svg', 'wordmark.svg']`, change the dimension test to compare `{ width, height }` only (destructure `pngSize` results), and append:

```js
test('apple-touch-icon.png is 180 square and opaque, as iOS wants it', async () => {
  const { width, height, colorType } = pngSize(await read('apple-touch-icon.png'));
  assert.deepEqual({ width, height }, { width: 180, height: 180 });
  assert.equal(colorType, 2, 'RGB without alpha');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/scripts/brand-assets.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)|AssertionError'`
Expected: FAIL on the file list and the new test (`ENOENT apple-touch-icon.png`).

- [ ] **Step 3: Render the touch icon** — in `scripts/make-brand-assets.mjs`, after the header PNG:

```js
  const touch = path.join(outDir, 'apple-touch-icon.png');
  await sharp(Buffer.from(svgs['logo.svg'])).resize(180, 180).flatten({ background: '#0b1220' }).png(PNG).toFile(touch);
  written.push(icon, header, touch);
```
(replace the existing `written.push(icon, header);` line) and update the header comment's file list to include `apple-touch-icon.png (180², opaque)`.

- [ ] **Step 4: Run the tests and regenerate**

Run: `node --test test/scripts/brand-assets.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)' && node scripts/make-brand-assets.mjs`
Expected: 6 pass; `assets/apple-touch-icon.png` written (icon.png and header.png are byte-identical to before).

- [ ] **Step 5: Commit**

```bash
git add scripts/make-brand-assets.mjs test/helpers/png.mjs test/scripts/brand-assets.test.mjs assets/apple-touch-icon.png
git commit -m "feat(brand): 180px opaque apple-touch-icon"
```

---

### Task 3: Shared nav and store definitions

**Files:**
- Create: `site/src/lib/nav.mjs`
- Create: `site/src/lib/stores.mjs`
- Test: `test/site/nav.test.mjs`

**Interfaces:**
- Produces: `navItems(base) → [{ label, href, icon }]`, `isCurrent(pathname, href, base) → boolean`, `STORES → [{ id, label, short, icon, kinds }]`, `storesFor(kinds) → 'pal classic sidestore'`-style string.

- [ ] **Step 1: Write the failing test**

`test/site/nav.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navItems, isCurrent } from '../../site/src/lib/nav.mjs';
import { STORES, storesFor } from '../../site/src/lib/stores.mjs';

const base = '/altsource/';

test('navItems are Home, Apps, News, Status under the base path with a Hugeicon each', () => {
  assert.deepEqual(navItems(base).map((i) => [i.label, i.href]), [['Home', '/altsource/'], ['Apps', '/altsource/apps/'], ['News', '/altsource/news/'], ['Status', '/altsource/status/']]);
  for (const i of navItems(base)) assert.match(i.icon, /Icon$/);
});

test('isCurrent matches Home exactly and sections by prefix, with or without a trailing slash', () => {
  assert.equal(isCurrent('/altsource/', base, base), true);
  assert.equal(isCurrent('/altsource/apps/', base, base), false);
  assert.equal(isCurrent('/altsource/apps/', `${base}apps/`, base), true);
  assert.equal(isCurrent('/altsource/apps/com.x', `${base}apps/`, base), true);
  assert.equal(isCurrent('/altsource/news/', `${base}apps/`, base), false);
});

test('storesFor maps version kinds to the stores that can install them', () => {
  assert.equal(storesFor(['adp']), 'pal');
  assert.equal(storesFor(['ipa']), 'classic sidestore');
  assert.equal(storesFor(['adp', 'ipa']), 'pal classic sidestore');
  assert.equal(STORES[0].id, 'all');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/site/nav.test.mjs 2>&1 | grep -E 'Cannot find|ERR_MODULE|^ℹ (pass|fail)'`
Expected: `ERR_MODULE_NOT_FOUND` for nav.mjs.

- [ ] **Step 3: Write the modules**

`site/src/lib/nav.mjs`:
```js
/** Primary navigation shared by the desktop sidebar and the phone tab bar. */
export const navItems = (base) => [
  { label: 'Home', href: base, icon: 'Home01Icon' },
  { label: 'Apps', href: `${base}apps/`, icon: 'Grid2X2Icon' },
  { label: 'News', href: `${base}news/`, icon: 'News01Icon' },
  { label: 'Status', href: `${base}status/`, icon: 'Activity01Icon' },
];

/** Home only matches itself; every other section matches its subtree. */
export function isCurrent(pathname, href, base) {
  const p = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return href === base ? p === base : p.startsWith(href);
}
```

`site/src/lib/stores.mjs`:
```js
/** The stores a visitor can pick. `kinds` are the version kinds each one can install. */
export const STORES = [
  { id: 'all', label: 'All stores', short: 'All', icon: 'Layers01Icon', kinds: ['adp', 'ipa'] },
  { id: 'pal', label: 'AltStore PAL', short: 'PAL', icon: 'Store01Icon', kinds: ['adp'] },
  { id: 'classic', label: 'AltStore Classic', short: 'Classic', icon: 'Package01Icon', kinds: ['ipa'] },
  { id: 'sidestore', label: 'SideStore', short: 'SideStore', icon: 'Download01Icon', kinds: ['ipa'] },
];

/** Value for a `data-stores` attribute: the stores that can install an entry with these kinds. */
export function storesFor(kinds) {
  return STORES.filter((s) => s.id !== 'all' && s.kinds.some((k) => kinds.includes(k))).map((s) => s.id).join(' ');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/site/nav.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)'`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/nav.mjs site/src/lib/stores.mjs test/site/nav.test.mjs
git commit -m "feat(site): shared nav items and store definitions"
```

---

### Task 4: NavBar rewrite and page large titles

**Files:**
- Modify: `site/src/components/NavBar.astro` (rewrite)
- Modify: `site/src/pages/index.astro:25-28`
- Modify: `site/src/pages/apps/index.astro:10-12`
- Modify: `site/src/pages/news/index.astro:10-11`
- Modify: `site/src/pages/status/index.astro:9-10`
- Modify: `site/src/pages/404.astro:8`
- Modify: `site/src/pages/apps/[id]/index.astro:37-39`
- Modify: `site/src/pages/apps/[id]/versions/index.astro:19-20`
- Test: `test/site/site.test.mjs` (the nav bar test from Task 1)

**Interfaces:**
- Consumes: nothing new.
- Produces: `<NavBar title icon back>` where `back` is an href string; named slots `title` and `trailing`. The bar is always fixed and transparent; pages that want the collapse must render `<div data-nav-sentinel></div>` right after their large title or hero. Pages without a sentinel get the collapsed (glass, titled) bar from the start.

- [ ] **Step 1: The failing test is already in place** (Task 1 Step 1, second test). Confirm it still fails:

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E 'AssertionError'`
Expected: `index.html bar` assertion fails.

- [ ] **Step 2: Rewrite the component**

`site/src/components/NavBar.astro`:
```astro
---
import Icon from './Icon.astro';
/**
 * Phone nav bar (hidden from 1000px, where the sidebar takes over). Fixed and transparent; the material
 * child and the title fade in once the page's large title or hero has scrolled under it (a page marks that
 * point with `<div data-nav-sentinel>`). Pages without a sentinel start collapsed. `back` is an href.
 */
const { title, icon, back } = Astro.props;
---
<header class="navbar lg:hidden" data-navbar>
  <div class="navbar-material" aria-hidden="true"></div>
  <nav class="relative mx-auto flex h-11 items-center gap-2 px-1" aria-label="Page">
    <div class="flex min-w-11 items-center">
      {back && <a href={back} class="grid size-11 place-items-center rounded-full text-key active:opacity-60" aria-label="Back"><Icon name="ArrowLeft01Icon" class="size-6" strokeWidth={2.25} /></a>}
    </div>
    <div class="navbar-title flex min-w-0 flex-1 items-center justify-center gap-1.5 t-headline" data-nav-title aria-hidden="true">
      {icon && <img src={icon} alt="" width="28" height="28" class="app-icon size-7 rounded-lg" />}
      {Astro.slots.has('title') ? <slot name="title" /> : <p class="truncate">{title}</p>}
    </div>
    <div class="navbar-trailing flex min-w-11 items-center justify-end gap-2 pr-3" data-nav-trailing>
      <slot name="trailing" />
    </div>
  </nav>
</header>
<script>
  const bar = document.querySelector('[data-navbar]');
  const sentinel = document.querySelector('[data-nav-sentinel]');
  const label = bar?.querySelector('[data-nav-title]');
  const collapse = (on) => { bar.toggleAttribute('data-collapsed', on); label?.setAttribute('aria-hidden', String(!on)); };
  if (bar && sentinel && 'IntersectionObserver' in window) {
    const barHeight = Math.round(bar.getBoundingClientRect().height);
    new IntersectionObserver(([e]) => collapse(!e.isIntersecting && e.boundingClientRect.top < barHeight), { rootMargin: `-${barHeight}px 0px 0px 0px`, threshold: 0 }).observe(sentinel);
  } else if (bar) collapse(true);
</script>
```

- [ ] **Step 3: Adopt it on every page**

`site/src/pages/index.astro` lines 25–28 become:
```astro
  <NavBar slot="nav" icon={meta.iconURL}>
    <Wordmark slot="title" name={meta.name} class="truncate text-[1.05em]" />
    <Pill slot="trailing" label="Add" data-sheet="add-source" />
  </NavBar>
```
and in the hero `<section>` class string remove `-mt-3 ` (the main no longer pads flush pages; see Task 5).

`site/src/pages/apps/index.astro` lines 10–12 become:
```astro
  <NavBar slot="nav" title="Apps" back={base} />
  <h1 class="t-large-title-em pt-2 lg:pt-[11px]">Apps</h1>
  <div data-nav-sentinel></div>
```

`site/src/pages/news/index.astro` lines 10–11 become:
```astro
  <NavBar slot="nav" title="News" back={base} />
  <h1 class="t-large-title-em pt-2 lg:pt-[11px]">News</h1>
  <div data-nav-sentinel></div>
```

`site/src/pages/status/index.astro` lines 9–10 become:
```astro
  <NavBar slot="nav" title="Status" back={base} />
  <h1 class="t-large-title-em pt-2 lg:pt-[11px]">Status</h1>
  <div data-nav-sentinel></div>
```

`site/src/pages/404.astro` line 8 becomes `  <NavBar slot="nav" title="Not Found" back={base} />`.

`site/src/pages/apps/[id]/index.astro` lines 37–39 become:
```astro
  <NavBar slot="nav" title={app.name} icon={app.iconURL} back={`${base}apps/`}>
    <Pill slot="trailing" label="Get" {...getProps} />
  </NavBar>
```

`site/src/pages/apps/[id]/versions/index.astro` lines 19–20 become:
```astro
  <NavBar slot="nav" title="Version History" back={`${base}apps/${encodeURIComponent(app.bundleIdentifier)}/`} />
  <h1 class="t-large-title-em pt-2 lg:pt-[11px]">Version History</h1>
  <p class="t-subhead text-label-2">{app.name}</p>
  <div data-nav-sentinel></div>
```

- [ ] **Step 4: Run the site tests**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)|AssertionError'`
Expected: the nav bar test passes; `home hero and nav carry the wordmark…` still passes (the wordmark sits in `data-nav-title`); the `every internal link resolves` test passes (back hrefs are real pages). If the `home page` test's "one h1" assertion trips, the home page still has exactly one `<h1>` (the hero); the versions page is not part of that assertion.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/NavBar.astro site/src/pages
git commit -m "feat(site): fixed transparent nav bar with material layer, chevron back and large titles"
```

---

### Task 5: Shell — Base, Sidebar, TabBar, StoreSwitch, ThemeToggle, Footer, manifest

**Files:**
- Modify: `site/src/layouts/Base.astro` (rewrite)
- Create: `site/src/components/Sidebar.astro`
- Create: `site/src/components/TabBar.astro`
- Create: `site/src/components/StoreSwitch.astro`
- Create: `site/src/components/ThemeToggle.astro`
- Create: `site/src/components/Footer.astro`
- Create: `site/src/pages/manifest.webmanifest.js`
- Modify: `site/src/pages/index.astro` (`flush`, segmented switch)
- Test: `test/site/site.test.mjs`

**Interfaces:**
- Consumes: `navItems`, `isCurrent` (Task 3), `STORES` (Task 3), `Wordmark.astro` (exists), `getSite()`.
- Produces: `<Base title description image noindex tint width="narrow|wide" flush>`; `html[data-store]` set before paint; `.dark`/`.light` always set on `<html>`; `[data-store-set]` and `[data-theme-set]` radio buttons.

- [ ] **Step 1: Write the failing test** — append to `test/site/site.test.mjs`:

```js
test('shell: sidebar with the current row, floating tab bar, store switch, three-state appearance control, PWA head and manifest', async () => {
  const html = await page('index.html');
  assert.match(html, /<aside class="[^"]*" aria-label="Site">/, 'sidebar');
  assert.match(html, /<a href="\/altsource\/" aria-current="page"/, 'Home is current in the sidebar');
  assert.match(html, /<nav class="tabbar[^"]*" aria-label="Primary" data-tabbar>/, 'tab bar');
  assert.equal((html.match(/data-tabbar>[\s\S]*?<\/nav>/)[0].match(/<a /g) ?? []).length, 4, 'four tabs');
  assert.match(html, /role="radiogroup" aria-label="Store"/, 'store switch');
  for (const s of ['all', 'pal', 'classic', 'sidestore']) assert.match(html, new RegExp(`data-store-set="${s}"`), `${s} option`);
  assert.match(html, /<div role="radiogroup" aria-label="Store" data-store-switch class="segmented/, 'phone segmented control on the home page');
  assert.match(html, /root\.dataset\.store/, 'store restored before paint');
  assert.match(html, /role="radiogroup" aria-label="Appearance"/, 'appearance control');
  assert.doesNotMatch(html, /aria-pressed/, 'the floating toggle button is gone');
  assert.match(html, /<meta name="theme-color" content="#ffffff" media="\(prefers-color-scheme: light\)"/);
  assert.match(html, /<meta name="theme-color" content="#000000" media="\(prefers-color-scheme: dark\)"/);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="[^"]*assets\/apple-touch-icon\.png"/);
  assert.match(html, /<link rel="manifest" href="\/altsource\/manifest\.webmanifest"/);
  assert.match(html, /<footer class="[^"]*bg-footer/, 'App Store footer');
  assert.match(await page('apps/index.html'), /<a href="\/altsource\/apps\/" aria-current="page"/, 'Apps is current on the apps page');
  const manifest = JSON.parse(await page('manifest.webmanifest'));
  assert.equal(manifest.name, 'Fixture Source');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/altsource/');
  assert.ok(manifest.icons.some((i) => i.sizes === '180x180'), 'touch icon in the manifest');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E 'AssertionError' | head -2`
Expected: `sidebar` assertion fails.

- [ ] **Step 3: Write the components**

`site/src/components/ThemeToggle.astro`:
```astro
---
/** iOS segmented control for appearance: System, Light, Dark. Persists to localStorage.theme; "system" clears it. */
const options = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
---
<div class="segmented w-full" role="radiogroup" aria-label="Appearance" data-theme-toggle>
  {options.map(([value, label]) => <button type="button" role="radio" aria-checked="false" data-theme-set={value} class="segment">{label}</button>)}
</div>
<script>
  const buttons = document.querySelectorAll('[data-theme-set]');
  const apply = (value) => {
    const root = document.documentElement;
    const dark = value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.themeSet === value));
  };
  let current = 'system';
  try { const t = localStorage.getItem('theme'); if (t === 'dark' || t === 'light') current = t; } catch {}
  apply(current);
  for (const b of buttons) b.addEventListener('click', () => {
    current = b.dataset.themeSet;
    try { if (current === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', current); } catch {}
    apply(current);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (current === 'system') apply(current); });
</script>
```

`site/src/components/StoreSwitch.astro`:
```astro
---
import Icon from './Icon.astro';
import { STORES } from '../lib/stores.mjs';
/** The store switch: `rows` for the sidebar, `segmented` (default) for phones. Both write html[data-store] and localStorage.store. */
const { variant = 'segmented', class: cls = '' } = Astro.props;
---
{variant === 'rows' ? (
  <div class={cls}>
    <p class="t-footnote-em uppercase text-label-3">Store</p>
    <div role="radiogroup" aria-label="Store" data-store-switch class="mt-1 flex flex-col">
      {STORES.map((s) => <button type="button" role="radio" aria-checked="false" data-store-set={s.id} class="flex min-h-11 items-center gap-2.5 py-2 text-left t-body text-label-2 hover:text-label aria-checked:font-semibold aria-checked:text-label"><Icon name={s.icon} class="size-[18px]" />{s.label}</button>)}
    </div>
  </div>
) : (
  <div role="radiogroup" aria-label="Store" data-store-switch class={`segmented ${cls}`}>
    {STORES.map((s) => <button type="button" role="radio" aria-checked="false" data-store-set={s.id} class="segment">{s.short}</button>)}
  </div>
)}
<script>
  const buttons = document.querySelectorAll('[data-store-set]');
  const apply = (value) => {
    document.documentElement.dataset.store = value;
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.storeSet === value));
  };
  apply(document.documentElement.dataset.store || 'all');
  for (const b of buttons) b.addEventListener('click', () => {
    const value = b.dataset.storeSet;
    try { localStorage.setItem('store', value); } catch {}
    apply(value);
  });
</script>
```

`site/src/components/Sidebar.astro`:
```astro
---
import Icon from './Icon.astro';
import Wordmark from './Wordmark.astro';
import StoreSwitch from './StoreSwitch.astro';
import ThemeToggle from './ThemeToggle.astro';
import { getSite } from '../lib/data.mjs';
import { navItems, isCurrent } from '../lib/nav.mjs';
/** Desktop sidebar (from 1000px): lockup, primary navigation, store switch, appearance, source URLs. */
const site = await getSite();
const base = import.meta.env.BASE_URL;
const path = Astro.url.pathname;
---
<aside class="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col self-start border-r border-divider bg-sidebar lg:flex" aria-label="Site">
  <a href={base} class="flex items-center gap-2.5 px-[25px] pt-[19px] pb-[14px]">
    <img src={site.meta.iconURL} alt="" width="28" height="28" class="size-7 rounded-lg" />
    <Wordmark name={site.meta.name} class="text-[22px] leading-none" />
  </a>
  <nav aria-label="Primary" class="px-[25px]">
    <ul class="flex flex-col gap-0.5">
      {navItems(base).map((item) => { const current = isCurrent(path, item.href, base); return (
        <li><a href={item.href} aria-current={current ? 'page' : undefined} class={`flex h-8 items-center gap-2 rounded-[6px] p-1 t-title-3 ${current ? 'bg-sidebar-selected font-medium' : 'hover:bg-fill-2'}`}><span class="grid size-6 place-items-center"><Icon name={item.icon} class="size-[18px] text-key" strokeWidth={1.75} /></span>{item.label}</a></li>
      ); })}
    </ul>
  </nav>
  <StoreSwitch variant="rows" class="mt-6 px-[25px]" />
  <div class="mt-auto px-[25px] pb-5">
    <ThemeToggle />
    <p class="mt-3 flex flex-col gap-1 t-subhead text-label-2">
      <a class="truncate hover:text-key" href={site.urls.pal}>source.pal.json</a>
      <a class="truncate hover:text-key" href={site.urls.classic}>source.json</a>
    </p>
  </div>
</aside>
```

`site/src/components/TabBar.astro`:
```astro
---
import Icon from './Icon.astro';
import { navItems, isCurrent } from '../lib/nav.mjs';
/** Floating glass tab bar on phones and tablets. Slides away on scroll down, returns on scroll up. */
const base = import.meta.env.BASE_URL;
const path = Astro.url.pathname;
---
<nav class="tabbar lg:hidden" aria-label="Primary" data-tabbar>
  <ul class="flex h-14 items-stretch px-2">
    {navItems(base).map((item) => { const current = isCurrent(path, item.href, base); return (
      <li class="flex-1"><a href={item.href} aria-current={current ? 'page' : undefined} class={`flex h-full flex-col items-center justify-center gap-0.5 rounded-full ${current ? 'text-key' : 'text-label-2'} active:opacity-60`}><Icon name={item.icon} class="size-6" strokeWidth={current ? 2 : 1.5} /><span class="text-[11px] leading-none font-medium">{item.label}</span></a></li>
    ); })}
  </ul>
</nav>
<script>
  const bar = document.querySelector('[data-tabbar]');
  if (bar && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let last = window.scrollY, ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.toggleAttribute('data-hidden', y > last && y > 80 && y < max - 8);
        last = y;
        ticking = false;
      });
    }, { passive: true });
  }
</script>
```

`site/src/components/Footer.astro`:
```astro
---
import ThemeToggle from './ThemeToggle.astro';
import { getSite } from '../lib/data.mjs';
/** App Store footer: grey band, small type, source URLs; carries the appearance control on phones. */
const site = await getSite();
---
<footer class="bg-footer px-4 pt-[15px] pb-[calc(100px+env(safe-area-inset-bottom))] text-label-2 t-footnote xs:px-[25px] lg:px-10 lg:pb-[15px]">
  <div class="mx-auto flex max-w-[1680px] min-h-[58px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <p>{site.meta.name} · AltStore PAL installs notarized apps in the EU, Japan and Brazil; AltStore Classic and SideStore sideload IPAs everywhere.</p>
    <p class="flex flex-wrap gap-x-3 gap-y-1">
      <a class="hover:text-key" href={site.urls.pal}>source.pal.json</a>
      <a class="hover:text-key" href={site.urls.classic}>source.json</a>
      {site.meta.website && <a class="hover:text-key" href={site.meta.website} rel="noopener">Source code</a>}
    </p>
    <div class="lg:hidden"><ThemeToggle /></div>
  </div>
</footer>
```

`site/src/pages/manifest.webmanifest.js`:
```js
import { getSite } from '../lib/data.mjs';
import { normalizeTint } from '../lib/tint.mjs';

/** Web app manifest so "Add to Home Screen" opens the source as a standalone app. */
export async function GET() {
  const site = await getSite();
  const base = import.meta.env.BASE_URL;
  const manifest = {
    name: site.meta.name,
    short_name: site.meta.name.split(/\s+/)[0],
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: '#000000',
    theme_color: normalizeTint(site.meta.tintColor),
    icons: [
      { src: site.meta.iconURL, sizes: '1024x1024', type: 'image/png' },
      { src: new URL('assets/apple-touch-icon.png', site.base).href, sizes: '180x180', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
}
```

`site/src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import Sidebar from '../components/Sidebar.astro';
import TabBar from '../components/TabBar.astro';
import Footer from '../components/Footer.astro';
import { getSite } from '../lib/data.mjs';
import { normalizeTint, readableTint } from '../lib/tint.mjs';
/**
 * Page shell. Desktop (≥1000px): sidebar + content column. Phones: fixed nav bar (the page's `nav` slot),
 * content, footer, floating tab bar. `flush` lets a hero start under the transparent bar.
 */
const { title, description, image, noindex = false, tint, width = 'narrow', flush = false } = Astro.props;
const site = await getSite();
const fullTitle = title ? `${title} · ${site.meta.name}` : site.meta.name;
const desc = description ?? site.meta.subtitle ?? '';
const color = normalizeTint(tint ?? site.meta.tintColor);
const vars = `--tint: ${color}; --tint-readable: ${readableTint(color, false)}; --tint-readable-dark: ${readableTint(color, true)}`;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
const base = import.meta.env.BASE_URL;
const touchIcon = new URL('assets/apple-touch-icon.png', site.base).href;
const mainWidth = width === 'wide' ? 'max-w-[1680px]' : 'max-w-2xl';
const mainTop = flush ? '' : 'pt-[calc(44px+env(safe-area-inset-top))] lg:pt-0';
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light dark" />
  <title>{fullTitle}</title>
  <meta name="description" content={desc} />
  {noindex && <meta name="robots" content="noindex" />}
  <link rel="canonical" href={canonical} />
  <link rel="icon" href={site.meta.iconURL} />
  <link rel="apple-touch-icon" sizes="180x180" href={touchIcon} />
  <link rel="manifest" href={`${base}manifest.webmanifest`} />
  <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content={site.meta.name} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={site.meta.name} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={desc} />
  <meta property="og:image" content={image ?? site.meta.headerURL ?? site.meta.iconURL} />
  <meta property="og:url" content={canonical} />
  <meta name="twitter:card" content="summary" />
  <script is:inline>
    (function () {
      var root = document.documentElement;
      var dark = false, store = 'all';
      try {
        var t = localStorage.getItem('theme');
        dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        var s = localStorage.getItem('store');
        if (s === 'pal' || s === 'classic' || s === 'sidestore') store = s;
      } catch (e) {}
      root.classList.add(dark ? 'dark' : 'light');
      root.dataset.store = store;
    })();
  </script>
</head>
<body class="min-h-dvh bg-page text-label antialiased" style={vars}>
  <a href="#main" class="skip-link">Skip to content</a>
  <div class="lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
    <Sidebar />
    <div class="min-w-0">
      <slot name="nav" />
      <main id="main" tabindex="-1" class={`mx-auto w-full px-4 pb-10 outline-none xs:px-[25px] lg:px-10 ${mainTop} ${mainWidth}`}>
        <slot />
      </main>
      <Footer />
    </div>
  </div>
  <TabBar />
</body>
</html>
```

- [ ] **Step 4: Home page uses `flush` and the phone segmented control** — in `site/src/pages/index.astro`: change `<Base width="wide">` to `<Base width="wide" flush>`, add `import StoreSwitch from '../components/StoreSwitch.astro';` after the Wordmark import, and right after `<div data-nav-sentinel></div>` insert:

```astro
  <div class="mt-3 lg:hidden"><StoreSwitch class="w-full" /></div>
```

- [ ] **Step 5: Run the site tests**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)|AssertionError'`
Expected: all pass. If the internal-link test complains about `/altsource/manifest.webmanifest`, the endpoint file name is wrong: it must be `site/src/pages/manifest.webmanifest.js` so Astro emits `manifest.webmanifest` at the root.

- [ ] **Step 6: Commit**

```bash
git add site/src/layouts/Base.astro site/src/components site/src/pages test/site/site.test.mjs
git commit -m "feat(site): Storefront shell — sidebar, floating tab bar, store switch, appearance control, PWA head and manifest"
```

---

### Task 6: Store filter wiring on app rows

**Files:**
- Modify: `site/src/components/AppRow.astro:1-13`
- Test: `test/site/site.test.mjs`

**Interfaces:**
- Consumes: `storesFor(kinds)` (Task 3).
- Produces: every `[data-app]` row carries `data-stores="…"`, so `html[data-store]` filters rows on the home and Apps pages.

- [ ] **Step 1: Write the failing test** — append to `test/site/site.test.mjs`:

```js
test('app rows say which stores can install them, so the store switch can filter', async () => {
  const apps = await page('apps/index.html');
  assert.match(apps, /data-app[^>]*data-stores="pal"/, 'ADP-only app is PAL only');
  assert.match(apps, /data-app[^>]*data-stores="pal classic sidestore"/, 'ADP + IPA app installs everywhere');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/site/site.test.mjs 2>&1 | grep -E 'AssertionError' | head -1`
Expected: `ADP-only app is PAL only` fails.

- [ ] **Step 3: Add the attribute** — in `site/src/components/AppRow.astro` add `import { storesFor } from '../lib/stores.mjs';` after the tint import and add `data-stores={storesFor(kinds)}` right after `data-kinds={kinds.join(' ')}` on the root `<Tag>`.

- [ ] **Step 4: Run the full suite**

Run: `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)|^✖'`
Expected: all pass (about 170).

- [ ] **Step 5: Commit**

```bash
git add site/src/components/AppRow.astro test/site/site.test.mjs
git commit -m "feat(site): app rows carry data-stores for the store switch"
```

---

### Task 7: Viewport verification, deploy

**Files:** none new; fixes land in the files above.

- [ ] **Step 1: Build and preview** — `npm run build && (nohup node_modules/.bin/astro preview --port 4199 >/dev/null 2>&1 &)`.

- [ ] **Step 2: Check with Playwright** at 390×844 (home top: transparent bar over the hero, segmented control, tab bar floating; scrolled: glass bar with lockup + Add, tab bar hidden while scrolling down; Apps page: large title then collapse; 404: collapsed bar), 768×1024 (same, wider gutter 25 px), 1000×800 and 1280×800 (sidebar visible with Home current, store rows, appearance control at the bottom; no phone bar or tab bar; footer band). Compare against spec §2: sidebar 260 px, rows 32 px, tab bar 56 px inset 16 px, bar 44 px.

- [ ] **Step 3: Fix what is off** in one pass, re-run `npm test`, commit as `fix(site): …`.

- [ ] **Step 4: Push and verify live** — `git push origin main`, `gh run watch` the deploy, then `curl` the live home page for `data-tabbar`, `aria-label="Site"` and the manifest link, and fetch `manifest.webmanifest`.
