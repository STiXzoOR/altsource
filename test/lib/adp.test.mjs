import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adpRootURL, parseManifest, versionFromManifest, fetchManifest } from '../../src/lib/adp.mjs';

const fixture = async () => JSON.parse(await readFile('test/fixtures/adp-manifest.json', 'utf8'));

test('adpRootURL normalises manifest, directory and bare URLs', () => {
  assert.equal(adpRootURL('https://h/app/adp/x/manifest.json?y=1'), 'https://h/app/adp/x/');
  assert.equal(adpRootURL('https://h/app/adp/x/'), 'https://h/app/adp/x/');
  assert.equal(adpRootURL('https://h/app/adp/x'), 'https://h/app/adp/x/');
});

test('parseManifest maps the real manifest fields', async () => {
  const p = parseManifest(await fixture());
  assert.equal(p.bundleIdentifier, 'com.tsg0o0.cse');
  assert.equal(p.marketplaceID, '6445840140');
  assert.equal(p.version, '4.19');
  assert.equal(p.buildVersion, '71');
  assert.equal(p.minOSVersion, '16.0');
  assert.equal(p.size, 9141886);
  assert.deepEqual(p.variants.map((v) => v.file), ['38fb3b78-8270-3866-b260-8957bd769887.ipa', '00537633-59bd-301c-9468-41b230ee4439.ipa']);
  assert.deepEqual(p.deltas.map((d) => d.file), ['9d3554d4-fcac-3bb5-b28c-f5cbe21e7421.ipa', 'b4248efb-d5be-3ea3-9c38-209a5553d789.ipa']);
  assert.throws(() => parseManifest({ hello: 1 }), /not an ADP manifest/);
});

test('versionFromManifest builds the entry, with assetURLs when a release base is given', async () => {
  const p = parseManifest(await fixture());
  const plain = versionFromManifest(p, { manifestURL: 'https://h/adp/x/manifest.json', date: '2026-06-10' });
  assert.deepEqual(plain, { version: '4.19', buildVersion: '71', date: '2026-06-10', downloadURL: 'https://h/adp/x/', size: 9141886, minOSVersion: '16.0' });
  const rel = versionFromManifest(p, { manifestURL: 'https://h/adp/x/', date: 'd', notes: 'n', releaseBase: 'https://github.com/o/r/releases/download/v4.19/' });
  assert.equal(rel.localizedDescription, 'n');
  assert.deepEqual(rel.assetURLs, {
    manifest: 'https://github.com/o/r/releases/download/v4.19/manifest.json',
    signature: 'https://github.com/o/r/releases/download/v4.19/signature',
    '38fb3b78-8270-3866-b260-8957bd769887': 'https://github.com/o/r/releases/download/v4.19/38fb3b78-8270-3866-b260-8957bd769887.ipa',
    '00537633-59bd-301c-9468-41b230ee4439': 'https://github.com/o/r/releases/download/v4.19/00537633-59bd-301c-9468-41b230ee4439.ipa',
    '9d3554d4-fcac-3bb5-b28c-f5cbe21e7421': 'https://github.com/o/r/releases/download/v4.19/9d3554d4-fcac-3bb5-b28c-f5cbe21e7421.ipa',
    'b4248efb-d5be-3ea3-9c38-209a5553d789': 'https://github.com/o/r/releases/download/v4.19/b4248efb-d5be-3ea3-9c38-209a5553d789.ipa',
  });
});

test('fetchManifest accepts a root URL, appends manifest.json and returns last-modified', async () => {
  const seen = [];
  const fetch = async (url) => { seen.push(url); return { ok: true, status: 200, headers: new Headers({ 'last-modified': 'Wed, 10 Jun 2026 00:00:00 GMT' }), arrayBuffer: async () => new TextEncoder().encode('{"variants":[]}').buffer }; };
  const r = await fetchManifest('https://h/adp/x/', { fetch });
  assert.deepEqual(seen, ['https://h/adp/x/manifest.json']);
  assert.equal(r.manifestURL, 'https://h/adp/x/manifest.json');
  assert.deepEqual(r.manifest, { variants: [] });
  assert.equal(r.lastModified, 'Wed, 10 Jun 2026 00:00:00 GMT');
  await assert.rejects(fetchManifest('https://h/adp/x/manifest.json', { fetch: async () => ({ ok: true, status: 200, headers: new Headers(), arrayBuffer: async () => new TextEncoder().encode('<html>').buffer }) }), /not JSON/);
});
