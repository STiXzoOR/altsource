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
  'source.meta.json': { name: 'Fixture Source', baseURL: BASE, subtitle: 'sub', description: 'Hello https://example.com', iconURL: 'assets/icon.png', headerURL: 'assets/header.png', tintColor: '#123456', featuredApps: ['com.both'] },
  'apps/com.pal.json': app('com.pal', { name: 'Pal Only', marketplaceID: '1', versions: [adp()], appPermissions: { entitlements: ['com.apple.security.application-groups'], privacy: { NSCameraUsageDescription: 'Snap' } } }),
  'apps/com.both.json': app('com.both', { name: 'Both Kinds', marketplaceID: '2', screenshots: { iphone: ['assets/s.png'], ipad: [{ imageURL: 'https://x/i.png', width: 10, height: 20 }] }, versions: [adp({ version: '2.0' }), ipa({ version: '2.0', kind: 'ipa' }), ipa({ version: '1.0', date: '2026-01-01', localizedDescription: 'old notes' })] }),
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
  assert.match(html, /2 apps · 2 PAL · 1 sideload/);
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
    assert.match(await page(p), /<header class="navbar[^"]*" data-navbar>\s*<div class="navbar-material" aria-hidden="true"><\/div>/, `${p} bar`);
  }
  const apps = await page('apps/index.html');
  assert.match(apps, /<a href="\/altsource\/" class="[^"]*" aria-label="Back"><svg/, 'back is a chevron with an accessible name and no text');
  assert.match(apps, /<h1 class="[^"]*t-large-title-em[^"]*">Apps<\/h1>\s*<div data-nav-sentinel/, 'large title followed by the sentinel');
  assert.match(apps, /data-nav-title aria-hidden="true"[\s\S]*?<p class="truncate">Apps<\/p>/, 'small title is hidden until collapsed');
  assert.doesNotMatch(await page('404.html'), /<div data-nav-sentinel/, 'no large title on the 404');
});

test('the "more" toggle on clamped text fades into the page background instead of painting over the words', async () => {
  const html = await page('index.html');
  assert.doesNotMatch(html, /ios-bg/, 'no undefined colour token');
  assert.match(html, /data-toggle class="[^"]*to-background/, 'the fade ends in the real background token');
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
  assert.equal((versions.match(/<ol[\s\S]*?<\/ol>/)[0].match(/<li[\s>]/g) ?? []).length, 3, 'three versions listed (the shell has its own lists)');
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
