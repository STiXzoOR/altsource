import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run } from '../../src/cli/version.mjs';
import { writeApp } from '../../src/lib/content.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const out = () => ({ text: '', write(s) { this.text += s; } });
const ctx = async () => { const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } }); const o = out(); return { cwd: dir, stdout: o, stderr: o, fetch: makeFetch(routes), out: o }; };
const read = (c, id) => readFile(`${c.cwd}/apps/${id}.json`, 'utf8').then(JSON.parse);

test('version add --from-github prepends the newest release and refreshes permissions', async () => {
  const c = await ctx();
  await writeApp(c.cwd, app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], appPermissions: { entitlements: ['get-task-allow'], privacy: {} } }));
  assert.equal(await run(['add', 'com.example.demo', '--from-github', 'o/r'], c), 0, c.out.text);
  const a = await read(c, 'com.example.demo');
  assert.deepEqual(a.versions.map((v) => v.version), ['1.3.0', '1.2.3']);
  assert.equal(a.versions[0].localizedDescription, 'newer');
  assert.deepEqual(a.appPermissions.entitlements, ['com.apple.developer.siri', 'get-task-allow']);
  assert.match(c.out.text, /appPermissions updated/);
  assert.match(c.out.text, /added 1\.3\.0 \(50\) \[ipa\] to apps\/com\.example\.demo\.json/);
});

test('version add refuses duplicates unless --force, and wrong bundle ids', async () => {
  const c = await ctx();
  await writeApp(c.cwd, app('com.example.demo', { versions: [version({ version: '1.3.0', buildVersion: '50', downloadURL: 'https://gh/d/App-1.9.ipa' })] }));
  assert.equal(await run(['add', 'com.example.demo', '--from-github', 'o/r'], c), 1);
  assert.match(c.out.text, /already exists at index 0; use --force/);
  assert.equal(await run(['add', 'com.example.demo', '--from-github', 'o/r', '--force'], c), 0, c.out.text);
  assert.equal((await read(c, 'com.example.demo')).versions.length, 1);
  await writeApp(c.cwd, app('com.other'));
  assert.equal(await run(['add', 'com.other', '--from-github', 'o/r'], c), 1);
  assert.match(c.out.text, /is com\.example\.demo, not com\.other/);
});

test('version add --from-adp with --release writes assetURLs; missing app or flags fail', async () => {
  const c = await ctx();
  await writeApp(c.cwd, app('com.tsg0o0.cse', { marketplaceID: '6445840140', versions: [version({ version: '4.18', downloadURL: 'https://h/adp/old/' })] }));
  assert.equal(await run(['add', 'com.tsg0o0.cse', '--from-adp', 'https://h/adp/x/manifest.json', '--release', 'https://github.com/o/r/releases/download/v4.19'], c), 0, c.out.text);
  const a = await read(c, 'com.tsg0o0.cse');
  assert.equal(a.versions[0].version, '4.19');
  assert.equal(a.versions[0].assetURLs.manifest, 'https://github.com/o/r/releases/download/v4.19/manifest.json');
  assert.equal(await run(['add', 'com.missing', '--from-adp', 'https://h/adp/x/'], c), 1);
  assert.match(c.out.text, /apps\/com\.missing\.json does not exist/);
  assert.equal(await run(['add', 'com.tsg0o0.cse'], c), 1);
  assert.match(c.out.text, /one of --from-github/);
});
