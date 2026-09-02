import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectURLs, checkLinks } from '../../src/lib/links.mjs';

test('collectURLs dedupes across outputs and records the first location', () => {
  const pal = { iconURL: 'https://x/i.png', apps: [{ iconURL: 'https://x/i.png', versions: [{ downloadURL: 'https://x/adp/' }] }] };
  const classic = { iconURL: 'https://x/i.png', apps: [{ screenshots: ['https://x/s.png'] }] };
  assert.deepEqual(collectURLs({ pal, classic }), [
    { url: 'https://x/i.png', where: 'pal#/iconURL' },
    { url: 'https://x/adp/', where: 'pal#/apps/0/versions/0/downloadURL' },
    { url: 'https://x/s.png', where: 'classic#/apps/0/screenshots/0' },
  ]);
});

test('checkLinks reports non-2xx, retries HEAD 405 with GET, and treats throws as status 0', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url.endsWith('/ok')) return { status: 200 };
    if (url.endsWith('/head405')) return init.method === 'HEAD' ? { status: 405 } : { status: 206 };
    if (url.endsWith('/gone')) return { status: 404 };
    throw new Error('ECONNRESET');
  };
  const entries = ['ok', 'head405', 'gone', 'boom'].map((s) => ({ url: `https://x/${s}`, where: s }));
  const r = await checkLinks(entries, { fetch, concurrency: 2 });
  assert.equal(r.total, 4);
  assert.deepEqual(r.broken, [
    { url: 'https://x/boom', where: 'boom', status: 0 },
    { url: 'https://x/gone', where: 'gone', status: 404 },
  ]);
  assert.ok(calls.includes('HEAD https://x/head405') && calls.includes('GET https://x/head405'));
});
