import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatus, upstreamState, formatStatusText, formatStatusMarkdown } from '../../src/lib/status.mjs';
import { writeApp, writeNews } from '../../src/lib/content.mjs';
import { writeState } from '../../src/lib/state.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, news, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const fetch = () => makeFetch(routes);

test('upstreamState: none, in-sync, behind, ahead, unknown, offline', async () => {
  assert.equal(await upstreamState(app('com.x'), { fetch: fetch(), online: true }), null);
  const gh = (versions) => app('com.example.demo', { versions, upstream: { type: 'github', repo: 'o/r' } });
  const v19 = version({ version: '1.3.0', buildVersion: '50', downloadURL: 'https://gh/d/App-1.9.ipa' });
  const v18 = version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' });
  assert.equal((await upstreamState(gh([v19, v18]), { fetch: fetch(), online: true })).state, 'in-sync');
  assert.equal((await upstreamState(gh([v18]), { fetch: fetch(), online: true })).state, 'behind');
  assert.equal((await upstreamState(gh([version({ version: '9', downloadURL: 'https://cdn/9.ipa' }), v19]), { fetch: fetch(), online: true })).state, 'ahead');
  const off = await upstreamState(gh([v18]), { fetch: fetch(), online: false });
  assert.deepEqual([off.state, off.latest, off.type, off.ref], ['unknown', null, 'github', 'https://github.com/o/r']);
  const bad = await upstreamState(app('com.x', { upstream: { type: 'adp', url: 'https://h/adp/missing/' } }), { fetch: fetch(), online: true });
  assert.equal(bad.state, 'unknown');
  assert.match(bad.error, /HTTP 404/);
  const adp = await upstreamState(app('com.tsg0o0.cse', { versions: [version({ version: '4.19', buildVersion: '71', downloadURL: 'https://h/adp/x/' })], upstream: { type: 'adp', url: 'https://h/adp/x/' } }), { fetch: fetch(), online: true });
  assert.deepEqual([adp.state, adp.latest], ['in-sync', { version: '4.19', buildVersion: '71' }]);
  const alt = await upstreamState(app('com.example.demo', { versions: [version({ version: '0.9' })], upstream: { type: 'altstore', url: 'https://s/source.json' } }), { fetch: fetch(), online: true });
  assert.deepEqual([alt.state, alt.latest.version], ['behind', '1.0']);
});

test('buildStatus assembles counts, apps, QR codes, link-check and recent log', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } });
  await writeApp(dir, app('com.example.demo', { versions: [version({ version: '1.3.0', buildVersion: '50', downloadURL: 'https://gh/d/App-1.9.ipa' })], upstream: { type: 'github', repo: 'o/r' } }));
  await writeApp(dir, app('com.pal', { marketplaceID: '1', versions: [version({ downloadURL: 'https://h/adp/p/' })] }));
  await writeNews(dir, news('welcome'));
  await writeState(dir, 'link-check', { checkedAt: 'x', total: 3, broken: [] });
  await writeState(dir, 'sync-log', Array.from({ length: 25 }, (_, i) => ({ at: 'x', id: `com.${i}`, action: 'added' })));
  const s = await buildStatus({ cwd: dir, fetch: fetch(), online: true, commit: 'abc', repo: 'STiXzoOR/altsource' });
  assert.deepEqual(s.counts, { apps: 2, pal: 1, classic: 1, news: 1 });
  assert.deepEqual(s.sourceURLs, { pal: `${BASE}source.pal.json`, classic: `${BASE}source.json` });
  assert.match(s.qr.pal, /^<svg/);
  assert.deepEqual(s.apps.map((a) => [a.bundleIdentifier, a.kinds, a.upstream?.state ?? null]), [['com.example.demo', ['ipa'], 'in-sync'], ['com.pal', ['adp'], null]]);
  assert.deepEqual(s.apps[0].latest, { version: '1.3.0', buildVersion: '50', date: '2026-09-01' });
  assert.equal(s.linkCheck.total, 3);
  assert.equal(s.recent.length, 20);
  assert.deepEqual([s.commit, s.repo], ['abc', 'STiXzoOR/altsource']);
  assert.match(formatStatusText(s), /in-sync\s+com\.example\.demo/);
  assert.match(formatStatusMarkdown(s), /\| `com\.pal` \| adp \|/);
});
