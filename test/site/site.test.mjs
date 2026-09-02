import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
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
const build = spawnSync(path.join(REPO, 'node_modules', '.bin', 'astro'), ['build'], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ALTSOURCE_ROOT: fixture, ALTSOURCE_PUBLIC: staging, ALTSOURCE_OUT: out, ALTSOURCE_VITE_CACHE: path.join(fixture, '.astro', 'vite') } });
const page = (rel) => readFile(path.join(out, rel), 'utf8');
const exists = (rel) => access(path.join(out, rel)).then(() => true, () => false);

test('astro build succeeds and writes every page, the JSON and the assets', async () => {
  assert.equal(build.status, 0, build.stdout + build.stderr);
  for (const f of ['index.html', 'apps/index.html', 'apps/com.pal/index.html', 'apps/com.both/index.html', 'apps/com.both/versions/index.html', 'apps/com.pal/versions/index.html', 'news/index.html', 'status/index.html', '404.html', 'source.json', 'source.pal.json', 'assets/icon.png', '.nojekyll']) {
    assert.ok(await exists(f), `${f} missing`);
  }
});

test('home page shows the source, both apps, featured, news and add links', async () => {
  const html = await page('index.html');
  assert.match(html, /Fixture Source/);
  assert.match(html, /Pal Only/);
  assert.match(html, /Both Kinds/);
  assert.match(html, /https:\/\/altstore\.io\/source\/stixzoor\.github\.io\/altsource\/source\.pal\.json/);
  assert.match(html, /sidestore:\/\/source\?url=/);
  assert.match(html, /First post/);
  assert.match(html, /href="https:\/\/example\.com"/, 'description URLs are linked');
  assert.match(html, /2 apps · 2 for AltStore PAL · 1 for Classic/);
});

test('app pages: install buttons follow the kinds, permissions are explained, screenshots and versions render', async () => {
  const both = await page('apps/com.both/index.html');
  assert.match(both, /Get in AltStore PAL/);
  assert.match(both, /Install with SideStore/);
  assert.match(both, /sidestore:\/\/install\?url=https%3A%2F%2Fgh%2Fd%2Fa\.ipa/);
  assert.match(both, /iPhone/);
  assert.match(both, /iPad/);
  assert.match(both, /width="1179"/);
  assert.match(both, /Version history/);
  const pal = await page('apps/com.pal/index.html');
  assert.doesNotMatch(pal, /Install with SideStore/);
  assert.match(pal, /App Groups/);
  assert.match(pal, /Camera/);
  assert.match(pal, /Snap/);
  const versions = await page('apps/com.both/versions/index.html');
  assert.match(versions, /old notes/);
  assert.equal((versions.match(/<li[\s>]/g) ?? []).length, 3);
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
