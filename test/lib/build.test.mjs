import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildOutput, buildAll, BuildError, orderKeys } from '../../src/lib/build.mjs';
import { resolveContent } from '../../src/lib/resolve.mjs';
import { content, app, news, version, root, BASE } from '../helpers/content.mjs';

const ipa = (over = {}) => version({ downloadURL: 'https://dev.example/app.ipa', ...over });
const adp = (over = {}) => version({ downloadURL: 'https://dev.example/app/adp/x/', ...over });

function sample() {
  return content({
    meta: {
      subtitle: 'base', featuredApps: ['com.ipa', 'com.adp', 'com.both'], overrides: { classic: { subtitle: 'classic only' } },
      iconURL: 'assets/icon.png',
    },
    apps: [
      app('com.ipa', { name: 'Zeta', versions: [ipa()], upstream: { type: 'github', repo: 'o/r' } }),
      app('com.adp', { name: 'alpha', marketplaceID: '1', versions: [adp()] }),
      app('com.both', { name: 'Middle', marketplaceID: '2', versions: [adp({ version: '2.0' }), ipa({ version: '2.0', kind: 'ipa' }), ipa({ version: '1.0', date: '2026-01-01' })] }),
    ],
    news: [news('general'), news('ipa-news', { appID: 'com.ipa' }), news('adp-news', { appID: 'com.adp' })],
  });
}

test('buildOutput splits by kind, sorts by name, filters featuredApps and news, strips extension keys', async () => {
  const c = await resolveContent(sample(), { rootDir: await root({ 'assets/icon.png': 'png:2x2' }) });
  const pal = buildOutput(c, 'pal');
  const classic = buildOutput(c, 'classic');
  assert.deepEqual(pal.apps.map((a) => a.bundleIdentifier), ['com.adp', 'com.both']);
  assert.deepEqual(classic.apps.map((a) => a.bundleIdentifier), ['com.both', 'com.ipa']);
  assert.deepEqual(pal.apps[1].versions.map((v) => v.version), ['2.0']);
  assert.deepEqual(classic.apps[0].versions.map((v) => v.version), ['2.0', '1.0']);
  assert.deepEqual(pal.featuredApps, ['com.adp', 'com.both']);
  assert.deepEqual(classic.featuredApps, ['com.ipa', 'com.both']);
  assert.deepEqual(pal.news.map((n) => n.identifier), ['general', 'adp-news']);
  assert.deepEqual(classic.news.map((n) => n.identifier), ['general', 'ipa-news']);
  assert.equal(pal.subtitle, 'base');
  assert.equal(classic.subtitle, 'classic only');
  assert.equal(pal.iconURL, `${BASE}assets/icon.png`);
  for (const key of ['baseURL', 'overrides', '$schema']) assert.equal(key in pal, false, key);
  assert.equal('upstream' in classic.apps[1], false);
  assert.equal('kind' in classic.apps[0].versions[0], false);
  assert.deepEqual(Object.keys(pal).slice(0, 3), ['name', 'subtitle', 'iconURL']);
  assert.deepEqual(Object.keys(pal).slice(-2), ['apps', 'news']);
});

test('orderKeys puts known keys first and the rest alphabetically', () => {
  assert.deepEqual(Object.keys(orderKeys({ z: 1, b: 2, name: 3, a: 4 }, ['name', 'b'])), ['name', 'b', 'a', 'z']);
});

test('buildAll writes both outputs, assets, public files and .nojekyll deterministically', async () => {
  const dir = await root({
    'source.meta.json': { name: 'S', baseURL: BASE, iconURL: 'assets/icon.png' },
    'apps/com.ipa.json': app('com.ipa', { versions: [ipa()] }),
    'news/welcome.json': news('welcome'),
    'assets/icon.png': 'png:2x2',
    'public/index.html': '<h1>hi</h1>',
  });
  const out = path.join(dir, 'dist');
  const first = await buildAll({ rootDir: dir, outDir: out });
  assert.deepEqual(first.outputs, { pal: { file: 'source.pal.json', apps: 0, news: 1 }, classic: { file: 'source.json', apps: 1, news: 1 } });
  const files = (await readdir(out)).sort();
  assert.deepEqual(files, ['.nojekyll', 'assets', 'index.html', 'source.json', 'source.pal.json']);
  const classic = JSON.parse(await readFile(path.join(out, 'source.json'), 'utf8'));
  assert.equal(classic.apps[0].iconURL, 'https://dev.example/icon.png');
  assert.equal(classic.iconURL, `${BASE}assets/icon.png`);
  const bytes1 = await readFile(path.join(out, 'source.json'));
  await buildAll({ rootDir: dir, outDir: out });
  const bytes2 = await readFile(path.join(out, 'source.json'));
  assert.deepEqual(bytes1, bytes2);
});

test('buildAll throws BuildError with issues when validation fails and writes nothing', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE }, 'apps/com.x.json': app('com.y') });
  const out = path.join(dir, 'dist');
  await assert.rejects(buildAll({ rootDir: dir, outDir: out }), (e) => e instanceof BuildError && e.issues.errors.some((i) => i.code === 'E02'));
  await assert.rejects(readdir(out));
});

test('buildAll refuses an outDir that contains the repo', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } });
  await assert.rejects(buildAll({ rootDir: dir, outDir: dir }), /outDir/);
});
