import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { run as adp } from '../../src/cli/adp.mjs';
import { run as federate } from '../../src/cli/federate.mjs';
import { run as release } from '../../src/cli/release.mjs';
import { extractADP } from '../../src/lib/adp-archive.mjs';
import { writeApp } from '../../src/lib/content.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, root, BASE } from '../helpers/content.mjs';

const manifest = await readFile('test/fixtures/adp-manifest.json');
const enc = (s) => new Uint8Array(Buffer.from(s));
const archive = Buffer.from(zipSync({ 'X.adp/manifest.json': new Uint8Array(manifest), 'X.adp/signature': enc('sig'), 'X.adp/variant/38fb3b78-8270-3866-b260-8957bd769887.ipa': enc('v1') }));
const out = () => ({ text: '', write(s) { this.text += s; } });
async function ctx(routes = {}, meta = {}) {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE, ...meta } });
  const o = out();
  return { cwd: dir, stdout: o, stderr: o, out: o, fetch: makeFetch(routes), sleep: async () => {} };
}
const api = (body) => ({ json: body });

test('adp status/process/register talk to the API', async () => {
  const c = await ctx({ 'https://api.altstore.io/adps/A1': api({ status: 'PROCESSING' }), 'https://api.altstore.io/adps': api({}), 'https://api.altstore.io/register': api({ token: 'TOK', expiration: 'E' }) });
  assert.equal(await adp(['status', 'A1'], c), 0);
  assert.match(c.out.text, /processing: PROCESSING/);
  assert.equal(await adp(['process', 'A1'], c), 0);
  assert.match(c.out.text, /processing requested for A1/);
  assert.equal(await adp(['register', '--developer-id', 'D', '--email', 'e@x'], c), 0);
  assert.match(c.out.text, /token: TOK/);
  assert.equal(await adp(['register'], c), 1);
  assert.equal(await adp(['nope'], c), 1);
});

test('adp download waits for processing, then extracts the archive', async () => {
  let polls = 0;
  const c = await ctx({ 'https://cdn/adp.zip': { bytes: archive } });
  const base = c.fetch;
  c.fetch = async (url, init) => {
    if (url === 'https://api.altstore.io/adps/A1') { polls++; return { ok: true, status: 200, text: async () => JSON.stringify(polls < 3 ? { status: 'PROCESSING' } : { downloadURL: 'https://cdn/adp.zip' }) }; }
    return base(url, init);
  };
  assert.equal(await adp(['download', 'A1', '--out', 'adp'], c), 1);
  assert.match(c.out.text, /still processing.*pass --wait/);
  c.out.text = '';
  assert.equal(await adp(['download', 'A1', '--out', 'adp', '--wait', '--interval', '0'], c), 0);
  assert.match(c.out.text, /extracted 3 file\(s\) into adp/);
  assert.equal(JSON.parse(await readFile(path.join(c.cwd, 'adp/manifest.json'), 'utf8')).bundleId, 'com.tsg0o0.cse');
});

test('federate posts the PAL source URL and requires fediUsername', async () => {
  const c = await ctx({ 'https://api.altstore.io/federate': api({}) }, { fediUsername: 'stix' });
  assert.equal(await federate([], c), 0);
  assert.match(c.out.text, /federated https:\/\/stixzoor\.github\.io\/altsource\/source\.pal\.json/);
  assert.deepEqual(JSON.parse(c.fetch.calls[0].body), { source: `${BASE}source.pal.json` });
  const d = await ctx({});
  assert.equal(await federate([], d), 1);
  assert.match(d.out.text, /set fediUsername/);
});

test('release publish uploads via gh and prepends the version with assetURLs', async () => {
  const c = await ctx();
  const calls = [];
  c.exec = async (cmd, args) => { calls.push([cmd, ...args]); if (args[1] === 'view') throw new Error('nope'); return { stdout: '' }; };
  await writeApp(c.cwd, app('com.tsg0o0.cse', { versions: [version({ version: '4.18', buildVersion: '70', downloadURL: 'https://h/adp/old/' })] }));
  await extractADP(archive, path.join(c.cwd, 'adp'));
  assert.equal(await release(['publish', 'com.tsg0o0.cse', '--adp-dir', 'adp', '--tag', 'v4.19', '--repo', 'o/r', '--dry-run'], c), 0, c.out.text);
  assert.match(c.out.text, /would upload 3 file\(s\) to https:\/\/github\.com\/o\/r\/releases\/download\/v4\.19\//);
  assert.equal(calls.length, 0);
  c.out.text = '';
  assert.equal(await release(['publish', 'com.tsg0o0.cse', '--adp-dir', 'adp', '--tag', 'v4.19', '--repo', 'o/r', '--notes', 'Big release'], c), 0, c.out.text);
  assert.equal(calls[1][2], 'create');
  const a = JSON.parse(await readFile(path.join(c.cwd, 'apps/com.tsg0o0.cse.json'), 'utf8'));
  assert.equal(a.marketplaceID, '6445840140');
  assert.equal(a.versions[0].version, '4.19');
  assert.equal(a.versions[0].downloadURL, 'https://github.com/o/r/releases/download/v4.19/');
  assert.equal(a.versions[0].assetURLs.manifest, 'https://github.com/o/r/releases/download/v4.19/manifest.json');
  assert.equal(a.versions[0].assetURLs['38fb3b78-8270-3866-b260-8957bd769887'], 'https://github.com/o/r/releases/download/v4.19/38fb3b78-8270-3866-b260-8957bd769887.ipa');
  assert.equal(a.versions[0].localizedDescription, 'Big release');
  assert.equal(await release(['publish', 'com.tsg0o0.cse', '--adp-dir', 'adp', '--tag', 'v4.19', '--repo', 'o/r'], c), 1);
  assert.match(c.out.text, /already exists at index 0/);
  assert.equal(await release(['publish', 'com.missing', '--adp-dir', 'adp', '--tag', 'v1', '--repo', 'o/r'], c), 1);
  assert.equal(await release(['publish', 'com.tsg0o0.cse'], c), 1);
});
