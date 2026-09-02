import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { extractADP, downloadADP, readADPDir } from '../../src/lib/adp-archive.mjs';
import { root } from '../helpers/content.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';

const manifest = await readFile('test/fixtures/adp-manifest.json');
const enc = (s) => new Uint8Array(Buffer.from(s));
const archive = (prefix = 'CSE.adp/') => Buffer.from(zipSync({
  [`${prefix}manifest.json`]: new Uint8Array(manifest),
  [`${prefix}signature`]: enc('sig'),
  [`${prefix}variant/38fb3b78-8270-3866-b260-8957bd769887.ipa`]: enc('v1'),
  [`${prefix}variant/00537633-59bd-301c-9468-41b230ee4439.ipa`]: enc('v2'),
  [`${prefix}delta/9d3554d4-fcac-3bb5-b28c-f5cbe21e7421.ipa`]: enc('d1'),
  '__MACOSX/CSE.adp/._manifest.json': enc('junk'),
}));

test('extractADP strips the top-level folder and preserves the hierarchy', async () => {
  const out = path.join(await root(), 'adp');
  const r = await extractADP(archive(), out);
  assert.equal(r.files, 5);
  assert.equal(await readFile(path.join(out, 'signature'), 'utf8'), 'sig');
  assert.equal(await readFile(path.join(out, 'variant/38fb3b78-8270-3866-b260-8957bd769887.ipa'), 'utf8'), 'v1');
  assert.equal(JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8')).bundleId, 'com.tsg0o0.cse');
});

test('extractADP accepts archives without a folder and rejects non-zips and missing manifests', async () => {
  const out = path.join(await root(), 'adp');
  assert.equal((await extractADP(archive(''), out)).files, 5);
  await assert.rejects(extractADP(Buffer.from('nope'), out), /not a zip/);
  await assert.rejects(extractADP(Buffer.from(zipSync({ 'a.txt': enc('x') })), out), /manifest\.json not found/);
});

test('downloadADP fetches and extracts; readADPDir lists publishable files and warns about a missing signature', async () => {
  const out = path.join(await root(), 'adp');
  await downloadADP('https://cdn/adp.zip', out, { fetch: makeFetch({ 'https://cdn/adp.zip': { bytes: archive() } }) });
  const r = await readADPDir(out);
  assert.equal(r.manifest.bundleId, 'com.tsg0o0.cse');
  assert.deepEqual(r.files.map((f) => f.name), ['manifest.json', 'signature', '00537633-59bd-301c-9468-41b230ee4439.ipa', '38fb3b78-8270-3866-b260-8957bd769887.ipa', '9d3554d4-fcac-3bb5-b28c-f5cbe21e7421.ipa']);
  assert.deepEqual(r.warnings, []);
  const bare = path.join(await root(), 'bare');
  await extractADP(Buffer.from(zipSync({ 'manifest.json': new Uint8Array(manifest) })), bare);
  assert.deepEqual((await readADPDir(bare)).warnings, ['signature file missing']);
  await assert.rejects(readADPDir(path.join(await root(), 'none')), /manifest\.json: not found/);
});
