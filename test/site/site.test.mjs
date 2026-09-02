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

test('home nav bar overlays the hero, transparent until scrolled, with the lockup on the left; other pages keep the sticky bar with a centred title', async () => {
  const html = await page('index.html');
  assert.match(html, /<header class="[^"]*\bfixed\b[^"]*"[^>]*data-navbar[^>]*data-overlay/, 'home bar is fixed over the hero and marked as an overlay');
  assert.match(html, /<nav[^>]*>\s*<div class="nav-fade[^"]*justify-start/, 'no back-link spacer: the lockup starts at the left edge');
  const pal = await page('apps/com.pal/index.html');
  assert.match(pal, /<header class="[^"]*\bsticky\b/, 'app pages keep the sticky bar');
  assert.match(pal, /<nav[^>]*>\s*<div class="flex min-w-\[78px\]/, 'app pages keep the back-link column');
  assert.match(pal, /data-nav-title[^>]*>/, 'app title still present');
  assert.match(pal, /<div class="nav-fade[^"]*justify-center[^"]*" data-nav-title/, 'app pages centre the title between back and trailing');
  const css = (await Promise.all((await readdir(path.join(out, '_astro'))).filter((f) => f.endsWith('.css')).map((f) => page(path.join('_astro', f))))).join('');
  assert.match(css, /data-overlay\]:not\(\[data-scrolled\]\)\{(?:[^}]*;)?backdrop-filter:none/, 'the unprefixed backdrop-filter is switched off while the overlay is transparent (the minifier drops it if a -webkit- copy comes last)');
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
  assert.equal((versions.match(/<li[\s>]/g) ?? []).length, 3);
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
