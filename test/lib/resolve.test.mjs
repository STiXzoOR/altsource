import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContent } from '../../src/lib/resolve.mjs';
import { content, app, news, version, root, BASE } from '../helpers/content.mjs';

test('resolves relative URLs in meta, apps, versions and news against baseURL', async () => {
  const c = content({
    meta: { iconURL: 'assets/icon.png', headerURL: './assets/header.png', website: 'https://example.com' },
    apps: [app('com.x', { iconURL: 'assets/apps/com.x/icon.png', versions: [version({ downloadURL: 'https://dev.example/a.ipa' })] })],
    news: [news('n', { imageURL: 'assets/news/n.png' })],
  });
  const r = await resolveContent(c, { rootDir: await root() });
  assert.equal(r.meta.iconURL, `${BASE}assets/icon.png`);
  assert.equal(r.meta.headerURL, `${BASE}assets/header.png`);
  assert.equal(r.meta.website, 'https://example.com');
  assert.equal(r.apps[0].data.iconURL, `${BASE}assets/apps/com.x/icon.png`);
  assert.equal(r.apps[0].data.versions[0].downloadURL, 'https://dev.example/a.ipa');
  assert.equal(r.news[0].data.imageURL, `${BASE}assets/news/n.png`);
  assert.equal(c.meta.iconURL, 'assets/icon.png', 'input untouched');
});

test('fills width/height for local screenshots, keeps explicit dims, leaves remote ones alone', async () => {
  const shots = {
    iphone: ['assets/apps/com.x/1.png', 'https://dev.example/2.png'],
    ipad: [{ imageURL: 'assets/apps/com.x/ipad.png' }, { imageURL: 'assets/apps/com.x/ipad.png', width: 1, height: 2 }],
  };
  const dir = await root({ 'assets/apps/com.x/1.png': 'png:1179x2556', 'assets/apps/com.x/ipad.png': 'png:2388x1668' });
  const r = await resolveContent(content({ apps: [app('com.x', { screenshots: shots })] }), { rootDir: dir });
  assert.deepEqual(r.apps[0].data.screenshots, {
    iphone: [{ imageURL: `${BASE}assets/apps/com.x/1.png`, width: 1179, height: 2556 }, 'https://dev.example/2.png'],
    ipad: [{ imageURL: `${BASE}assets/apps/com.x/ipad.png`, width: 2388, height: 1668 }, { imageURL: `${BASE}assets/apps/com.x/ipad.png`, width: 1, height: 2 }],
  });
});

test('plain screenshot arrays are handled too', async () => {
  const dir = await root({ 'assets/s.png': 'png:10x20' });
  const r = await resolveContent(content({ apps: [app('com.x', { screenshots: ['assets/s.png'] })] }), { rootDir: dir });
  assert.deepEqual(r.apps[0].data.screenshots, [{ imageURL: `${BASE}assets/s.png`, width: 10, height: 20 }]);
});
