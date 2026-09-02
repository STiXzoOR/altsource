import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, version, news, root, BASE } from '../helpers/content.mjs';

const adp = (o = {}) => version({ downloadURL: 'https://h/adp/x/', ...o });
const ipa = (o = {}) => version({ downloadURL: 'https://gh/d/a.ipa', ...o });

const fixture = await root({
  'source.meta.json': { name: 'S', baseURL: BASE, subtitle: 'sub', tintColor: '#123456', featuredApps: ['com.both'], overrides: { pal: { subtitle: 'pal only' } } },
  'apps/com.pal.json': app('com.pal', { name: 'Zed', marketplaceID: '1', versions: [adp()] }),
  'apps/com.both.json': app('com.both', { name: 'alpha', marketplaceID: '2', versions: [adp({ version: '2.0' }), ipa({ version: '2.0', kind: 'ipa' }), ipa({ version: '1.0', date: '2026-01-01' })], upstream: { type: 'github', repo: 'o/r' }, screenshots: { iphone: ['assets/s.png'], ipad: [{ imageURL: 'https://x/i.png', width: 10, height: 20 }] } }),
  'news/a.json': news('a', { date: '2026-01-01' }),
  'news/b.json': news('b', { date: '2026-02-01', appID: 'com.both' }),
  'assets/s.png': 'png:1179x2556',
});
process.env.ALTSOURCE_ROOT = fixture;
const { getSite, installLinks, universalLink, formatBytes, formatDate, versionLabel, categoryLabel, screenshotsOf, linkify } = await import('../../site/src/lib/data.mjs');
const { entitlementInfo, privacyInfo } = await import('../../site/src/lib/permissions.mjs');

test('getSite merges kinds, keeps base meta (not overrides), sorts apps and news', async () => {
  const s = await getSite();
  assert.equal(s.meta.subtitle, 'sub');
  assert.equal('overrides' in s.meta, false);
  assert.deepEqual(s.urls, { pal: `${BASE}source.pal.json`, classic: `${BASE}source.json` });
  assert.deepEqual(s.apps.map((a) => [a.id, a.kinds]), [['com.both', ['adp', 'ipa']], ['com.pal', ['adp']]]);
  assert.equal(s.apps[0].app.versions.length, 3);
  assert.equal('upstream' in s.apps[0].app, false);
  assert.equal(s.apps[0].app.screenshots.iphone[0].width, 1179, 'screenshots are resolved with dimensions');
  assert.deepEqual(s.featured.map((a) => a.id), ['com.both']);
  assert.deepEqual(s.news.map((n) => n.identifier), ['b', 'a']);
  assert.deepEqual(s.counts, { pal: 2, classic: 1 });
  assert.deepEqual(s.apps[0].project, { label: 'Project on GitHub', href: 'https://github.com/o/r' });
  assert.equal(s.apps[1].project, undefined);
  assert.equal(await getSite(), s, 'memoised');
});

test('installLinks depends on the kinds', async () => {
  const s = await getSite();
  const both = installLinks(s.apps[0], s.urls);
  assert.deepEqual(both.map((l) => l.label), ['Get in AltStore PAL', 'Get in AltStore', 'Install with SideStore', 'Download .ipa']);
  assert.equal(both[0].href, `https://altstore.io/source/stixzoor.github.io/altsource/source.pal.json?app=com.both`);
  assert.equal(both[2].href, 'sidestore://install?url=https%3A%2F%2Fgh%2Fd%2Fa.ipa');
  assert.equal(both[0].primary, true);
  const pal = installLinks(s.apps[1], s.urls);
  assert.deepEqual(pal.map((l) => l.label), ['Get in AltStore PAL']);
  assert.equal(universalLink('https://x.y/z/source.json'), 'https://altstore.io/source/x.y/z/source.json');
});

test('formatting helpers', () => {
  assert.equal(formatBytes(61310926), '58.5 MB');
  assert.equal(formatBytes(1234), '1.2 KB');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatDate('2026-09-02T10:00:00Z'), '2 Sept 2026');
  assert.equal(formatDate('2026-2-17'), '17 Feb 2026');
  assert.equal(versionLabel({ version: '1.0', buildVersion: '3' }), '1.0', 'no build numbers on the site');
  assert.equal(versionLabel({ version: '1.0', marketingVersion: 'One' }), 'One');
  assert.equal(categoryLabel('utilities'), 'Utilities');
  assert.equal(categoryLabel('photo-video'), 'Photo & Video');
  assert.equal(categoryLabel('developer'), 'Developer Tools');
  assert.equal(categoryLabel(undefined), 'Other');
  assert.deepEqual(screenshotsOf({ screenshots: ['https://a', { imageURL: 'https://b', width: 1, height: 2 }] }), { iphone: [{ imageURL: 'https://a' }, { imageURL: 'https://b', width: 1, height: 2 }], ipad: [] });
  assert.deepEqual(screenshotsOf({}), { iphone: [], ipad: [] });
  assert.equal(linkify('see https://x.y/a?b=1 & <b>'), 'see <a href="https://x.y/a?b=1" rel="noopener" target="_blank">https://x.y/a?b=1</a> &amp; &lt;b&gt;');
});

test('permission lookups fall back gracefully', () => {
  assert.equal(entitlementInfo('com.apple.security.application-groups').name, 'App Groups');
  assert.equal(entitlementInfo('com.example.custom').name, 'com.example.custom');
  assert.equal(privacyInfo('NSCameraUsageDescription', 'Takes photos').description, 'Takes photos');
  assert.equal(privacyInfo('NSCameraUsageDescription', 'x').name, 'Camera');
  assert.equal(privacyInfo('NSFooBarUsageDescription', 'x').name, 'Foo Bar');
});
