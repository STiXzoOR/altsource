# altsource Milestone 6 (AltStore-style redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site feel like AltStore. On phones it mirrors the AltStore app and [altsource-viewer](https://github.com/therealFoxster/altsource-viewer) (tinted app rows, uppercase pill buttons, solid-tint news cards, translucent nav bar whose title and GET button fade in on scroll, screenshot carousel, permission cards, action sheets). On desktop it reads like an App Store product page (large header with icon, title, developer and GET, wide screenshot gallery, description beside an information sidebar, cards in grids). Fully accessible: landmarks, skip link, visible focus, ARIA tabs/dialogs, contrast-corrected tints, reduced-motion support, live regions.

**Architecture:** Same Astro + Tailwind pipeline; components rewritten. Icons come from Hugeicons (`@hugeicons/core-free-icons`, MIT) rendered at build time by a tiny Astro component — no React. Design tokens follow shadcn/ui's naming (`--background`, `--foreground`, `--card`, `--muted-foreground`, `--primary`, `--border`, `--radius`) so shadcn components could be dropped in later; no shadcn runtime is shipped because every interactive piece is a native element (`<dialog>`, `<button>`, ARIA tabs).

**Spec:** `docs/superpowers/specs/2026-09-02-site-design.md` (section 4 superseded by the page table below).

## Global Constraints

- Same rules as milestone 5. New devDependency: `@hugeicons/core-free-icons` only. **No Bootstrap, no React, no icon fonts.**
- Tokens (shadcn names) with iOS values: light `--background #fff`, `--card #ebebeb`, `--muted-foreground rgba(0,0,0,.5)`, `--border rgba(0,0,0,.15)`, `--glass rgba(255,255,255,.75)`; dark `--background rgb(26,25,27)`, `--card rgb(46,45,47)`, `--muted-foreground rgba(255,255,255,.5)`, `--border rgba(255,255,255,.15)`, `--glass rgba(26,25,27,.75)`; `--tint` = page tint (`#007aff` default); `--primary` = contrast-corrected tint. `--radius: 1.5rem`.
- Tint contrast: text or icons drawn in the tint use `--primary` = `readableTint(tint, dark)` (≥ 4.5:1 on the page background); solid tint surfaces use `onTint()` for their text colour.
- Pills: `min-w-[78px] h-8 px-3 rounded-full text-[15px] font-bold uppercase`; app icons 64px `rounded-[14px]` hairline border; cards `rounded-[var(--radius)]`.
- Accessibility: skip link to `#main`, exactly one visible `<h1>` per viewport, `:focus-visible` rings, icon-only controls carry `aria-label`, dialogs are native `<dialog>` with `aria-labelledby`/`aria-label`, tabs use `role="tablist"/"tab"/"tabpanel"` with arrow keys, copy buttons announce through `aria-live`, `prefers-reduced-motion` disables transitions, decorative images have `alt=""`, screenshots have descriptive `alt`.
- Public pages never link to GitHub Actions. No `bootstrap` string may appear in the output.
- Code blocks introduced by `` `path`: `` are materialised verbatim.

## Pages

| Route | Mobile (< lg) | Desktop (lg+) |
|---|---|---|
| `/` | Nav (title + ADD fade in), round icon + name + subtitle + counts, URL chips, **News** carousel, **Featured Apps** rows, **About** | Hero banner with blurred header image, icon 128, name, subtitle, ADD; chips; news grid; featured grid; About two columns |
| `/apps/` | Nav (Back, "All Apps"), search, app blocks (row + subtitle + 2 screenshots) | 2-column grid |
| `/apps/<id>/` | Nav (Back, icon+name and GET fade in), tinted header row, subtitle, Preview carousel, description, What's New, Information, Permissions, Discover More On | App Store header (icon 160, title, developer, subtitle, GET + secondary links), wide gallery, 2/3 + 1/3 grid with a sticky Information + source sidebar |
| `/apps/<id>/versions/` | Nav, list | narrow column |
| `/news/` | Nav, stacked cards | 2-column grid |
| `/status/` | Nav, dashboard | wide dashboard |
| `/404.html` | message + Home pill | same |

---

### Task 1: Icons, tokens, primitives

**Files:** `package.json` (devDep `@hugeicons/core-free-icons`), `site/src/styles/global.css`, `site/src/components/Icon.astro`, `site/src/components/Pill.astro`, `site/src/components/SectionHeader.astro`, `site/src/components/NavBar.astro`, `site/src/layouts/Base.astro`, `site/src/lib/tint.mjs`, `test/site/tint.test.mjs`

- [ ] Step 1: failing test

`test/site/tint.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTint, onTint, readableTint, contrast } from '../../site/src/lib/tint.mjs';

test('normalizeTint accepts #RRGGBB and RRGGBB, falls back otherwise', () => {
  assert.equal(normalizeTint('#1DB954'), '#1db954');
  assert.equal(normalizeTint('cb1633'), '#cb1633');
  assert.equal(normalizeTint(undefined), '#007aff');
  assert.equal(normalizeTint('blue', '#123456'), '#123456');
});

test('onTint picks black or white text for solid tints', () => {
  assert.equal(onTint('#ffffff'), '#000');
  assert.equal(onTint('#1db954'), '#fff');
  assert.equal(onTint('#f5a10d'), '#000');
});

test('readableTint keeps readable tints and darkens/lightens unreadable ones to 4.5:1', () => {
  assert.equal(readableTint('#0055cc', false), '#0055cc', 'already readable on white');
  assert.ok(contrast(readableTint('#ffd60a', false), '#ffffff') >= 4.5, 'yellow gets darkened for light mode');
  assert.ok(contrast(readableTint('#1a1a2e', true), '#1a191b') >= 4.5, 'near-black gets lightened for dark mode');
  assert.match(readableTint('#ffd60a', false), /^#[0-9a-f]{6}$/);
});
```

- [ ] Step 2: implement

`site/src/lib/tint.mjs`:
```js
const HEX = /^#?([0-9a-fA-F]{6})$/;
const DARK_BG = '#1a191b';

export function normalizeTint(value, fallback = '#007aff') {
  const m = typeof value === 'string' ? HEX.exec(value.trim()) : null;
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(normalizeTint(h).slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

function luminance(h) {
  const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Black or white text for a solid background of the given colour. */
export function onTint(h) {
  const [r, g, b] = rgb(h);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#000' : '#fff';
}

const mix = (h, target, t) => { const a = rgb(h); const b = rgb(target); return hex(a.map((v, i) => v + (b[i] - v) * t)); };

/** The tint, darkened (light mode) or lightened (dark mode) just enough to reach 4.5:1 on the page background. */
export function readableTint(h, dark = false) {
  const bg = dark ? DARK_BG : '#ffffff';
  const towards = dark ? '#ffffff' : '#000000';
  let out = normalizeTint(h);
  for (let t = 0; t <= 1 && contrast(out, bg) < 4.5; t += 0.05) out = mix(h, towards, t);
  return out;
}
```

`site/src/styles/global.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-glass: var(--glass);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-tint: var(--tint);
  --radius-card: var(--radius);
}

:root {
  --tint: #007aff;
  --tint-readable: #007aff;
  --tint-readable-dark: #0a84ff;
  --primary: var(--tint-readable);
  --primary-foreground: #ffffff;
  --background: #ffffff;
  --foreground: #000000;
  --card: #ebebeb;
  --muted-foreground: rgba(0, 0, 0, 0.5);
  --border: rgba(0, 0, 0, 0.15);
  --glass: rgba(255, 255, 255, 0.75);
  --radius: 1.5rem;
}

.dark {
  --primary: var(--tint-readable-dark);
  --background: rgb(26, 25, 27);
  --foreground: #ffffff;
  --card: rgb(46, 45, 47);
  --muted-foreground: rgba(255, 255, 255, 0.5);
  --border: rgba(255, 255, 255, 0.15);
  --glass: rgba(26, 25, 27, 0.75);
}

html { scrollbar-gutter: stable; }
body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }

*:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 6px; }

.skip-link { position: absolute; left: 1rem; top: -4rem; z-index: 100; padding: 0.5rem 0.75rem; border-radius: 9999px; background: var(--primary); color: var(--primary-foreground); font-weight: 600; }
.skip-link:focus { top: 1rem; }

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

.nav-fade { transition: opacity 0.25s ease-in-out; }
.nav-fade[data-hidden] { opacity: 0; pointer-events: none; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

`site/src/components/Icon.astro`:
```astro
---
import * as icons from '@hugeicons/core-free-icons';
const { name, class: cls = 'size-4', strokeWidth = 1.5, title } = Astro.props;
const def = icons[name] ?? icons.InformationCircleIcon;
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const attrs = (o) => Object.entries(o).filter(([k]) => k !== 'key').map(([k, v]) => `${kebab(k)}="${String(v).replace(/"/g, '&quot;')}"`).join(' ');
const inner = (title ? `<title>${String(title).replace(/</g, '&lt;')}</title>` : '') + def.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join('');
---
<svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} focusable="false" set:html={inner}></svg>
```

`site/src/components/Pill.astro`:
```astro
---
const { href, label, class: cls = '', ...rest } = Astro.props;
---
{href ? <a href={href} class={`pill ${cls}`} {...rest}>{label}</a> : <button type="button" class={`pill ${cls}`} {...rest}>{label}</button>}
```

`site/src/components/SectionHeader.astro`:
```astro
---
const { title, href, linkLabel = 'View All', as = 'h2', id } = Astro.props;
const Tag = as;
---
<div class="flex items-baseline justify-between gap-4 px-1">
  <Tag id={id} class={as === 'h1' ? 'text-[1.9rem] font-bold tracking-tight' : 'text-[1.4rem] font-bold tracking-tight'}>{title}</Tag>
  {href && <a href={href} class="shrink-0 text-[1.02em] font-[450] text-primary hover:underline">{linkLabel}</a>}
</div>
```

`site/src/components/NavBar.astro`:
```astro
---
import Icon from './Icon.astro';
const { title, icon, back, revealOnScroll = false } = Astro.props;
const hasTrailing = Astro.slots.has('trailing');
---
<header class="sticky top-0 z-40 border-b border-border bg-glass backdrop-blur-xl" data-navbar data-reveal={revealOnScroll ? '' : undefined}>
  <nav class="mx-auto flex h-11 max-w-6xl items-center gap-2 px-4" aria-label="Page">
    <div class="flex min-w-[78px] items-center">
      {back && <a href={back.href} class="-ml-1 flex items-center gap-0.5 text-[1.05em] font-[450] text-primary hover:underline"><Icon name="ArrowLeft01Icon" class="size-5" strokeWidth={2} />{back.label}</a>}
    </div>
    <div class="nav-fade flex min-w-0 flex-1 items-center justify-center gap-1.5 font-semibold" data-nav-title data-hidden={revealOnScroll ? '' : undefined} aria-hidden={revealOnScroll ? 'true' : undefined}>
      {icon && <img src={icon} alt="" width="28" height="28" class="app-icon size-7 rounded-lg" />}
      <p class="truncate">{title}</p>
    </div>
    <div class="nav-fade flex min-w-[78px] items-center justify-end gap-2" data-nav-trailing data-hidden={revealOnScroll && hasTrailing ? '' : undefined}>
      <slot name="trailing" />
    </div>
  </nav>
</header>
<script>
  const bar = document.querySelector('[data-navbar][data-reveal]');
  const sentinel = document.querySelector('[data-nav-sentinel]');
  if (bar && sentinel && 'IntersectionObserver' in window) {
    const parts = bar.querySelectorAll('[data-nav-title], [data-nav-trailing]');
    new IntersectionObserver(([e]) => { for (const p of parts) { p.toggleAttribute('data-hidden', e.isIntersecting); p.setAttribute('aria-hidden', e.isIntersecting ? 'true' : 'false'); } }, { rootMargin: '-44px 0px 0px 0px' }).observe(sentinel);
  }
</script>
```

`site/src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import Icon from '../components/Icon.astro';
import { getSite } from '../lib/data.mjs';
import { normalizeTint, readableTint } from '../lib/tint.mjs';
const { title, description, image, noindex = false, tint, width = 'narrow' } = Astro.props;
const site = await getSite();
const fullTitle = title ? `${title} · ${site.meta.name}` : site.meta.name;
const desc = description ?? site.meta.subtitle ?? '';
const color = normalizeTint(tint ?? site.meta.tintColor);
const vars = `--tint: ${color}; --tint-readable: ${readableTint(color, false)}; --tint-readable-dark: ${readableTint(color, true)}`;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{fullTitle}</title>
  <meta name="description" content={desc} />
  {noindex && <meta name="robots" content="noindex" />}
  <link rel="canonical" href={canonical} />
  <link rel="icon" href={site.meta.iconURL} />
  <link rel="apple-touch-icon" href={site.meta.iconURL} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={site.meta.name} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={desc} />
  <meta property="og:image" content={image ?? site.meta.headerURL ?? site.meta.iconURL} />
  <meta property="og:url" content={canonical} />
  <meta name="twitter:card" content="summary" />
  <meta name="theme-color" content={color} />
  <script is:inline>
    (function () {
      try {
        var t = localStorage.getItem('theme');
        var dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', dark);
      } catch (e) {}
    })();
  </script>
</head>
<body class="min-h-dvh bg-background text-foreground antialiased" style={vars}>
  <a href="#main" class="skip-link">Skip to content</a>
  <slot name="nav" />
  <main id="main" tabindex="-1" class={`mx-auto w-full px-4 pt-3 pb-16 outline-none ${width === 'wide' ? 'max-w-6xl' : 'max-w-2xl'}`}>
    <slot />
  </main>
  <footer class="mx-auto max-w-6xl px-5 pb-10 text-[0.8rem] text-muted-foreground">
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <p>{site.meta.name} · AltStore PAL installs notarized apps in the EU, Japan and Brazil; AltStore Classic and SideStore sideload IPAs everywhere.</p>
      <p class="flex gap-3"><a class="hover:text-primary" href={site.urls.pal}>source.pal.json</a><a class="hover:text-primary" href={site.urls.classic}>source.json</a></p>
    </div>
  </footer>
  <button type="button" data-theme-toggle class="fixed right-4 bottom-4 z-30 flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-md hover:text-primary" aria-label="Toggle dark mode" aria-pressed="false">
    <span class="dark:hidden"><Icon name="Moon02Icon" class="size-5" /></span>
    <span class="hidden dark:inline"><Icon name="Sun03Icon" class="size-5" /></span>
  </button>
  <script>
    const toggle = document.querySelector('[data-theme-toggle]');
    const sync = () => toggle?.setAttribute('aria-pressed', String(document.documentElement.classList.contains('dark')));
    sync();
    toggle?.addEventListener('click', () => {
      const dark = document.documentElement.classList.toggle('dark');
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
      sync();
    });
  </script>
</body>
</html>
```

- [ ] Step 3: green; commit `feat(site): Hugeicons, shadcn-style tokens, accessible nav bar and pill primitives`.

---

### Task 2: Components

**Files:** `site/src/components/AppRow.astro`, `Badge.astro`, `SourceCard.astro`, `SourceURLChip.astro`, `ActionSheet.astro`, `NewsCard.astro`, `Screenshots.astro`, `Permissions.astro`, `Text.astro`; delete `AppCard.astro`, `AppGrid.astro`, `AddSource.astro`, `Nav.astro`, `Footer.astro`.

`site/src/components/Badge.astro`:
```astro
---
const { kind, class: cls = '' } = Astro.props;
const label = kind === 'adp' ? 'PAL' : kind === 'ipa' ? 'Sideload' : kind;
const tone = kind === 'adp' ? 'bg-tint text-white' : 'bg-black/15 text-black/70 dark:bg-white/20 dark:text-white/80';
---
<span class={`inline-block rounded-full px-[6.5px] py-px align-middle text-[10px] leading-[1.33] font-bold uppercase ${tone} ${cls}`}>{label}</span>
```

`site/src/components/AppRow.astro`:
```astro
---
import Badge from './Badge.astro';
import { normalizeTint } from '../lib/tint.mjs';
const { entry, label = 'View', href, link = true } = Astro.props;
const { app, kinds } = entry;
const base = import.meta.env.BASE_URL;
const target = href ?? `${base}apps/${encodeURIComponent(app.bundleIdentifier)}/`;
const style = app.tintColor ? `--tint: ${normalizeTint(app.tintColor)}` : undefined;
const Tag = link ? 'a' : 'div';
---
<Tag href={link ? target : undefined} class="relative flex items-center gap-3 overflow-hidden rounded-[1.5em] p-4 text-inherit transition hover:opacity-75" style={style}
  data-app data-name={`${app.name} ${app.subtitle ?? ''} ${app.developerName}`.toLowerCase()} data-category={app.category ?? 'other'} data-kinds={kinds.join(' ')}>
  <div class="absolute inset-0 bg-tint opacity-20"></div>
  <img src={app.iconURL} alt="" width="64" height="64" loading="lazy" class="app-icon relative size-16 shrink-0 rounded-[14px] bg-card object-cover" />
  <div class="relative flex min-w-0 flex-1 items-center justify-between gap-3">
    <div class="min-w-0">
      <p class="font-semibold leading-tight">{app.name} {kinds.map((k) => <Badge kind={k} class="ml-1" />)}</p>
      <p class="truncate text-[0.85em] opacity-50">{app.developerName}</p>
    </div>
    <slot name="button"><span class="pill shrink-0">{label}</span></slot>
  </div>
</Tag>
```

`site/src/components/SourceURLChip.astro`:
```astro
---
import Icon from './Icon.astro';
const { label, url } = Astro.props;
---
<button type="button" data-copy={url} class="flex w-full items-center gap-2 rounded-[10px] bg-black/[.08] px-3 py-2 text-left text-primary hover:opacity-75 dark:bg-white/[.12]" aria-label={`Copy ${label} source URL`}>
  <span class="shrink-0 text-[0.75em] font-semibold uppercase opacity-60">{label}</span>
  <span class="min-w-0 flex-1 truncate text-[0.95em]">{url}</span>
  <span class="shrink-0" data-copy-icon><Icon name="Copy01Icon" class="size-4" /></span>
  <span class="hidden shrink-0" data-copied-icon><Icon name="Tick02Icon" class="size-4" strokeWidth={2.5} /></span>
  <span class="sr-only" aria-live="polite" data-copy-status></span>
</button>
<script>
  for (const b of document.querySelectorAll('[data-copy]')) {
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        b.querySelector('[data-copy-icon]').classList.add('hidden');
        b.querySelector('[data-copied-icon]').classList.remove('hidden');
        b.querySelector('[data-copy-status]').textContent = 'Copied';
        setTimeout(() => { b.querySelector('[data-copy-icon]').classList.remove('hidden'); b.querySelector('[data-copied-icon]').classList.add('hidden'); b.querySelector('[data-copy-status]').textContent = ''; }, 1500);
      } catch {}
    });
  }
</script>
```

`site/src/components/SourceCard.astro`:
```astro
---
import { getSite } from '../lib/data.mjs';
import { onTint, normalizeTint } from '../lib/tint.mjs';
const { href, subtitle, sheet } = Astro.props;
const site = await getSite();
const tint = normalizeTint(site.meta.tintColor);
const fg = onTint(tint);
const Tag = href ? 'a' : 'button';
---
<Tag href={href} type={href ? undefined : 'button'} data-sheet={sheet} class="flex w-full items-center gap-3 rounded-[1.5rem] p-4 text-left transition hover:opacity-75" style={`background-color: ${tint}; color: ${fg}`}>
  <img src={site.meta.iconURL} alt="" width="42" height="42" class="size-[42px] shrink-0 rounded-full" />
  <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
    <div class="min-w-0">
      <p class="font-semibold">{site.meta.name}</p>
      <p class="truncate text-[0.85em] opacity-60">{subtitle ?? site.meta.subtitle}</p>
    </div>
    <span class="flex h-8 min-w-14 shrink-0 items-center justify-center rounded-full px-3 text-[15px] font-bold uppercase" style={`background-color: ${fg === '#fff' ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.15)'}`}>{site.apps.length} {site.apps.length === 1 ? 'app' : 'apps'}</span>
  </div>
</Tag>
```

`site/src/components/ActionSheet.astro`:
```astro
---
const { id, title, message, actions = [] } = Astro.props;
---
<dialog id={id} data-action-sheet aria-labelledby={`${id}-title`} class="m-0 mt-auto w-full max-w-lg bg-transparent p-2 backdrop:bg-black/40 sm:m-auto" style="margin-inline: auto">
  <div class="overflow-hidden rounded-[1em] bg-glass backdrop-blur-xl">
    <div class="px-4 py-3 text-center">
      <p id={`${id}-title`} class="text-[0.85em] font-semibold text-muted-foreground">{title}</p>
      {message && <p class="mt-0.5 text-[0.8em] text-muted-foreground">{message}</p>}
    </div>
    {actions.map((a) => (
      <a href={a.href} download={a.download ? '' : undefined} class={`block border-t border-border py-3.5 text-center text-[1.1em] text-primary hover:bg-black/5 dark:hover:bg-white/5 ${a.primary ? 'font-semibold' : ''}`}>{a.label}</a>
    ))}
  </div>
  <button type="button" data-close class="mt-2 block w-full rounded-[1em] bg-background py-3.5 text-center text-[1.1em] font-semibold text-primary hover:bg-card">Cancel</button>
</dialog>
<script>
  for (const trigger of document.querySelectorAll('[data-sheet]')) {
    trigger.addEventListener('click', (e) => { const d = document.getElementById(trigger.dataset.sheet); if (d) { e.preventDefault(); d.showModal(); } });
  }
  for (const d of document.querySelectorAll('[data-action-sheet]')) {
    d.querySelector('[data-close]').addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
</script>
```

`site/src/components/NewsCard.astro`:
```astro
---
import AppRow from './AppRow.astro';
import { formatDate } from '../lib/data.mjs';
import { normalizeTint, onTint } from '../lib/tint.mjs';
const { item, apps, minimal = false } = Astro.props;
const app = item.appID && !minimal ? apps.find((a) => a.id === item.appID) : null;
const tint = item.tintColor ? normalizeTint(item.tintColor) : null;
const style = tint ? `background-color: ${tint}; color: ${onTint(tint)}` : 'background-color: var(--tint); color: #fff';
const Wrapper = item.url ? 'a' : 'div';
---
<div class="flex flex-col gap-3">
  <Wrapper href={item.url} rel={item.url ? 'noopener' : undefined} class="block overflow-hidden rounded-[1.5em] transition hover:opacity-75" style={style}>
    <div class="m-6 line-clamp-4">
      <p class="mb-1 text-[0.8em] font-medium uppercase opacity-75">{formatDate(item.date)}</p>
      <h3 class="mb-1 text-[1.1em] leading-snug font-bold">{item.title}</h3>
      <p class="text-[0.9em]">{item.caption}</p>
    </div>
    {item.imageURL && !minimal && <div class="max-h-[15em] overflow-hidden"><img src={item.imageURL} alt="" loading="lazy" class="block w-full" /></div>}
  </Wrapper>
  {app && <AppRow entry={app} />}
</div>
```

`site/src/components/Screenshots.astro`:
```astro
---
import Icon from './Icon.astro';
import { screenshotsOf } from '../lib/data.mjs';
const { app } = Astro.props;
const shots = screenshotsOf(app);
const groups = [['iphone', 'iPhone', shots.iphone], ['ipad', 'iPad', shots.ipad]].filter(([, , list]) => list.length > 0);
---
{groups.length > 0 && (
  <section class="mt-4" data-shots>
    {groups.length > 1 && (
      <div class="mb-3 flex justify-center">
        <div class="flex rounded-lg bg-card p-0.5 text-[0.8em] font-semibold" role="tablist">
          {groups.map(([key, label], i) => <button type="button" role="tab" aria-selected={i === 0 ? 'true' : 'false'} aria-controls={`shots-${key}`} tabindex={i === 0 ? 0 : -1} data-tab={key} class="rounded-md px-3 py-1 aria-selected:bg-background aria-selected:shadow">{label}</button>)}
        </div>
      </div>
    )}
    {groups.map(([key, label, list], i) => (
      <div data-panel={key} id={`shots-${key}`} role={groups.length > 1 ? 'tabpanel' : undefined} hidden={i !== 0} class="snap-strip -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        {list.map((s, n) => (
          <button type="button" data-shot={s.imageURL} class="max-w-[70%] shrink-0 snap-start sm:max-w-none" aria-label={`Open ${label} screenshot ${n + 1}`}>
            <img src={s.imageURL} alt={`${app.name} ${label} screenshot ${n + 1}`} loading="lazy" width={s.width} height={s.height} class={`app-icon ${key === 'ipad' ? 'sm:h-72' : 'sm:h-[26rem]'} w-auto min-w-36 rounded-lg bg-card object-contain`} />
          </button>
        ))}
      </div>
    ))}
    <dialog data-lightbox aria-label="Screenshot" class="m-auto max-h-[92vh] max-w-[92vw] rounded-2xl bg-transparent p-0 backdrop:bg-black/85">
      <button type="button" data-close class="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white" aria-label="Close"><Icon name="Cancel01Icon" class="size-4" /></button>
      <img alt="" class="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain" />
    </dialog>
  </section>
)}
<script>
  const select = (tab) => {
    const section = tab.closest('[data-shots]');
    for (const t of section.querySelectorAll('[data-tab]')) { const on = t === tab; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; }
    for (const p of section.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== tab.dataset.tab;
    tab.focus();
  };
  for (const tab of document.querySelectorAll('[data-tab]')) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[data-tab]')];
      const i = tabs.indexOf(tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(tabs[(i + 1) % tabs.length]); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length]); }
    });
  }
  for (const btn of document.querySelectorAll('[data-shot]')) {
    btn.addEventListener('click', () => { const d = btn.closest('[data-shots]').querySelector('[data-lightbox]'); d.querySelector('img').src = btn.dataset.shot; d.showModal(); });
  }
  for (const d of document.querySelectorAll('[data-lightbox]')) {
    d.querySelector('[data-close]').addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
</script>
```

`site/src/components/Permissions.astro`:
```astro
---
import Icon from './Icon.astro';
import { entitlementInfo, privacyInfo } from '../lib/permissions.mjs';
const { app } = Astro.props;
const ents = (app.appPermissions?.entitlements ?? []).map(entitlementInfo);
const priv = Object.entries(app.appPermissions?.privacy ?? {}).map(([k, v]) => privacyInfo(k, v));
const cards = [
  priv.length
    ? { icon: 'UserLock01Icon', title: 'Privacy', text: `"${app.name}" may request to access the following:`, items: priv }
    : { icon: 'UserRemove01Icon', title: 'Unknown', text: app.appPermissions ? 'This app declares no privacy usage.' : 'The developer has not specified any permissions for this app.', items: [] },
  ents.length ? { icon: 'Key01Icon', title: 'Entitlements', text: 'Entitlements are additional permissions that grant access to certain system services, including potentially sensitive information.', items: ents } : null,
].filter(Boolean);
---
<div class="mt-4 flex flex-col gap-7">
  {cards.map((c) => (
    <div class="rounded-[1.5em] bg-card p-5 shadow-[0_4px_10px_rgba(0,0,0,.15)]">
      <div class="flex flex-col items-center gap-1 text-center">
        <Icon name={c.icon} class="size-8 text-primary" />
        <p class="text-[1.25em] font-bold">{c.title}</p>
        <p class="text-[0.9em] leading-relaxed opacity-50">{c.text}</p>
      </div>
      {c.items.length > 0 && (
        <div class="mt-4 mb-2 grid grid-cols-2 gap-x-2 gap-y-2">
          {c.items.map((p) => (
            <button type="button" data-alert-title={p.name} data-alert-message={p.description} class="flex w-fit max-w-full items-center gap-2 text-left text-[0.85em] hover:underline">
              <Icon name={p.icon} class="size-5 shrink-0" /><span class="min-w-0">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  ))}
</div>
<dialog data-alert aria-labelledby="perm-alert-title" class="m-auto w-[17rem] rounded-[1em] bg-glass p-0 text-center backdrop-blur-xl backdrop:bg-black/40">
  <div class="px-4 pt-5 pb-4"><p id="perm-alert-title" class="font-semibold" data-alert-heading></p><p class="mt-1 text-[0.85em] opacity-70" data-alert-body></p></div>
  <button type="button" data-close class="block w-full border-t border-border py-3 text-primary hover:bg-black/5 dark:hover:bg-white/5">OK</button>
</dialog>
<script>
  const alert = document.querySelector('[data-alert]');
  if (alert) {
    alert.querySelector('[data-close]').addEventListener('click', () => alert.close());
    alert.addEventListener('click', (e) => { if (e.target === alert) alert.close(); });
    for (const b of document.querySelectorAll('[data-alert-title]')) {
      b.addEventListener('click', () => { alert.querySelector('[data-alert-heading]').textContent = b.dataset.alertTitle; alert.querySelector('[data-alert-body]').textContent = b.dataset.alertMessage; alert.showModal(); });
    }
  }
</script>
```

`site/src/components/Text.astro`:
```astro
---
import { linkify } from '../lib/data.mjs';
const { text, clamp = 0, class: cls = '' } = Astro.props;
const html = linkify(text);
const lines = clamp === 3 ? 'line-clamp-3' : clamp === 5 ? 'line-clamp-5' : '';
---
{clamp ? (
  <div class={`group relative ${cls}`} data-clamp>
    <p class={`${lines} whitespace-pre-line break-words group-data-[open]:line-clamp-none`} set:html={html}></p>
    <button type="button" data-toggle class="absolute right-0 bottom-0 hidden bg-gradient-to-r from-transparent from-0% via-ios-bg via-35% to-ios-bg pl-9 text-[15px] font-medium leading-[1.5em] text-primary group-data-[overflow]:inline">more</button>
  </div>
) : (
  <p class={`whitespace-pre-line break-words ${cls}`} set:html={html}></p>
)}
<script>
  for (const box of document.querySelectorAll('[data-clamp]')) {
    const p = box.querySelector('p');
    const btn = box.querySelector('[data-toggle]');
    if (p.scrollHeight > p.clientHeight + 2) box.setAttribute('data-overflow', '');
    btn?.addEventListener('click', () => { box.setAttribute('data-open', ''); btn.remove(); });
  }
</script>
```

- [ ] Step 1: write the files, delete the replaced ones; commit `feat(site): AltStore-style components`.

---

### Task 3: Pages

**Files:** `site/src/pages/index.astro`, `apps/index.astro`, `apps/[id]/index.astro`, `apps/[id]/versions/index.astro`, `news/index.astro`, `status/index.astro`, `404.astro`

`site/src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import NavBar from '../components/NavBar.astro';
import Pill from '../components/Pill.astro';
import Icon from '../components/Icon.astro';
import SectionHeader from '../components/SectionHeader.astro';
import SourceURLChip from '../components/SourceURLChip.astro';
import AppRow from '../components/AppRow.astro';
import NewsCard from '../components/NewsCard.astro';
import Text from '../components/Text.astro';
import ActionSheet from '../components/ActionSheet.astro';
import { getSite, universalLink } from '../lib/data.mjs';
const site = await getSite();
const base = import.meta.env.BASE_URL;
const { meta, apps, featured, news, counts } = site;
const rows = featured.length ? featured : apps.slice(0, 6);
const addActions = [
  { label: 'Add to AltStore PAL', href: universalLink(site.urls.pal), primary: true },
  { label: 'Add to AltStore Classic', href: universalLink(site.urls.classic) },
  { label: 'Add to SideStore', href: `sidestore://source?url=${encodeURIComponent(site.urls.classic)}` },
];
---
<Base width="wide">
  <NavBar slot="nav" title={meta.name} icon={meta.iconURL} revealOnScroll><Pill slot="trailing" label="Add" data-sheet="add-source" /></NavBar>
  <section class="relative -mx-4 overflow-hidden px-4 pt-3 pb-4 lg:mx-0 lg:mt-2 lg:rounded-[var(--radius)] lg:px-8 lg:py-10" aria-labelledby="source-title">
    {meta.headerURL && <img src={meta.headerURL} alt="" class="absolute inset-0 -z-10 hidden h-full w-full scale-110 object-cover opacity-40 blur-2xl lg:block" />}
    <div class="flex items-center gap-4 lg:gap-6">
      <img src={meta.iconURL} alt="" width="64" height="64" class="app-icon size-16 shrink-0 rounded-full lg:size-32" />
      <div class="min-w-0 flex-1">
        <h1 id="source-title" class="text-[1.9rem] leading-tight font-bold tracking-tight lg:text-5xl">{meta.name}</h1>
        {meta.subtitle && <p class="text-[0.95em] text-muted-foreground lg:mt-1 lg:text-lg">{meta.subtitle}</p>}
        <p class="mt-1 text-[0.8em] font-medium uppercase text-muted-foreground">{apps.length} {apps.length === 1 ? 'app' : 'apps'} · {counts.pal} PAL · {counts.classic} sideload</p>
      </div>
      <Pill label="Add" data-sheet="add-source" aria-haspopup="dialog" />
    </div>
  </section>
  <div data-nav-sentinel></div>
  <div class="mt-3 grid gap-2 sm:grid-cols-2">
    <SourceURLChip label="PAL" url={site.urls.pal} />
    <SourceURLChip label="Classic" url={site.urls.classic} />
  </div>

  {news.length > 0 && (
    <section class="mt-8" aria-labelledby="news-h">
      <SectionHeader id="news-h" title="News" href={`${base}news/`} />
      <div class="snap-strip -mx-4 mt-3 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
        {news.slice(0, 6).map((item) => <div class="w-[88%] shrink-0 snap-start sm:w-[60%] lg:w-auto"><NewsCard item={item} apps={apps} minimal /></div>)}
      </div>
    </section>
  )}

  <section class="mt-8" aria-labelledby="apps-h">
    <SectionHeader id="apps-h" title={featured.length ? 'Featured Apps' : 'Apps'} href={`${base}apps/`} linkLabel="View All Apps" />
    {rows.length === 0 ? (
      <p class="mt-3 rounded-[var(--radius)] bg-card p-6 text-center text-[0.95em] text-muted-foreground">No apps yet. Add the source now and they will appear as they are published.</p>
    ) : (
      <div class="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{rows.map((entry) => <AppRow entry={entry} />)}</div>
    )}
  </section>

  {(meta.description || meta.website) && (
    <section class="mt-8" aria-labelledby="about-h">
      <SectionHeader id="about-h" title="About" />
      <div class="mt-2 px-1 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
        <div>{meta.description && <Text text={meta.description} clamp={5} />}</div>
        {meta.website && <p class="mt-2 lg:mt-0"><a href={meta.website} rel="noopener" class="inline-flex items-center gap-1 text-primary hover:underline"><Icon name="Link01Icon" class="size-4" />{meta.website}</a></p>}
      </div>
    </section>
  )}
  <ActionSheet id="add-source" title={`Add "${meta.name}"`} message="Choose the app you use. The source keeps your apps updated." actions={addActions} />
</Base>
```

`site/src/pages/apps/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import NavBar from '../../components/NavBar.astro';
import Icon from '../../components/Icon.astro';
import AppRow from '../../components/AppRow.astro';
import { getSite, screenshotsOf } from '../../lib/data.mjs';
const { apps } = await getSite();
const base = import.meta.env.BASE_URL;
---
<Base title="Apps" description="Every app in this source." width="wide">
  <NavBar slot="nav" title="All Apps" back={{ href: base, label: 'Home' }} />
  <h1 class="sr-only">All Apps</h1>
  {apps.length > 0 && (
    <label class="relative mt-2 block">
      <span class="sr-only">Search apps</span>
      <Icon name="Search01Icon" class="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
      <input type="search" placeholder="Search" data-search class="w-full rounded-[10px] bg-card py-2 pr-3 pl-9 text-[0.95em] outline-none focus:ring-2 focus:ring-primary" />
    </label>
  )}
  {apps.length === 0 ? (
    <p class="mt-4 rounded-[var(--radius)] bg-card p-6 text-center text-muted-foreground">No apps yet.</p>
  ) : (
    <div class="mt-4 grid gap-x-8 gap-y-10 lg:grid-cols-2" data-grid>
      {apps.map((entry) => { const shots = screenshotsOf(entry.app).iphone.slice(0, 2); return (
        <div data-block data-name={`${entry.app.name} ${entry.app.subtitle ?? ''} ${entry.app.developerName}`.toLowerCase()}>
          <AppRow entry={entry} />
          {entry.app.subtitle && <p class="mx-4 mt-3 text-center text-[0.9em]">{entry.app.subtitle}</p>}
          {shots.length > 0 && (
            <div class="mt-3 flex justify-between gap-3">
              {shots.map((s, i) => <a href={`${base}apps/${encodeURIComponent(entry.id)}/`} class="block max-w-[48%]" aria-label={`${entry.app.name} screenshot ${i + 1}`}><img src={s.imageURL} alt="" loading="lazy" width={s.width} height={s.height} class="app-icon rounded-md bg-card" /></a>)}
            </div>
          )}
        </div>
      ); })}
      <p class="hidden py-10 text-center text-muted-foreground lg:col-span-2" data-empty role="status">No apps match.</p>
    </div>
  )}
</Base>
<script>
  const search = document.querySelector('[data-search]');
  const grid = document.querySelector('[data-grid]');
  if (search && grid) {
    const blocks = [...grid.querySelectorAll('[data-block]')];
    const empty = grid.querySelector('[data-empty]');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const b of blocks) { const ok = !q || b.dataset.name.includes(q); b.hidden = !ok; if (ok) shown++; }
      empty.hidden = shown > 0;
    });
  }
</script>
```

`site/src/pages/apps/[id]/index.astro`:
```astro
---
import Base from '../../../layouts/Base.astro';
import NavBar from '../../../components/NavBar.astro';
import Pill from '../../../components/Pill.astro';
import Badge from '../../../components/Badge.astro';
import SectionHeader from '../../../components/SectionHeader.astro';
import AppRow from '../../../components/AppRow.astro';
import Text from '../../../components/Text.astro';
import Screenshots from '../../../components/Screenshots.astro';
import Permissions from '../../../components/Permissions.astro';
import SourceCard from '../../../components/SourceCard.astro';
import ActionSheet from '../../../components/ActionSheet.astro';
import { getSite, installLinks, formatBytes, formatDate, versionLabel } from '../../../lib/data.mjs';

export async function getStaticPaths() {
  const site = await getSite();
  return site.apps.map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}
const { entry } = Astro.props;
const site = await getSite();
const { app, kinds, latest } = entry;
const base = import.meta.env.BASE_URL;
const links = installLinks(entry, site.urls);
const single = links.length === 1 ? links[0] : null;
const getProps = single ? { href: single.href } : { 'data-sheet': 'get', 'aria-haspopup': 'dialog' };
const info = [
  ['Version', versionLabel(latest)],
  ['Size', formatBytes(latest.size)],
  ['Requires', latest.minOSVersion ? `iOS ${latest.minOSVersion} or later` : null],
  ['Category', app.category ?? 'other'],
  ['Updated', formatDate(latest.date)],
  ['Available on', kinds.map((k) => (k === 'adp' ? 'AltStore PAL' : 'AltStore Classic / SideStore')).join(', ')],
  ['Bundle ID', app.bundleIdentifier],
].filter(([, v]) => v);
---
<Base title={app.name} description={app.subtitle ?? app.localizedDescription.slice(0, 150)} image={app.iconURL} tint={app.tintColor} width="wide">
  <NavBar slot="nav" title={app.name} icon={app.iconURL} back={{ href: `${base}apps/`, label: 'Back' }} revealOnScroll>
    <Pill slot="trailing" label="Get" {...getProps} />
  </NavBar>

  <div class="lg:hidden">
    <AppRow entry={entry} link={false} heading><Pill slot="button" label="Get" class="shrink-0" {...getProps} /></AppRow>
    {app.subtitle && <p class="mx-4 mt-3 text-center text-[0.9em]">{app.subtitle}</p>}
  </div>

  <header class="hidden lg:flex lg:items-start lg:gap-8 lg:pt-6">
    <img src={app.iconURL} alt="" width="160" height="160" class="app-icon size-40 shrink-0 rounded-[36px] bg-card" />
    <div class="min-w-0 flex-1">
      <h1 class="text-4xl font-bold tracking-tight">{app.name} {kinds.map((k) => <Badge kind={k} class="ml-1 align-middle" />)}</h1>
      {app.subtitle && <p class="mt-1 text-xl text-muted-foreground">{app.subtitle}</p>}
      <p class="mt-1 text-primary">{app.developerName}</p>
      <div class="mt-5 flex flex-wrap items-center gap-4">
        <Pill label="Get" class="!h-9 !min-w-24 !text-base" {...getProps} />
        {links.length > 1 && links.slice(1).map((l) => <a href={l.href} download={l.download ? '' : undefined} class="text-[0.95em] text-primary hover:underline">{l.label}</a>)}
      </div>
    </div>
  </header>
  <div data-nav-sentinel></div>

  <section class="mt-6" aria-labelledby="preview-h">
    <SectionHeader id="preview-h" title="Preview" />
    <Screenshots app={app} />
  </section>

  <div class="lg:mt-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-10">
    <div>
      <section class="mt-4" aria-labelledby="about-h">
        <h2 id="about-h" class="sr-only">About</h2>
        <div class="px-1"><Text text={app.localizedDescription} clamp={5} /></div>
      </section>

      <section class="mt-8" aria-labelledby="new-h">
        <SectionHeader id="new-h" title="What's New" href={app.versions.length > 1 ? `${base}apps/${encodeURIComponent(app.bundleIdentifier)}/versions/` : undefined} linkLabel="Version History" />
        <div class="mt-2 flex items-baseline justify-between px-1 text-muted-foreground"><p>Version {versionLabel(latest)}</p><p>{formatDate(latest.date)}</p></div>
        <div class="mt-1 px-1"><Text text={latest.localizedDescription ?? 'No release notes for this version.'} clamp={3} /></div>
      </section>

      <section class="mt-8" aria-labelledby="perm-h">
        <SectionHeader id="perm-h" title="App Permissions" />
        <Permissions app={app} />
      </section>
    </div>

    <aside class="lg:sticky lg:top-16 lg:self-start" aria-label="Information and source">
      <section class="mt-8 lg:mt-4" aria-labelledby="info-h">
        <SectionHeader id="info-h" title="Information" />
        <dl class="mt-3 divide-y divide-border rounded-[var(--radius)] bg-card px-4 text-[0.95em]">
          {info.map(([k, v]) => <div class="flex items-baseline justify-between gap-4 py-2.5"><dt class="text-muted-foreground">{k}</dt><dd class="truncate text-right font-medium">{v}</dd></div>)}
        </dl>
      </section>
      <section class="mt-8" aria-labelledby="src-h">
        <SectionHeader id="src-h" title="Discover More On" />
        <div class="mt-3"><SourceCard href={base} /></div>
      </section>
    </aside>
  </div>

  {!single && <ActionSheet id="get" title={`Get "${app.name}"`} message="Choose how to install." actions={links} />}
</Base>
```

`site/src/pages/apps/[id]/versions/index.astro`:
```astro
---
import Base from '../../../../layouts/Base.astro';
import NavBar from '../../../../components/NavBar.astro';
import Badge from '../../../../components/Badge.astro';
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
const link = (v) => (inferKind(v) === 'ipa' ? { href: v.downloadURL, label: 'Download IPA', download: true } : { href: universalLink(site.urls.pal, app.bundleIdentifier), label: 'Get in AltStore PAL' });
---
<Base title={`${app.name} versions`} description={`Version history of ${app.name}.`} image={app.iconURL} tint={app.tintColor}>
  <NavBar slot="nav" title="Version History" back={{ href: `${base}apps/${encodeURIComponent(app.bundleIdentifier)}/`, label: 'Back' }} />
  <h1 class="sr-only">{app.name} version history</h1>
  <ol class="mt-2 divide-y divide-border px-1">
    {app.versions.map((v) => { const l = link(v); return (
      <li class="py-5 first:pt-2">
        <div class="flex items-baseline justify-between"><p class="font-semibold">{versionLabel(v)} <Badge kind={inferKind(v)} class="ml-1" /></p><p class="text-muted-foreground">{formatDate(v.date)}</p></div>
        <div class="mt-1 flex items-baseline justify-between text-[0.9em]"><a href={l.href} download={l.download ? '' : undefined} class="text-primary hover:underline">{l.label}</a><p class="text-muted-foreground">{[v.size ? formatBytes(v.size) : null, v.minOSVersion ? `iOS ${v.minOSVersion}+` : null].filter(Boolean).join(' · ')}</p></div>
        <div class="mt-2"><Text text={v.localizedDescription ?? 'No release notes.'} clamp={3} /></div>
      </li>
    ); })}
  </ol>
</Base>
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
  <NavBar slot="nav" title="All News" back={{ href: base, label: 'Home' }} />
  <h1 class="sr-only">All News</h1>
  {news.length === 0 ? (
    <p class="mt-4 rounded-[var(--radius)] bg-card p-6 text-center text-muted-foreground">Nothing yet.</p>
  ) : (
    <div class="mt-2 grid gap-8 lg:grid-cols-2">{news.map((item) => <NewsCard item={item} apps={apps} />)}</div>
  )}
</Base>
```

`site/src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import NavBar from '../components/NavBar.astro';
import Pill from '../components/Pill.astro';
const base = import.meta.env.BASE_URL;
---
<Base title="Not found" noindex>
  <NavBar slot="nav" title="Not Found" back={{ href: base, label: 'Home' }} />
  <div class="py-24 text-center">
    <h1 class="text-6xl font-bold text-primary">404</h1>
    <p class="mt-3 text-muted-foreground">That page does not exist.</p>
    <div class="mt-6"><Pill href={base} label="Home" /></div>
  </div>
</Base>
```

`site/src/pages/status/index.astro` — the milestone 5 script stays; the markup above it becomes:
```astro
---
import Base from '../../layouts/Base.astro';
import NavBar from '../../components/NavBar.astro';
import SectionHeader from '../../components/SectionHeader.astro';
const base = import.meta.env.BASE_URL;
const table = 'w-full text-[0.9em] [&_th]:p-3 [&_th]:text-left [&_th]:text-[0.75em] [&_th]:uppercase [&_th]:text-muted-foreground [&_td]:p-3 [&_td]:align-top [&_tbody_tr]:border-t [&_tbody_tr]:border-border';
---
<Base title="Status" description="Build status, upstream freshness and link health." noindex width="wide">
  <NavBar slot="nav" title="Status" back={{ href: base, label: 'Home' }} />
  <h1 class="sr-only">Status</h1>
  <p id="meta" class="mt-2 px-1 text-[0.85em] text-muted-foreground" aria-live="polite">Loading…</p>
  <div id="tiles" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"></div>
  <section class="mt-8" aria-labelledby="sources-h"><SectionHeader id="sources-h" title="Sources" /><div id="sources" class="mt-3 grid gap-3 sm:grid-cols-2"></div></section>
  <section class="mt-8" aria-labelledby="apps-h"><SectionHeader id="apps-h" title="Apps" />
    <div class="mt-3 overflow-x-auto rounded-[var(--radius)] bg-card"><table id="apps" class={table}><thead><tr><th>App</th><th>Kinds</th><th>Local</th><th>Upstream</th><th>State</th><th>Checked</th></tr></thead><tbody></tbody></table></div>
    <p id="no-apps" class="mt-2 px-1 text-[0.9em] text-muted-foreground" hidden>No apps yet.</p></section>
  <section class="mt-8" aria-labelledby="recent-h"><SectionHeader id="recent-h" title="Recent activity" />
    <div class="mt-3 overflow-x-auto rounded-[var(--radius)] bg-card"><table id="recent" class={table}><thead><tr><th>When</th><th>App</th><th>Action</th><th>Version</th><th>Message</th></tr></thead><tbody></tbody></table></div>
    <p id="no-recent" class="mt-2 px-1 text-[0.9em] text-muted-foreground" hidden>No sync activity recorded.</p></section>
  <section class="mt-8" aria-labelledby="links-h"><SectionHeader id="links-h" title="Links" /><p id="links" class="mt-2 px-1 text-[0.9em] text-muted-foreground"></p>
    <div class="mt-2 overflow-x-auto rounded-[var(--radius)] bg-card" id="broken-wrap" hidden><table id="broken" class={table}><thead><tr><th>URL</th><th>Status</th><th>Where</th></tr></thead><tbody></tbody></table></div></section>
</Base>
```
In the script, replace the tile classes with `rounded-[var(--radius)] bg-card p-3` / `text-[0.75em] text-muted-foreground`, the source-card classes with `flex items-center gap-4 rounded-[var(--radius)] bg-card p-4`, and `text-accent` with `text-primary`.

- [ ] Step 1: write the pages; commit `feat(site): AltStore-style pages with App Store desktop layout`.

---

### Task 4: Tests, visual check, deploy

Replace the three page assertions in `test/site/site.test.mjs` with:
```js
test('home page shows the source, both apps, news and the add sheet; accessible landmarks', async () => {
  const html = await page('index.html');
  assert.match(html, /Fixture Source/);
  assert.match(html, /Pal Only/);
  assert.match(html, /Both Kinds/);
  assert.match(html, /https:\/\/altstore\.io\/source\/stixzoor\.github\.io\/altsource\/source\.pal\.json/);
  assert.match(html, /sidestore:\/\/source\?url=/);
  assert.match(html, /First post/);
  assert.match(html, /href="https:\/\/example\.com"/, 'description URLs are linked');
  assert.match(html, /2 apps · 2 PAL · 1 sideload/);
  assert.match(html, /data-sheet="add-source"/);
  assert.match(html, /<dialog id="add-source"[^>]*aria-labelledby="add-source-title"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<main id="main"/);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'one h1');
  assert.doesNotMatch(html, /bootstrap/i);
});

test('app pages: GET follows the kinds, permissions are explained, screenshots, info and versions render', async () => {
  const both = await page('apps/com.both/index.html');
  assert.match(both, /data-sheet="get"/, 'two or more install targets open the action sheet');
  assert.match(both, /Get in AltStore PAL/);
  assert.match(both, /Install with SideStore/);
  assert.match(both, /sidestore:\/\/install\?url=https%3A%2F%2Fgh%2Fd%2Fa\.ipa/);
  assert.match(both, /role="tablist"/);
  assert.match(both, /aria-controls="shots-ipad"/);
  assert.match(both, /alt="Both Kinds iPhone screenshot 1"/);
  assert.match(both, /width="1179"/);
  assert.match(both, /Version History/);
  assert.match(both, /--tint: #123456/, 'the page tint comes from the source when the app has none');
  assert.match(both, /--tint-readable: #[0-9a-f]{6}/);
  assert.match(both, /Bundle ID/);
  const pal = await page('apps/com.pal/index.html');
  assert.doesNotMatch(pal, /data-sheet="get"/, 'a single install target links directly');
  assert.match(pal, /href="https:\/\/altstore\.io\/source\/stixzoor\.github\.io\/altsource\/source\.pal\.json\?app=com\.pal"/);
  assert.doesNotMatch(pal, /Install with SideStore/);
  assert.match(pal, /App Groups/);
  assert.match(pal, /Camera/);
  assert.match(pal, /data-alert-message="Snap"/);
  assert.match(pal, /<dialog data-alert aria-labelledby="perm-alert-title"/);
  assert.doesNotMatch(pal, /bootstrap/i);
  const versions = await page('apps/com.both/versions/index.html');
  assert.match(versions, /old notes/);
  assert.equal((versions.match(/<li[\s>]/g) ?? []).length, 3);
  const news = await page('news/index.html');
  assert.match(news, /Both updated/);
  assert.match(news, /Both Kinds/, 'news with an appID shows the app row');
});
```
(The build test and the internal-links test stay as they are.)

- [ ] Step 1: update the tests first (RED), then Tasks 1–3 (GREEN).
- [ ] Step 2: visual check with the fixture site in Chrome (desktop + 390px iframe): home, app page, versions, news, status; light and dark.
- [ ] Step 3: README "Site" paragraph: AltStore-style design, Hugeicons; THIRD_PARTY.md mentions Hugeicons (MIT).
- [ ] Step 4: merge, deploy, verify live.
