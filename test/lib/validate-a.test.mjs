import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, isISODate, localPath } from '../../src/lib/validate.mjs';
import { content, app, news, version, root, codes, errorCodes } from '../helpers/content.mjs';

const run = async (c, files) => validateContent(c, { rootDir: await root(files) });

test('a well-formed source has no errors', async () => {
  const r = await run(content({ apps: [app()], news: [news()] }));
  assert.deepEqual(r.errors, []);
});

test('E01 schema violations carry file and pointer paths', async () => {
  const r = await run(content({ apps: [app('com.x', { developerName: undefined })] }));
  assert.equal(r.errors[0].code, 'E01');
  assert.equal(r.errors[0].path, 'apps/com.x.json#/');
  assert.match(r.errors[0].message, /developerName/);
});

test('E02/E03 bundle identifier must match file name and be unique', async () => {
  const r = await run(content({ apps: [app('com.a', { __file: 'com.b' }), app('com.a')] }));
  assert.deepEqual(errorCodes(r), ['E02', 'E03']);
});

test('E04 news identifier must match file name and be unique', async () => {
  const r = await run(content({ news: [news('n1', { __file: 'other' }), news('n1')] }));
  assert.deepEqual(errorCodes(r), ['E04', 'E04']);
});

test('E05/W02 featuredApps must exist; more than five warns', async () => {
  const apps = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => app(`com.${s}`));
  const r = await run(content({ meta: { featuredApps: ['com.a', 'com.b', 'com.c', 'com.d', 'com.e', 'com.f', 'com.zzz'] }, apps }));
  assert.deepEqual(errorCodes(r), ['E05']);
  assert.ok(codes(r).includes('W02'));
});

test('E06 rejects http:// and E07 rejects relative paths outside assets/public or missing files', async () => {
  const a = app('com.x', { iconURL: 'http://dev.example/icon.png', screenshots: ['assets/apps/com.x/missing.png', 'icon.png', 'assets/apps/com.x/ok.png'] });
  const r = await run(content({ apps: [a] }), { 'assets/apps/com.x/ok.png': 'png:10x10' });
  assert.deepEqual(errorCodes(r), ['E06', 'E07', 'E07']);
  assert.equal(r.errors.find((e) => e.code === 'E06').path, 'apps/com.x.json#/iconURL');
});

test('relative meta URLs that exist are fine', async () => {
  const r = await run(content({ meta: { iconURL: 'assets/icon.png', headerURL: './assets/header.png' } }), { 'assets/icon.png': 'png:4x4', 'assets/header.png': 'png:6x4' });
  assert.deepEqual(r.errors, []);
});

test('E08 tint colours, E09 dates, E10 category', async () => {
  const a = app('com.x', { tintColor: 'blue', category: 'music', versions: [version({ date: '2026-13-40' })] });
  const r = await run(content({ meta: { tintColor: '#12345' }, apps: [a], news: [news('n', { date: 'yesterday', tintColor: 'ABCDEF' })] }));
  assert.deepEqual(errorCodes(r), ['E08', 'E08', 'E09', 'E09', 'E10']);
});

test('E16 malformed upstream is reported once with its own code', async () => {
  const r = await run(content({ apps: [app('com.x', { upstream: { type: 'github' } })] }));
  assert.deepEqual(errorCodes(r), ['E16']);
});

test('W01 unknown keys and W06 news appID not in apps', async () => {
  const r = await run(content({ meta: { iconUrl: 'x' }, apps: [app('com.x', { versions: [version({ sizes: 1 })] })], news: [news('n', { appID: 'com.nope' })] }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(codes(r).filter((c) => c === 'W01' || c === 'W06'), ['W01', 'W01', 'W06']);
});

test('isISODate accepts the documented forms', () => {
  for (const ok of ['2023-2-17', '2023-02-17', '2023-02-17T12:00:00-06:00', '2026-01-03T17:51:54Z', '2026-06-10T07:00:00+09:00']) assert.equal(isISODate(ok), true, ok);
  for (const bad of ['2023/02/17', '2023-02-30', '17-02-2023', '2023-02-17 12:00', 42, undefined]) assert.equal(isISODate(bad), false, String(bad));
});

test('localPath', () => {
  assert.equal(localPath('assets/a.png'), 'assets/a.png');
  assert.equal(localPath('./public/x.html'), 'public/x.html');
  assert.equal(localPath('a.png'), null);
});
