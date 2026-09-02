import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildAll } from '../../src/lib/build.mjs';
import { app, version, news, root, BASE } from '../helpers/content.mjs';

const REPO = process.cwd();
const adp = (o = {}) => version({ downloadURL: 'https://h/adp/x/', ...o });
const ipa = (o = {}) => version({ downloadURL: 'https://gh/d/a.ipa', ...o });

const fixture = await root({
  'source.meta.json': { name: 'Fixture Source', baseURL: BASE, subtitle: 'sub', description: 'Hello https://example.com', iconURL: 'assets/icon.png', headerURL: 'assets/header.png', website: 'https://example.org/repo', tintColor: '#123456', featuredApps: ['com.both'] },
  'apps/com.pal.json': app('com.pal', { name: 'Pal Only', marketplaceID: '1', versions: [adp()], appPermissions: { entitlements: ['com.apple.security.application-groups'], privacy: { NSCameraUsageDescription: 'Snap' } } }),
  'apps/com.both.json': app('com.both', { name: 'Both Kinds', marketplaceID: '2', appPermissions: { entitlements: ['get-task-allow', 'com.apple.private.foo', 'com.apple.private.bar'], privacy: {} }, screenshots: { iphone: ['assets/s.png'], ipad: [{ imageURL: 'https://x/i.png', width: 10, height: 20 }] }, versions: [adp({ version: '2.0', localizedDescription: '## Highlights\n* **Faster** sync\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## Installation\nsee docs' }), ipa({ version: '2.0', kind: 'ipa' }), ipa({ version: '1.0', date: '2026-01-01', localizedDescription: 'old notes' })] }),
  'news/a.json': news('a', { title: 'First post', date: '2026-01-01' }),
  'news/b.json': news('b', { title: 'Both updated', date: '2026-02-01', appID: 'com.both' }),
  'assets/icon.png': 'png:4x4', 'assets/header.png': 'png:6x4', 'assets/s.png': 'png:1179x2556',
});
const staging = path.join(fixture, '.altsource');
const out = path.join(fixture, 'dist');
await buildAll({ rootDir: fixture, outDir: staging });
const build = spawnSync(path.join(REPO, 'node_modules', '.bin', 'astro'), ['build'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ALTSOURCE_ROOT: fixture, ALTSOURCE_PUBLIC: staging, ALTSOURCE_OUT: out, ALTSOURCE_ASTRO_CACHE: path.join(fixture, '.astro') } });
const page = (rel) => readFile(path.join(out, rel), 'utf8');
const exists = (rel) => access(path.join(out, rel)).then(() => true, () => false);
const allCss = async () => (await Promise.all((await readdir(path.join(out, '_astro'))).filter((f) => f.endsWith('.css')).map((f) => page(path.join('_astro', f))))).join('');

test('astro build succeeds and writes every page, the JSON and the assets', async () => {
  assert.equal(build.status, 0, build.stdout + build.stderr);
  for (const f of ['index.html', 'apps/index.html', 'apps/com.pal/index.html', 'apps/com.both/index.html', 'apps/com.both/versions/index.html', 'apps/com.pal/versions/index.html', 'news/index.html', 'status/index.html', '404.html', 'source.json', 'source.pal.json', 'assets/icon.png', '.nojekyll']) {
    assert.ok(await exists(f), `${f} missing`);
  }
});

test('home page shows the source, both apps, news and the add sheet; accessible landmarks', async () => {
  const html = await page('index.html');
  assert.match(html, /Fixture Source/);
  assert.match(html, /Both Kinds/, 'featured app is on the home page');
  assert.doesNotMatch(html, /Pal Only/, 'non-featured apps live on the Apps page, like the viewer');
  assert.match(await page('apps/index.html'), /Pal Only/);
  assert.match(html, /https:\/\/altstore\.io\/source\/stixzoor\.github\.io\/altsource\/source\.pal\.json/);
  assert.match(html, /sidestore:\/\/source\?url=/);
  assert.match(html, /First post/);
  assert.match(html, /href="https:\/\/example\.com"/, 'description URLs are linked');
  assert.match(html, /data-sheet="add-source"/);
  assert.match(html, /<button[^>]*data-copy="[^"]*"[^>]*class="[^"]*\bmin-w-0\b/, 'source URL chips may shrink below their URL so they never overflow a phone screen');
  assert.match(html, /<dialog id="add-source"[^>]*aria-labelledby="add-source-title"/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<main id="main"/);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'one h1');
  assert.doesNotMatch(html, /bootstrap/i);
});

test('home hero and nav carry the wordmark, the hero is the midnight panel, the header image stays for link previews', async () => {
  const html = await page('index.html');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.ok(h1, 'h1 present');
  assert.match(h1[1], /data-wordmark/, 'the source name is set as the wordmark');
  assert.equal(h1[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), 'Fixture Source', 'the accessible name is still the full source name');
  assert.match(html, /data-nav-title[\s\S]*?data-wordmark/, 'the nav bar title is the wordmark too');
  assert.match(html, /class="[^"]*hero-midnight/, 'the hero is drawn in CSS, not a blurred image');
  assert.doesNotMatch(html, /<img[^>]+assets\/header\.png/, 'the header image is not embedded in the page');
  assert.match(html, /property="og:image" content="[^"]*assets\/header\.png"/, 'link previews still use the header image');
  const assets = await readdir(path.join(out, '_astro'));
  const font = assets.find((f) => f.endsWith('.woff2'));
  assert.ok(font, 'the wordmark font ships with the site');
  const css = await Promise.all(assets.filter((f) => f.endsWith('.css')).map((f) => page(path.join('_astro', f))));
  assert.ok(css.some((c) => /font-family:\s*["']?Chakra Petch/.test(c) && c.includes(font)), 'the CSS declares the font face and points at the shipped file');
});

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
    assert.match(await page(p), /<header class="navbar[^"]*" data-navbar(?: data-tinted)?>\s*<div class="navbar-material" aria-hidden="true"><\/div>/, `${p} bar`);
  }
  const apps = await page('apps/index.html');
  assert.match(apps, /<a href="\/altsource\/" class="[^"]*" aria-label="Back"><svg/, 'back is a chevron with an accessible name and no text');
  assert.match(apps, /<h1 class="[^"]*t-large-title-em[^"]*">Apps<\/h1>[\s\S]*?<div data-nav-sentinel/, 'large title followed by the sentinel');
  assert.match(apps, /data-nav-title aria-hidden="true"[\s\S]*?<p class="truncate">Apps<\/p>/, 'small title is hidden until collapsed');
  assert.doesNotMatch(await page('404.html'), /<div data-nav-sentinel/, 'no large title on the 404');
});

test('the "more" toggle on clamped text fades into the page background instead of painting over the words', async () => {
  const html = await page('index.html');
  assert.doesNotMatch(html, /ios-bg/, 'no undefined colour token');
  assert.match(html, /data-toggle class="[^"]*to-page/, 'the fade ends in the real page token');
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
  assert.equal((versions.match(/data-version-row/g) ?? []).length, 3, 'three versions listed');
  const news = await page('news/index.html');
  assert.match(news, /Both updated/);
  assert.match(news, /Both Kinds/, 'news with an appID shows the app row');
});

test('every internal link resolves to a built file and nothing points at GitHub Actions', async () => {
  const pages = ['index.html', 'apps/index.html', 'apps/com.both/index.html', 'apps/com.both/versions/index.html', 'news/index.html', 'status/index.html', '404.html'];
  for (const p of pages) {
    const html = await page(p);
    assert.doesNotMatch(html, /\/actions\/|workflows\//, `${p} links to GitHub Actions`);
    for (const m of html.matchAll(/href="(\/altsource\/[^"#?]*)/g)) {
      const rel = m[1].replace(/^\/altsource\//, '');
      const target = rel === '' ? 'index.html' : rel.endsWith('/') ? `${rel}index.html` : rel;
      assert.ok(await exists(target), `${p} links to missing ${m[1]}`);
    }
  }
});

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

test('app rows say which stores can install them, so the store switch can filter', async () => {
  const apps = await page('apps/index.html');
  assert.match(apps, /data-app[^>]*data-stores="pal"/, 'ADP-only app is PAL only');
  assert.match(apps, /data-app[^>]*data-stores="pal classic sidestore"/, 'ADP + IPA app installs everywhere');
});

test('storefront component CSS: ribbon, shelf, Today card, Get pill and AltStore row measurements', async () => {
  const css = await allCss();
  assert.match(css, /\.ribbon\{[^}]*grid-auto-columns:144px/, 'ribbon phone columns');
  assert.match(css, /\.shelf-list\{[^}]*scroll-snap-type:x mandatory/, 'shelf snaps');
  assert.match(css, /\.shelf-arrow\{[^}]*width:28px;height:64px/, 'shelf arrows');
  assert.match(css, /\.today\{[^}]*border-radius:17px/, 'Today card radius');
  for (const prop of ['border-radius:1000px', 'padding:7px 16px', 'font-weight:700']) assert.match(css, new RegExp(`\\.get\\{[^}]*${prop}`), `Get pill ${prop}`);
  for (const prop of ['min-height:87px', 'padding:14px 16px', 'border-radius:20px']) assert.match(css, new RegExp(`\\.approw\\{[^}]*${prop}`), `AltStore row ${prop}`);
  assert.match(css, /\.pill\{[^}]*min-width:76px;height:30px/, 'AltStore pill');
  assert.match(css, /html:not\(\[data-store=\\?"?pal\\?"?\]\) \[data-store-only=\\?"?pal\\?"?\]/, 'store-only rule');
});

test('app rows carry both looks: the AltStore pill for phones and the App Store Get pill for desktop', async () => {
  const apps = await page('apps/index.html');
  assert.match(apps, /class="approw"[^>]*data-stores="pal classic sidestore"[\s\S]*?<span class="pill shrink-0 lg:hidden">Get<\/span><span class="get hidden shrink-0 lg:inline-flex">Get<\/span>/, 'row with both pills');
  assert.match(apps, /class="approw"[^>]*data-app[^>]*>\s*<img[^>]*style="view-transition-name: icon-com-both"/, 'the Apps page rows name their icons for the morph');
});

test('home: hero ribbon, Add and Share, a Today card for the featured app, shelves, rows, per-store empty states and the website link', async () => {
  const html = await page('index.html');
  assert.match(html, /<span class="ribbon-label">Apps<\/span>\s*<span class="ribbon-value">2<\/span>/, 'ribbon counts apps');
  assert.match(html, /<span class="ribbon-label">AltStore PAL<\/span>\s*<span class="ribbon-value">2<\/span>/, 'ribbon counts PAL');
  assert.match(html, /<span class="ribbon-label">Sideload<\/span>\s*<span class="ribbon-value">1<\/span>/, 'ribbon counts sideload');
  assert.match(html, /class="get get-blue[^"]*" data-store-only="all" data-sheet="add-source" aria-haspopup="dialog">Add to AltStore</, 'Add opens the sheet under All');
  assert.match(html, /<a href="https:\/\/altstore\.io\/source\/stixzoor\.github\.io\/altsource\/source\.pal\.json" class="get get-blue[^"]*" data-store-only="pal">Add to AltStore PAL</, 'Add is a direct PAL link under PAL');
  assert.match(html, /<a href="sidestore:\/\/source\?url=[^"]*" class="get get-blue[^"]*" data-store-only="sidestore">Add to SideStore</, 'Add is a direct SideStore link under SideStore');
  assert.match(html, /<div class="min-w-0" data-stores="classic sidestore"><button type="button" data-copy="https:\/\/stixzoor\.github\.io\/altsource\/source\.json"/, 'the Classic chip belongs to Classic and SideStore');
  assert.match(html, /data-share data-share-url="https:\/\/stixzoor\.github\.io\/altsource\/source\.pal\.json"/, 'Share carries the PAL URL');
  assert.match(html, /<a href="\/altsource\/apps\/com\.both\/" class="today"[\s\S]*?<p class="today-eyebrow">Utilities<\/p>\s*<h3 class="today-title">Both Kinds<\/h3>/, 'Today card for the featured app');
  assert.match(html, /<div class="shelf-list" data-shelf-list>[\s\S]*?class="newscard"/, 'news shelf');
  assert.match(html, /data-app-list>[\s\S]*?class="approw"/, 'rows inside an app list');
  assert.match(html, /data-empty data-empty-pal="Nothing for AltStore PAL yet\." data-empty-classic="Nothing for AltStore Classic yet\." data-empty-sidestore="Nothing for SideStore yet\."/, 'per-store empty state');
  assert.match(html, /<a href="https:\/\/example\.org\/repo" rel="noopener"[^>]*>example\.org\/repo<span aria-hidden="true">↗<\/span><\/a>/, 'website link');
  assert.match(html, /class="hero-tile/, 'hero icon tile');
});

test('app page CSS: sheets slide on the iOS curve, the hero blurs its artwork, cards and grids carry the App Store numbers, pages morph the icon', async () => {
  const css = await allCss();
  assert.match(css, /\.sheet\{[^}]*translate:0 100%/, 'sheet starts below the screen');
  assert.match(css, /@starting-style\{\.sheet\[open\]\{translate:0 100%\}\}/, 'enter animation');
  assert.match(css, /\.sheet\{[^}]*cubic-bezier\(\.32,\s*\.72,\s*0,\s*1\)/, 'iOS sheet curve');
  assert.match(css, /\.sheet-grabber\{[^}]*width:36px;height:5px/, 'grabber');
  assert.match(css, /\.apphero-art\{[^}]*blur\(100px\)\s*saturate\(1\.5\)/, 'hero artwork blur');
  assert.match(css, /\.apphero-icon\{[^}]*border:2px solid #ffffff4d/, 'hero icon border');
  assert.match(css, /\.permcard\{[^}]*border-radius:10px/, 'privacy card radius');
  assert.match(css, /\.permcard\{[^}]*padding:30px/, 'privacy card padding');
  assert.match(css, /@view-transition\{navigation:auto\}/, 'cross-document view transitions');
});

test('sheets: the add-source action sheet is a bottom sheet with grouped actions and a Cancel row, wired by one script in the layout', async () => {
  const html = await page('index.html');
  assert.match(html, /<dialog id="add-source" class="sheet sheet-actions"[^>]*aria-labelledby="add-source-title"/, 'action sheet uses the sheet contract');
  assert.match(html, /<div class="sheet-group">\s*<div class="sheet-title">[\s\S]*?<a href="https:\/\/altstore\.io\/source\/[^"]*" class="sheet-action[^"]*">Add to AltStore PAL<\/a>/, 'grouped actions');
  assert.match(html, /<button type="button" data-close class="sheet-cancel">Cancel<\/button>/, 'cancel row');
  assert.equal((html.match(/dataset\.sheet\b/g) ?? []).length, 1, 'one trigger script');
});

test('app page pieces: screenshots ride the shelf, permissions are App Privacy cards, the back chevron knows it sits on a tinted header', async () => {
  const both = await page('apps/com.both/index.html');
  assert.match(both, /id="shots-iphone"[^>]*>\s*<div class="shelf[^"]*" data-shelf>/, 'iPhone screenshots on a shelf');
  assert.match(both, /role="tablist"/, 'device tabs when both exist');
  assert.match(both, /<header class="navbar[^"]*" data-navbar data-tinted>/, 'tinted bar on the app page');
  const pal = await page('apps/com.pal/index.html');
  assert.match(pal, /<div class="permcard">[\s\S]*?<h3 class="[^"]*">Privacy<\/h3>[\s\S]*?Camera/, 'privacy card lists the camera');
  assert.match(pal, /<div class="permcard">[\s\S]*?<h3 class="[^"]*">Entitlements<\/h3>[\s\S]*?App Groups/, 'entitlements card');
});

test('app page: two heroes, ribbon facts, store-aware Get, description, What’s New with the version sheet, information rows, links and More by', async () => {
  const both = await page('apps/com.both/index.html');
  assert.match(both, /<section class="apphero[^"]*" style="--hero-art: url\(&quot;https:\/\/stixzoor\.github\.io\/altsource\/assets\/s\.png&quot;\)/, 'desktop hero takes the first screenshot as artwork');
  assert.match(both, /<img[^>]*class="apphero-icon[^"]*"[^>]*style="view-transition-name: icon-com-both"/, 'hero icon named for the morph');
  assert.match(both, /<section class="apphero-phone[^"]*"[\s\S]*?<div class="apphero-card">/, 'phone hero card');
  assert.match(both, /Free · AltStore PAL · AltStore Classic/, 'price line lists the stores');
  assert.match(both, /<span class="ribbon-label">Version<\/span>\s*<span class="ribbon-value">2\.0<\/span>/, 'ribbon version');
  assert.match(both, /<span class="ribbon-label">Requires<\/span>\s*<span class="ribbon-value">iOS 16\.0<\/span>/, 'ribbon requirement');
  assert.match(both, /data-store-only="all"[^>]*data-sheet="get"/, 'Get opens the sheet under All');
  assert.match(both, /<a href="https:\/\/altstore\.io\/source\/[^"]*\?app=com\.both" class="get get-blue[^"]*" data-store-only="pal">Get<\/a>/, 'direct PAL Get');
  assert.match(both, /<a href="sidestore:\/\/install\?url=[^"]*" class="get get-blue[^"]*" data-store-only="sidestore">Get<\/a>/, 'direct SideStore Get');
  assert.match(both, /data-sheet="versions"/, 'Version History opens the sheet');
  assert.match(both, /<p>Version 2\.0<\/p>/, 'What’s New shows the marketing version only');
  assert.doesNotMatch(both, /2\.0 \(1\)/, 'no build numbers');
  assert.match(both, /<dialog id="versions" class="sheet sheet-wide"/, 'version history is the wide sheet');
  assert.equal((both.match(/data-version-row/g) ?? []).length, 3, 'three versions listed');
  assert.match(both, /<dl class="info">[\s\S]*?<dt>Bundle ID<\/dt>\s*<dd>com\.both<\/dd>/, 'information rows');
  assert.match(both, /More by Dev/, 'More by the developer');
  assert.match(both, /Download \.ipa<span aria-hidden="true">↗<\/span>/, 'download link with the arrow');
  const pal = await page('apps/com.pal/index.html');
  assert.match(pal, /class="get get-blue[^"]*" data-store-only="all" href="https:\/\/altstore\.io\/source\/[^"]*\?app=com\.pal"/, 'single-store apps link directly under All');
  assert.match(pal, /<span class="get get-muted" data-store-only="sidestore">Not on SideStore<\/span>/, 'unavailable store is said plainly');
});

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

test('release notes and descriptions render as Markdown through the allowlist', async () => {
  const both = await page('apps/com.both/index.html');
  assert.match(both, /<p class="notes-h"><strong>Highlights<\/strong><\/p>\s*<ul><li><strong>Faster<\/strong> sync<\/li><\/ul>/, 'What’s New renders Markdown');
  assert.doesNotMatch(both, /<table|see docs|## Highlights/, 'tables and installation sections are gone, no raw Markdown');
  assert.match(both, /<div class="line-clamp-3 notes break-words[^"]*" data-clamp-body>/, 'clamped Markdown body');
  const versions = await page('apps/com.both/versions/index.html');
  assert.match(versions, /<strong>Faster<\/strong> sync/, 'version history rows render Markdown too');
});

test('entitlements without a friendly name collapse into one row that lists them on tap', async () => {
  const both = await page('apps/com.both/index.html');
  assert.match(both, /Debuggable/, 'known entitlement listed by name');
  assert.match(both, /data-alert-title="System entitlements" data-alert-message="com\.apple\.private\.foo\ncom\.apple\.private\.bar" data-alert-mono/, 'unknown keys live in the alert');
  assert.match(both, /2 more system entitlements/, 'collapsed row');
  const body = both.match(/<div class="permcard">[\s\S]*?Entitlements[\s\S]*?<\/div>\s*<\/div>/)[0].replace(/data-alert-message="[^"]*"/g, '');
  assert.doesNotMatch(body, /com\.apple\.private/, 'raw keys are not printed in the card');
});
