import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { run } from '../../src/cli/app.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, root, BASE } from '../helpers/content.mjs';
import { routes, ipa18 } from '../helpers/routes.mjs';

const out = () => ({ text: '', write(s) { this.text += s; } });
const ctx = async (extra = {}) => { const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE }, 'assets/icon.png': 'png:2x2' }); const o = out(); return { cwd: dir, stdout: o, stderr: o, fetch: makeFetch(routes), out: o, ...extra }; };
const read = (c, id) => readFile(`${c.cwd}/apps/${id}.json`, 'utf8').then(JSON.parse);

test('app add --from-github builds the app from the release IPA and repo info', async () => {
  const c = await ctx();
  assert.equal(await run(['add', '--from-github', 'o/r', '--tag', 'v1.8', '--upstream', '--asset', '*.ipa'], c), 0, c.out.text);
  const a = await read(c, 'com.example.demo');
  assert.equal(Object.keys(a)[0], '$schema');
  assert.equal(a.name, 'Demo App');
  assert.equal(a.developerName, 'o');
  assert.equal(a.localizedDescription, 'Repo description');
  assert.equal(a.iconURL, 'https://github.com/o.png');
  assert.deepEqual(a.versions.map((v) => [v.version, v.buildVersion, v.downloadURL, v.size, v.date, v.localizedDescription]), [['1.2.3', '45', 'https://gh/d/App-1.8.ipa', 61310926, '2026-08-01T00:00:00Z', 'Release notes']]);
  assert.equal(a.versions[0].sha256.length, 64);
  assert.deepEqual(a.appPermissions.entitlements, ['get-task-allow']);
  assert.equal(a.appPermissions.privacy.NSCameraUsageDescription, 'Takes photos');
  assert.deepEqual(a.upstream, { type: 'github', repo: 'o/r', asset: '*.ipa' });
  assert.match(c.out.text, /added apps\/com\.example\.demo\.json/);
  assert.match(c.out.text, /note: iconURL set to the GitHub avatar/);
});

test('app add --from-ipa needs a hosted URL for local files and checks the bundle id', async () => {
  const c = await ctx();
  await (await import('node:fs/promises')).writeFile(`${c.cwd}/local.ipa`, ipa18);
  assert.equal(await run(['add', '--from-ipa', 'local.ipa'], c), 1);
  assert.match(c.out.text, /--download-url is required/);
  assert.equal(await run(['add', 'com.other', '--from-ipa', 'local.ipa', '--download-url', 'https://cdn/x.ipa'], c), 1);
  assert.match(c.out.text, /is com\.example\.demo, not com\.other/);
  assert.equal(await run(['add', '--from-ipa', 'local.ipa', '--download-url', 'https://cdn/x.ipa', '--developer', 'Me', '--icon', 'assets/icon.png', '--description', 'D'], c), 0, c.out.text);
  const a = await read(c, 'com.example.demo');
  assert.equal(a.versions[0].downloadURL, 'https://cdn/x.ipa');
  assert.equal(a.versions[0].size, ipa18.length);
  assert.equal(a.developerName, 'Me');
});

test('app add --from-source copies the upstream app and fills permissions from its IPA', async () => {
  const c = await ctx();
  assert.equal(await run(['add', 'com.example.demo', '--from-source', 'https://s/source.json', '--upstream'], c), 0, c.out.text);
  const a = await read(c, 'com.example.demo');
  assert.equal(a.name, 'Up');
  assert.deepEqual(a.upstream, { type: 'altstore', url: 'https://s/source.json' });
  assert.deepEqual(a.appPermissions.entitlements, ['get-task-allow']);
  assert.match(c.out.text, /filled appPermissions from https:\/\/gh\/d\/App-1\.8\.ipa/);
  assert.equal(await run(['add', 'com.nope', '--from-source', 'https://s/source.json'], c), 1);
  assert.match(c.out.text, /com\.nope not found/);
});

test('app add --from-adp uses the manifest and warns about placeholders', async () => {
  const c = await ctx();
  assert.equal(await run(['add', '--from-adp', 'https://h/adp/x/', '--name', 'CSE', '--developer', 'Cizzuk', '--upstream'], c), 0, c.out.text);
  const a = await read(c, 'com.tsg0o0.cse');
  assert.equal(a.marketplaceID, '6445840140');
  assert.equal(a.iconURL, 'assets/icon.png');
  assert.deepEqual(a.versions[0], { version: '4.19', buildVersion: '71', date: '2026-06-10T07:00:00Z', downloadURL: 'https://h/adp/x/', size: 9141886, minOSVersion: '16.0' });
  assert.deepEqual(a.upstream, { type: 'adp', url: 'https://h/adp/x/' });
  assert.match(c.out.text, /note: iconURL set to the source icon/);
});

test('app add refuses to overwrite without --force and rejects two --from flags', async () => {
  const c = await ctx();
  assert.equal(await run(['add', '--from-github', 'o/r'], c), 0, c.out.text);
  assert.equal(await run(['add', '--from-github', 'o/r'], c), 1);
  assert.match(c.out.text, /already exists; use --force/);
  assert.equal(await run(['add', '--from-github', 'o/r', '--force'], c), 0, c.out.text);
  assert.equal(await run(['add', '--from-github', 'o/r', '--from-adp', 'https://h/adp/x/'], c), 1);
  assert.match(c.out.text, /only one of/);
});

test('app add with no --from flag prompts interactively', async () => {
  const answers = ['Prompted', 'com.prompt', 'Dev', 'Desc', '', 'assets/icon.png', 'https://cdn/p.ipa', '2.0', '7', '1234', '15.0'];
  const c = await ctx({ input: Readable.from(answers.map((a) => a + '\n')) });
  assert.equal(await run(['add'], c), 0, c.out.text);
  const a = await read(c, 'com.prompt');
  assert.equal(a.name, 'Prompted');
  assert.deepEqual([a.versions[0].version, a.versions[0].buildVersion, a.versions[0].size, a.versions[0].minOSVersion], ['2.0', '7', 1234, '15.0']);
  assert.equal('subtitle' in a, false);
});

test('app list and app remove', async () => {
  const c = await ctx();
  await (await import('../../src/lib/content.mjs')).writeApp(c.cwd, app('com.x', { upstream: { type: 'github', repo: 'o/r' } }));
  assert.equal(await run(['list'], c), 0);
  assert.match(c.out.text, /com\.x\s+Example\s+ipa\s+1\.0 \(1\)\s+github:o\/r/);
  c.out.text = '';
  assert.equal(await run(['list', '--json'], c), 0);
  assert.equal(JSON.parse(c.out.text)[0].bundleIdentifier, 'com.x');
  c.out.text = '';
  assert.equal(await run(['remove', 'com.x'], c), 0);
  assert.match(c.out.text, /removed apps\/com\.x\.json/);
  assert.equal(await run(['remove', 'com.x'], c), 1);
});

test('unknown subcommand prints usage', async () => {
  const c = await ctx();
  assert.equal(await run(['frob'], c), 1);
  assert.match(c.out.text, /usage/);
});
