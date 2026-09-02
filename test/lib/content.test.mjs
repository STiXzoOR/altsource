import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readApp, writeApp, listApps, removeApp, readMeta, writeNews, listNews, prependVersion, slugify, today } from '../../src/lib/content.mjs';
import { app, news, version, root, BASE } from '../helpers/content.mjs';

test('writeApp puts $schema first, documented key order, upstream last, kind first in versions', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } });
  const a = { ...app('com.x'), upstream: { type: 'github', repo: 'o/r' }, versions: [{ size: 1, kind: 'ipa', version: '1', downloadURL: 'https://x/a.ipa', date: 'd' }] };
  const p = await writeApp(dir, a);
  const text = await readFile(p, 'utf8');
  const keys = Object.keys(JSON.parse(text));
  assert.equal(keys[0], '$schema');
  assert.equal(keys.at(-1), 'upstream');
  assert.deepEqual(Object.keys(JSON.parse(text).versions[0]), ['kind', 'version', 'date', 'downloadURL', 'size']);
  assert.ok(text.endsWith('}\n'));
  assert.equal((await readApp(dir, 'com.x')).name, 'Example');
  assert.equal(await readApp(dir, 'com.nope'), null);
});

test('listApps sorts by file name', async () => {
  const dir = await root({ 'apps/com.b.json': app('com.b'), 'apps/com.a.json': app('com.a') });
  assert.deepEqual((await listApps(dir)).map((x) => x.id), ['com.a', 'com.b']);
  assert.deepEqual(await listApps(await root()), []);
});

test('removeApp deletes the file, unfeatures it and reports news referencing it', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE, featuredApps: ['com.x', 'com.y'] }, 'apps/com.x.json': app('com.x'), 'news/n.json': news('n', { appID: 'com.x' }) });
  const r = await removeApp(dir, 'com.x');
  assert.deepEqual(r, { removed: true, unfeatured: true, newsReferencing: ['n'] });
  assert.equal(await readApp(dir, 'com.x'), null);
  assert.deepEqual((await readMeta(dir)).featuredApps, ['com.y']);
  assert.deepEqual(await removeApp(dir, 'com.x'), { removed: false, unfeatured: false, newsReferencing: ['n'] });
});

test('writeNews and listNews', async () => {
  const dir = await root();
  await writeNews(dir, { caption: 'c', title: 'T', identifier: 'hello', date: 'd' });
  const [n] = await listNews(dir);
  assert.equal(n.id, 'hello');
  assert.deepEqual(Object.keys(n.item), ['$schema', 'title', 'identifier', 'caption', 'date']);
});

test('prependVersion refuses duplicates unless forced, and replaces when forced', () => {
  const a = app('com.x', { versions: [version({ version: '1.0' })] });
  const added = prependVersion(a, version({ version: '1.1' }));
  assert.deepEqual(added.versions.map((v) => v.version), ['1.1', '1.0']);
  assert.throws(() => prependVersion(a, version({ version: '1.0', size: 2 })), /already exists at index 0; use --force/);
  const forced = prependVersion(added, version({ version: '1.0', size: 2 }), { force: true });
  assert.deepEqual(forced.versions.map((v) => [v.version, v.size]), [['1.0', 2], ['1.1', 1234]]);
  const adp = prependVersion(a, version({ version: '1.0', downloadURL: 'https://x/adp/' }));
  assert.equal(adp.versions.length, 2, 'same version as a different kind is not a duplicate');
});

test('slugify and today', () => {
  assert.equal(slugify('Nuvio 0.4.18 — Enhanced!'), 'nuvio-0-4-18-enhanced');
  assert.equal(slugify('///'), 'item');
  assert.match(today(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
