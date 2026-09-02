# M8 — Storefront: App Store shell on desktop, native feel on phones

Status: shipped 2026-09-02 (M8a–M8d). Approved by the user 2026-09-02 ("go do the recommended fully and make it super polished and pixel perfect"). Supersedes the page layout in `2026-09-02-site-design.md` and the M6 nav pattern where they conflict; everything else in those documents still holds (data layer, install semantics, accessibility rules, "no maintainer links on public pages").

Research the numbers come from (kept in the user's vault, `~/Vault/Resources/`): `apple-hig-web-reference.md`, `app-store-web-anatomy.md`, `native-feel-web-patterns.md`. Values below are those measured from apps.apple.com and the AltStore app unless marked "ours".

## 1. Goals

1. On a desktop browser the site reads as the App Store web app: a 260 px sidebar shell, App Store type and colour tokens, product pages with the Store's anatomy.
2. On a phone it feels like the AltStore app: full-bleed tinted headers, large titles that collapse into a transparent-then-glass bar, a floating glass tab bar, sheets that slide up on iOS's curve, press states, Dynamic Type, safe areas.
3. A visitor can pick their store (AltStore PAL, AltStore Classic, SideStore) once and see only what installs for them.
4. Every measurement is deliberate: sizes, weights, alphas, radii, easings come from the references, not from taste.

Non-goals: React or any runtime framework; a search backend (the client-side filter stays); a lightbox redesign (kept as is); ratings and reviews (no data); iPad-specific device frames.

## 2. Shell

Breakpoints (App Store web): `484`, `1000`, `1260`, `1580`, `1940`. Named: xsmall `<1000`, small `1000–1259`, medium `1260–1579`, large `1580–1939`, xlarge `≥1940`. Body gutter 25 px below 1000, 40 px from 1000. Content max width 1680 px.

### 2.1 Desktop (≥1000)

Grid `260px 1fr`. Sidebar sticky `100vh`, background `rgba(60,60,67,.03)` light / `rgba(235,235,245,.03)` dark, 1 px right hairline in `--label-divider`.

Sidebar, top to bottom:
- Lockup: Obsidian icon 28 px (radius 8) + "STiX" wordmark in Chakra Petch 700 22 px + "Apps" 17 px semibold in the system font, padding `19px 25px 14px`. Links to home.
- Navigation list: Home, Apps, News, Status. Rows 32 px tall, radius 6, padding 4 px, 24 px icon slot with an 18 px Hugeicon in the key colour, 15 px/1.33 text, gap 8. Selected row: background `rgba(31,31,31,.07)` light / `rgba(255,255,255,.08)` dark, weight 500, `aria-current="page"`.
- "Store" section: heading 10 px/600 uppercase tertiary; rows All, AltStore PAL, AltStore Classic, SideStore with 18 px icons, padding `8px 0`, gap 10, selected row primary label + 600 weight. This is the store switch (§4).
- Bottom: theme toggle (system / light / dark, three-state segmented) and the two source URLs as 11 px links. The floating theme button disappears on desktop.

Content column: page content with a 40 px gutter; the home hero is a card inside it (radius 17, see §5).

### 2.2 Phone and tablet (<1000)

- Top bar: fixed, transparent, `padding-top: env(safe-area-inset-top)`, 44 px row. The translucent material is an absolutely positioned child (`rgb(249 249 249/.78)` light / `rgb(29 29 31/.72)` dark, `backdrop-filter: blur(20px) saturate(180%)`, hairline `0 .5px 0 var(--separator)`), opacity 0 until the page is collapsed. The header element itself never carries the blur (iOS 26 samples fixed elements for tab tinting; the minifier collapses prefixed pairs, so only the unprefixed property is declared).
- Large title pattern: pages with a large title render it in content at 34 px/700; a 1 px sentinel follows it; `IntersectionObserver` with `rootMargin: -(44 + safe-area)px 0 0 0`, `threshold: 0`, sets `data-collapsed` on the header only when `!isIntersecting && boundingClientRect.top < 0`. Collapsed: material fades in (250 ms ease-out), small title 17 px/600 fades and slides in from 6 px, trailing action fades in.
- Back button: chevron symbol only, 44 px hit area, in the key colour, no text (HIG). On the home page the left slot is empty.
- Tab bar: fixed bottom, floating capsule inset 16 px from the sides, `bottom: max(12px, env(safe-area-inset-bottom))`, 56 px tall, glass material (`blur(20px) saturate(180%)`, inset specular rim `inset 0 1px 0 rgb(255 255 255/.6)` light / `.12` dark, shadow `0 8px 24px rgb(0 0 0/.12)`). Four tabs: Home, Apps, News, Status, Hugeicons 24 px + 11 px/500 labels, active in the tint, `aria-current`. Hides (translate 100% + 24 px, opacity 0) on scroll down past 80 px, returns on any scroll up; `prefers-reduced-motion` keeps it visible. Pages get `padding-bottom: calc(88px + env(safe-area-inset-bottom))`.
- Body gutter 25 px on ≥484, 16 px below (iOS minimum margin; ours, since the Store's 25 px is too wide on a 375 pt phone).

### 2.3 Head and PWA

```
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{meta.name}">
<link rel="apple-touch-icon" sizes="180x180" href="{assets/apple-touch-icon.png}">
<link rel="manifest" href="{base}manifest.webmanifest">
```
`apple-touch-icon.png` is a 180 px opaque render of the icon added to the brand generator. The manifest is an Astro endpoint (`name`, `short_name`, `start_url`, `display: standalone`, `background_color`, `theme_color`, icon 1024 and 180). `body` carries an explicit background in both schemes (iOS 26 samples it).

## 3. Tokens

Defined in `site/src/styles/global.css` under `@theme` and `:root`, consumed as Tailwind utilities. Every colour uses `light-dark()`; `color-scheme` is set on `:root` and on `.dark`/`.light` for the manual toggle.

### 3.1 Colour (iOS semantic set; App Store greys where measured)

| Token | Light | Dark |
|---|---|---|
| `--page` | `#ffffff` | `#000000` <1000, `#1f1f1f` ≥1000 |
| `--surface` (cards) | `rgba(0,0,0,.05)` | `#1c1c1e` <1000, `rgba(255,255,255,.05)` ≥1000 |
| `--surface-2` (elements on cards) | `#f2f2f7` | `#2c2c2e` |
| `--label` | `#000000` | `#ffffff` |
| `--label-2` | `rgba(60,60,67,.6)` | `rgba(235,235,245,.6)` |
| `--label-3` | `rgba(60,60,67,.3)` | `rgba(235,235,245,.3)` |
| `--label-4` | `rgba(60,60,67,.18)` | `rgba(235,235,245,.18)` |
| `--separator` | `rgba(60,60,67,.29)` | `rgba(84,84,88,.6)` |
| `--label-divider` | `rgba(0,0,0,.15)` | `rgba(255,255,255,.1)` |
| `--fill` | `rgba(120,120,128,.2)` | `rgba(120,120,128,.36)` |
| `--fill-2` | `rgba(120,120,128,.16)` | `rgba(120,120,128,.32)` |
| `--sidebar` | `rgba(60,60,67,.03)` | `rgba(235,235,245,.03)` |
| `--footer` | `#f2f2f2` | `#323232` |
| `--ribbon-value` | `#48484a` | `#c7c7cc` |
| `--material` | `rgb(249 249 249/.78)` | `rgb(29 29 31/.72)` |
| `--tint` | source or app tint, contrast-corrected (`readableTint`, existing) | |
| `--key` | `--tint` | |
| `--red` | `#ff383c` | `#ff4245` |

Increased contrast: `@media (prefers-contrast: more)` raises `--label-2` to `.76` alpha and swaps the tint to `#0040dd` when the tint is the default blue. Reduced transparency: `--material` becomes opaque `--page` and blurs are removed.

### 3.2 Type

Two scales, switched at 1000 px, exposed as `@utility` classes `t-large-title`, `t-header`, `t-title-1`, `t-title-2`, `t-title-3`, `t-headline`, `t-body`, `t-callout`, `t-subhead`, `t-footnote`, `t-caption`, each with a `-em` (emphasized) variant. Sizes in rem (16 px root), `letter-spacing: 0`, `font-optical-sizing: auto`.

| Utility | Phone (iOS Large) | Desktop (apps.apple.com) |
|---|---|---|
| large-title | 34/41, em 700 | 26/32, em 700 |
| header | 34/41 700 | 34/40 700 |
| title-1 | 28/34, em 700 | 22/26, em 700 |
| title-2 | 22/28, em 700 | 17/22, em 700 |
| title-3 | 20/25, em 600 | 15/20, em 600 |
| headline | 17/22 600 | 13/16 700 |
| body | 17/22, em 600 | 13/16 (tall 1.385), em 600 |
| callout | 16/21, em 600 | 12/15, em 600 |
| subhead | 15/20, em 600 | 11/14, em 600 |
| footnote | 13/18, em 600 | 10/13, em 700 |
| caption | 12/16, em 600 | 10/13, em 500 |

Font stack `system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`. Dynamic Type on iOS: `@supports (font: -apple-system-body) and (-webkit-touch-callout: none) { html { font: -apple-system-body; font-family: … } }`. Headings `text-wrap: balance`; body copy `text-wrap: pretty`; numbers `tabular-nums`. Wordmark stays Chakra Petch 700 (self-hosted subset).

### 3.3 Radius, shadow, motion, material

Radii: xs 5, sm 9, md 12, lg 17, xl 24, pill 1000 px; app icons 23 % (`rounded-rect`), source icon 50 %; hero icon border `2px solid rgba(255,255,255,.3)` + `box-shadow 0 0 30px rgba(0,0,0,.33)`. Shadows: sm `0 3px 9px rgba(0,0,0,.08)`, md `0 3px 20px rgba(0,0,0,.08)`; none in dark mode except the hero icon and the tab bar.

Motion: `--ease-standard: cubic-bezier(.4,0,.6,1)`, `--ease-sheet: cubic-bezier(.32,.72,0,1)`, `--ease-out: ease-out`; `--dur-fast: 140ms`, `--dur-base: 240ms`, `--dur-sheet: 400ms`. Buttons `.14s` in / `.21s` out. Press state everywhere tappable: `scale(.97)` + opacity `.8` over 120 ms; hover effects only under `(hover: hover)`. `prefers-reduced-motion` reduces everything to opacity fades and disables smooth scroll.

Material: bar `--material` + `blur(20px) saturate(180%)`; chips `blur(10px)`; App Store translucent button `rgba(255,255,255,.25)` + `saturate(180%) blur(10px)`.

## 4. Store switch

State: `data-store` on `<html>` ∈ `all | pal | classic | sidestore`, default `all`, persisted in `localStorage.store`, applied by an inline head script before paint (like the theme).

Markup contract: any element that only makes sense for some stores carries `data-stores="pal classic"` (space-separated). CSS hides it when the selected store is not listed:

```
html[data-store="pal"] [data-stores]:not([data-stores~="pal"]) { display: none }
```
(and the same for `classic` and `sidestore`). Elements without `data-stores` always show.

Effects:
- App rows and grids: an app with only ADP versions carries `data-stores="pal"`; only IPA versions `data-stores="classic sidestore"`; both, all three. Empty-state text per store ("Nothing for SideStore yet").
- Install buttons: the "Get" pill in `all` mode opens the action sheet when there are two or more targets (existing). With a store chosen, the pill becomes a direct link to that store's deep link; implemented by rendering one link per store with `data-store-only="pal|classic|sidestore"` and one sheet trigger with `data-store-only="all"`; `data-store-only` shows an element in exactly one state, unlike `data-stores`, which always shows under All.
- Counts in the ribbon: rendered per store with `data-stores`; "All" shows "N apps · P PAL · C sideload".
- Sidebar rows and the phone segmented control both set the state; the control lives under the home hero on phones (iOS segmented control: 32 px, radius 9, fill `--fill`, selected segment `--page` with shadow sm, 13 px/600).
- The switch never hides the source URLs or the Add action.

## 5. Pages

### 5.1 Home

Desktop: hero card (radius 17, the midnight panel, 286 px tall): lockup wordmark 34 px + "Apps", subtitle 17/700 at `rgba(246,246,246,.6)`, ribbon-style facts row inside the panel (APPS, PAL, SIDELOAD, UPDATED, SOURCE) and the Add pill + Share pill (Share copies the PAL URL; uses the Web Share API when present). Tile 194 px at the right with the hero-icon border and glow. Then: "Featured" shelf of Today cards (3:4, 407 × 534 on ≥1260, accent = app tint, artwork = first iPhone screenshot scaled and blurred under a protection layer, eyebrow = category uppercase 12/600 at 56 % white, title 34/700, blurb = subtitle 13, bottom app row overlay 48 px icon + Get). "News" shelf (cards radius 24, solid tint or `imageURL` 3:2, title 22/700 white, caption 17 white 80 %). "All apps" small-lockup river (2 rows, 64 px icons). "About" with description (66 % width, "more" fade into `--page`), website link with the `↗` glyph. Footer (§5.5).

Phone: transparent bar over the midnight hero (current), which becomes the large-title block: wordmark 44 px, "Apps", subtitle, facts as a horizontally scrolling ribbon (144 px columns), Add pill, tile 96 px. Sentinel after the hero collapses the bar to lockup + Add. Segmented store control. Then AltStore-style sections: "News" (snap strip, cards 88 % wide, radius 24), "Featured Apps" large title 34/700 with tinted app rows (87 px tall, radius 20, tint at 15 %, 59 px icon radius 13, name 17/700, developer 15 secondary, right pill 76 × 30 uppercase 15/700 on the tint), "View All Apps" link in the tint, "About" large title, description, link.

### 5.2 App page

Desktop (App Store product page): hero 286 px, background = first screenshot or the icon, `blur(100px) saturate(1.5)` under `linear-gradient(to bottom, transparent 20%, rgba(0,0,0,.8))`; content row gap 2em, max width 840: icon 194 px (23 %, border, shadow, blurred glow copy), h1 34/700 `letter-spacing -.02em` white with text shadow, subtitle 17/700 at 60 % white, price line "Free · AltStore PAL" 13/400, buttons row (Get pill blue filled 13/700 `padding 7px 16px`; Share pill translucent). Ribbon: SIZE, VERSION, REQUIRES (min iOS), DEVELOPER, CATEGORY, STORE (PAL / Classic / Both), 11/600 uppercase labels, 22/700 values in `--ribbon-value`, sub-lines 11/400, `space-between` from 1000. Screenshots shelf: 3 / 4 / 5 columns at 1000 / 1260 / 1580, gap 20, radius 12 with a `.5px` inner stroke, snap, hidden scrollbar, edge fade 15 px, hover arrows 28 × 64 radius 6 in blurred material. Description 66 % (50 % ≥1580) with "more". "What's New ›" opens the Version History dialog (80vw, max 691, radius 10, title 26/700, rows version + date secondary right-aligned, notes 15/1.33, bottom fade 64 px, scrim 45 %); inline shows the latest version, date and notes. "Permissions" as App Privacy cards: `--surface`, radius 10, padding 30, centred, 30 px icon in the key colour, h3 15/600, list 12 secondary; 2 / 3 / 4 columns. "Information" dl: columns 2 / 3, gap 20 / 24, dt secondary, dd body; rows Developer, Size, Category, Compatibility, Bundle ID, Channel, Latest, Source link with `↗`. "More by {developer}" small lockups when the developer has other apps here. Footer.

Phone (AltStore app page): tint header with soft white radial glow, back chevron in a 34 px translucent circle, header card (16 px insets, radius 20, white 35 % on tint / black 25 % on light tints) with 59 px icon, name 17/700, developer 15 in the tint, pill; white sheet with 30 px top corners overlapping the header by 24 px; centred subtitle 17; screenshots strip 184 px wide, gap 12, radius 14, snap with peek; ribbon as a horizontal scroll; description 17 with "more"; "What's New" with the version history link (same dialog, full-height sheet on phones); permission cards single column; Information as an inset grouped list (rows 44 px, hairline separators, `--surface` background, radius 12); links list.

View transition: `@view-transition { navigation: auto }` and `view-transition-name: icon-{slug}` on the app icon in rows and in the hero, so the icon morphs between list and detail on Safari 18.2+ and Chrome 126+; no client router.

### 5.3 Apps index

Desktop: page title 26/700 (`padding 11px gutter`), the search field (32 px, radius 4, 12 px, focus ring `0 0 0 4px` key at 60 %), category chips, small-lockup grid 2 / 3 / 4 columns with Get pills. Phone: large title "Apps", search 38 px radius 9 16 px text (no zoom), tinted rows.

### 5.4 News and Status

News: shelf cards become a grid (1 / 2 / 3 columns), each with the app row when `appID` matches. Status: same data; cards on `--surface` radius 12; QR codes unchanged; still no maintainer links.

### 5.5 Footer

Background `--footer`, 10 px (11 px ≥740), padding `15px gutter`, min-height 88 px (147 on phones plus tab bar padding): copyright line, the two source URLs, "Built from GitHub" link (public repo, allowed), and the theme toggle on phones.

## 6. Sheets and dialogs

`ActionSheet.astro` and the Version History dialog are `<dialog>`s opened with `showModal()`. Phones: bottom sheet, `translate 100% → 0` over `--dur-sheet` with `--ease-sheet`, `@starting-style`, backdrop `rgb(0 0 0/.4)` fading, grabber 36 × 5 radius 3, rows 56 px 17 px labels, hairline separators, Cancel as a separate grouped button 8 px below, bottom padding `calc(16px + env(safe-area-inset-bottom))`, `overscroll-behavior: contain`, body scroll lock while open. Desktop ≥640: centred card radius 16, scale `.96 → 1` over 200 ms. Light dismiss on backdrop click; Esc via the dialog; `autofocus` on the heading. Reduced motion: fades only.

## 7. Accessibility

Unchanged rules from M6 plus: every tab and sidebar row has an accessible name and `aria-current`; the store switch is a `radiogroup`; the collapsed small title is `aria-hidden` while the large title is visible and vice versa; all text in rem; 44 px hit areas on every control (`min-h-11`); focus ring 2 px key colour with 2 px offset following the radius; `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` honoured; hidden fixed overlays use `display: none`.

## 8. Testing

`test/site/site.test.mjs` (one fixture build) gains assertions per milestone: shell markup (sidebar nav rows with `aria-current`, tab bar, store switch radiogroup, `data-store` script), head metas and the manifest endpoint, hero and ribbon values from the fixture, feature card per featured app with the tint, `data-stores` on rows and install links, version history dialog, permission cards, information rows, footer without maintainer links, built CSS containing the two type scales and the overlay rule. Brand generator test gains the 180 px touch icon. Visual checks are done in a real 390 / 768 / 1000 / 1280 / 1580 viewport with Playwright before each milestone ships.

## 9. Milestones

- **M8a Foundations**: tokens, type scales, head metas + manifest + touch icon, shell (sidebar, top bar with material child, tab bar), store switch state, sheet motion, base touch polish. Home and other pages keep their content but sit in the new shell.
- **M8b Home**: desktop hero card + ribbon + Share, Today cards, shelves, small-lockup river, About; phone hero ribbon, segmented control, AltStore rows.
- **M8c App page**: desktop product anatomy, phone AltStore anatomy, version history dialog, permission cards, information grid, icon view transition.
- **M8d Apps, News, Status, footer, final pixel pass** across the five viewports, docs and handoff.
