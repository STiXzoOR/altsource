import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, fetchLatestRelease, matchAsset, fetchRepoInfo } from '../../src/lib/github.mjs';

const json = (body) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body });
const releases = [
  { tag_name: 'v2.0-beta', prerelease: true, draft: false, body: 'beta', published_at: '2026-09-01T00:00:00Z', html_url: 'https://gh/r/b', assets: [{ name: 'App-2.0-beta.ipa', size: 5, browser_download_url: 'https://gh/d/beta.ipa' }] },
  { tag_name: 'v1.9', prerelease: false, draft: true, body: 'draft', published_at: '2026-08-30T00:00:00Z', assets: [] },
  { tag_name: 'v1.8', name: 'One point eight', prerelease: false, draft: false, body: 'notes', published_at: '2026-08-01T00:00:00Z', html_url: 'https://gh/r/1.8', assets: [{ name: 'App-1.8.dSYM.zip', size: 1, browser_download_url: 'https://gh/d/sym.zip' }, { name: 'App-1.8.ipa', size: 61310926, browser_download_url: 'https://gh/d/App-1.8.ipa' }] },
];

test('globToRegExp', () => {
  assert.equal(globToRegExp('*.ipa').test('Nuvio-v0.4.18-Enhanced.IPA'), true);
  assert.equal(globToRegExp('*-Enhanced.ipa').test('Nuvio-Lite.ipa'), false);
  assert.equal(globToRegExp('a.b').test('aXb'), false);
});

test('fetchLatestRelease skips drafts and prereleases by default, includes prereleases on request, fetches a tag', async () => {
  const seen = [];
  const fetch = async (url) => { seen.push(url); return url.includes('/tags/') ? json(releases[2]) : json(releases); };
  const stable = await fetchLatestRelease('o/r', { fetch });
  assert.equal(stable.tag, 'v1.8');
  assert.equal(stable.name, 'One point eight');
  assert.deepEqual(stable.assets[1], { name: 'App-1.8.ipa', size: 61310926, url: 'https://gh/d/App-1.8.ipa' });
  assert.equal((await fetchLatestRelease('o/r', { fetch, prerelease: true })).tag, 'v2.0-beta');
  assert.equal((await fetchLatestRelease('o/r', { fetch, tag: 'v1.8' })).tag, 'v1.8');
  assert.ok(seen.at(-1).endsWith('/repos/o/r/releases/tags/v1.8'));
  await assert.rejects(fetchLatestRelease('o/r', { fetch: async () => json([releases[0]]) }), /no stable release/);
});

test('fetchLatestRelease sends a bearer token when given', async () => {
  let auth;
  await fetchLatestRelease('o/r', { fetch: async (u, init) => { auth = init.headers.authorization; return json(releases); }, token: 'T' });
  assert.equal(auth, 'Bearer T');
});

test('matchAsset picks the first glob match and lists names on failure', () => {
  assert.equal(matchAsset(releases[2].assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url }))).name, 'App-1.8.ipa');
  assert.throws(() => matchAsset([{ name: 'x.zip' }], '*.ipa'), /no release asset matches "\*\.ipa" \(have: x\.zip\)/);
});

test('fetchRepoInfo', async () => {
  const r = await fetchRepoInfo('o/r', { fetch: async () => json({ description: 'D', owner: { login: 'o' }, html_url: 'https://github.com/o/r', homepage: null }) });
  assert.deepEqual(r, { description: 'D', owner: 'o', htmlURL: 'https://github.com/o/r', homepage: '' });
});
