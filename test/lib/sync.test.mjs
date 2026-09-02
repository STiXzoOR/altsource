import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncApp, runSync, formatSyncMarkdown } from '../../src/lib/sync.mjs';
import { writeApp, readApp, listNews } from '../../src/lib/content.mjs';
import { readState } from '../../src/lib/state.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const upstreamSource = { name: 'S', apps: [{ bundleIdentifier: 'com.up', name: 'Up 2', developerName: 'U', localizedDescription: 'new desc', iconURL: 'https://s/i2.png', subtitle: 'fresh', versions: [version({ version: '2.0', buildVersion: '2', date: '2026-09-02', downloadURL: 'https://gh/d/App-1.9.ipa' }), version({ version: '1.0', buildVersion: '1', downloadURL: 'https://gh/d/App-1.8.ipa' })] }] };
const all = { ...routes, 'https://s/up.json': { json: upstreamSource } };
const ctx = (extra = {}) => ({ cwd: '/', fetch: makeFetch(all), token: '', ...extra });

test('altstore upstream: replaces versions by default, detects the new release, keeps local metadata', async () => {
  const local = app('com.up', { name: 'Local name', versions: [version({ version: '1.0', buildVersion: '1', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'altstore', url: 'https://s/up.json' } });
  const r = await syncApp({ id: 'com.up', app: local }, ctx());
  assert.equal(r.action, 'added');
  assert.deepEqual([r.from, r.to], ['1.0', '2.0']);
  assert.equal(r.app.name, 'Local name');
  assert.equal(r.app.versions.length, 2);
  assert.equal(r.app.subtitle, 'sub');
});

test('altstore upstream: sync "*" copies every field, unchanged when nothing differs, fills missing permissions', async () => {
  const local = app('com.up', { appPermissions: undefined, versions: upstreamSource.apps[0].versions, upstream: { type: 'altstore', url: 'https://s/up.json', sync: '*' } });
  const r = await syncApp({ id: 'com.up', app: local }, ctx());
  assert.equal(r.action, 'updated');
  assert.equal(r.app.name, 'Up 2');
  assert.equal(r.app.bundleIdentifier, 'com.up');
  assert.deepEqual(r.app.appPermissions.entitlements, ['com.apple.developer.siri', 'get-task-allow']);
  const again = await syncApp({ id: 'com.up', app: r.app }, ctx());
  assert.equal(again.action, 'unchanged');
});

test('github upstream: adds the newest release with permissions; unchanged when the asset is already listed', async () => {
  const local = app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'github', repo: 'o/r' } });
  const r = await syncApp({ id: 'com.example.demo', app: local }, ctx());
  assert.equal(r.action, 'added');
  assert.equal(r.version.version, '1.3.0');
  assert.equal(r.version.localizedDescription, 'newer');
  assert.equal(r.version.size, routes['https://api.github.com/repos/o/r/releases?per_page=30'].json[0].assets[0].size);
  assert.deepEqual(r.app.appPermissions.entitlements, ['com.apple.developer.siri', 'get-task-allow']);
  assert.equal((await syncApp({ id: 'com.example.demo', app: r.app }, ctx())).action, 'unchanged');
  const noNotes = await syncApp({ id: 'com.example.demo', app: { ...local, upstream: { type: 'github', repo: 'o/r', notes: 'none' } } }, ctx());
  assert.equal(noNotes.version.localizedDescription, undefined);
});

test('github upstream: wrong bundle id and missing asset become errors, never throws', async () => {
  const r = await syncApp({ id: 'com.other', app: app('com.other', { upstream: { type: 'github', repo: 'o/r' } }) }, ctx());
  assert.equal(r.action, 'error');
  assert.match(r.message, /release asset is com\.example\.demo, expected com\.other/);
  const missing = await syncApp({ id: 'com.x', app: app('com.x', { upstream: { type: 'github', repo: 'o/r', asset: '*.zip' } }) }, ctx());
  assert.equal(missing.action, 'error');
  assert.match(missing.message, /no release asset matches/);
  assert.equal((await syncApp({ id: 'com.x', app: app('com.x') }, ctx())).action, 'skipped');
});

test('adp upstream: adds a new manifest version (with marketplaceID) and is unchanged afterwards', async () => {
  const local = app('com.tsg0o0.cse', { versions: [version({ version: '4.18', buildVersion: '70', downloadURL: 'https://h/adp/old/' })], upstream: { type: 'adp', url: 'https://h/adp/x/' } });
  const r = await syncApp({ id: 'com.tsg0o0.cse', app: local }, ctx());
  assert.equal(r.action, 'added');
  assert.equal(r.app.marketplaceID, '6445840140');
  assert.deepEqual([r.version.version, r.version.buildVersion, r.version.downloadURL, r.version.date], ['4.19', '71', 'https://h/adp/x/', '2026-06-10T07:00:00Z']);
  assert.equal((await syncApp({ id: 'com.tsg0o0.cse', app: r.app }, ctx())).action, 'unchanged');
});

test('runSync writes changed apps, creates one news item per new version, logs, honours only/dryRun', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } });
  await writeApp(dir, app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'github', repo: 'o/r', notify: true } }));
  await writeApp(dir, app('com.static'));
  await writeApp(dir, app('com.broken', { upstream: { type: 'github', repo: 'o/r', asset: '*.zip' } }));
  const dry = await runSync({ cwd: dir, fetch: makeFetch(all), dryRun: true });
  assert.deepEqual(dry.changed, ['com.example.demo']);
  assert.equal((await readApp(dir, 'com.example.demo')).versions.length, 1, 'dry run writes nothing');
  assert.equal(await readState(dir, 'sync-log'), null);
  const only = await runSync({ cwd: dir, fetch: makeFetch(all), only: ['com.broken'] });
  assert.deepEqual(only.results.map((r) => [r.id, r.action]), [['com.broken', 'error']]);
  const real = await runSync({ cwd: dir, fetch: makeFetch(all) });
  assert.deepEqual(real.changed, ['com.example.demo']);
  assert.equal((await readApp(dir, 'com.example.demo')).versions[0].version, '1.3.0');
  const news = await listNews(dir);
  assert.deepEqual(news.map((n) => n.id), ['update-com-example-demo-1-3-0-50']);
  assert.equal(news[0].item.notify, true);
  assert.equal(news[0].item.appID, 'com.example.demo');
  assert.equal(news[0].item.title, 'Example 1.3.0');
  const log = await readState(dir, 'sync-log');
  assert.deepEqual(log.slice(0, 2).map((e) => [e.id, e.action]), [['com.broken', 'error'], ['com.example.demo', 'added']]);
  assert.equal(log.length, 3);
  const again = await runSync({ cwd: dir, fetch: makeFetch(all) });
  assert.deepEqual(again.changed, []);
  assert.equal((await listNews(dir)).length, 1, 'no duplicate news');
});

test('formatSyncMarkdown renders a table', () => {
  const md = formatSyncMarkdown([{ id: 'com.a', action: 'added', from: '1', to: '2' }, { id: 'com.b', action: 'error', message: 'boom | bang' }]);
  assert.match(md, /\| `com\.a` \| added \| 1 → 2 \|/);
  assert.match(md, /boom \\\| bang/);
  assert.match(formatSyncMarkdown([]), /no apps with upstream/);
});
