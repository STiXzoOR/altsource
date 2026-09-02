import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run as sync } from '../../src/cli/sync.mjs';
import { run as checkLinks } from '../../src/cli/check-links.mjs';
import { run as status } from '../../src/cli/status.mjs';
import { prepare } from '../../src/cli/serve.mjs';
import { writeApp } from '../../src/lib/content.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const out = () => ({ text: '', write(s) { this.text += s; } });
async function ctx() {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE, iconURL: 'assets/icon.png' }, 'assets/icon.png': 'png:2x2', 'public/index.html': 'x' });
  await writeApp(dir, app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'github', repo: 'o/r' } }));
  const o = out();
  const fetch = makeFetch({ ...routes, 'https://dev.example/icon.png': { status: 200 }, 'https://dev.example/s1.png': { status: 404 }, [`${BASE}assets/icon.png`]: { status: 200 } });
  return { cwd: dir, stdout: o, stderr: o, fetch, out: o };
}

test('sync --dry-run reports without writing; sync writes and prints markdown/json', async () => {
  const c = await ctx();
  assert.equal(await sync(['--dry-run'], c), 0);
  assert.match(c.out.text, /added\s+com\.example\.demo\s+1\.2\.3 → 1\.3\.0/);
  assert.match(c.out.text, /1 app\(s\) changed \(dry run/);
  c.out.text = '';
  assert.equal(await sync(['--markdown'], c), 0);
  assert.match(c.out.text, /## Sync\n\n\| App \| Action/);
  assert.equal(JSON.parse(await readFile(`${c.cwd}/apps/com.example.demo.json`, 'utf8')).versions[0].version, '1.3.0');
  c.out.text = '';
  assert.equal(await sync(['--json'], c), 0);
  assert.deepEqual(JSON.parse(c.out.text).changed, []);
});

test('check-links lists broken URLs, exits 1 unless --write, and writes state', async () => {
  const c = await ctx();
  assert.equal(await checkLinks([], c), 1);
  assert.match(c.out.text, /https:\/\/dev\.example\/s1\.png .*404/);
  c.out.text = '';
  assert.equal(await checkLinks(['--write', '--markdown'], c), 0);
  const state = JSON.parse(await readFile(`${c.cwd}/state/link-check.json`, 'utf8'));
  assert.equal(state.broken.length, 1);
  assert.match(c.out.text, /## Link check/);
});

test('status prints the table, --write writes status.json, prepare() writes it offline for serve', async () => {
  const c = await ctx();
  assert.equal(await status(['--write', '--out', 'dist'], c), 0);
  assert.match(c.out.text, /behind\s+com\.example\.demo/);
  const s = JSON.parse(await readFile(`${c.cwd}/dist/status.json`, 'utf8'));
  assert.equal(s.apps[0].upstream.state, 'behind');
  c.out.text = '';
  assert.equal(await status(['--json', '--offline'], c), 0);
  assert.equal(JSON.parse(c.out.text).apps[0].upstream.state, 'unknown');
  const calls = [];
  await prepare({ cwd: c.cwd, outDir: `${c.cwd}/dist`, exec: async (cmd, args, opts) => { calls.push({ cmd, args, env: opts.env }); } });
  const local = JSON.parse(await readFile(`${c.cwd}/dist/status.json`, 'utf8'));
  assert.equal(local.apps[0].upstream.state, 'unknown');
  assert.ok((await readFile(`${c.cwd}/.altsource/source.json`, 'utf8')).includes('com.example.demo'), 'JSON build goes to the staging dir Astro publishes');
  assert.match(calls[0].cmd, /node_modules\/\.bin\/astro$/);
  assert.deepEqual(calls[0].args, ['build']);
  assert.deepEqual([calls[0].env.ALTSOURCE_ROOT, calls[0].env.ALTSOURCE_PUBLIC, calls[0].env.ALTSOURCE_OUT], [c.cwd, `${c.cwd}/.altsource`, `${c.cwd}/dist`]);
});
