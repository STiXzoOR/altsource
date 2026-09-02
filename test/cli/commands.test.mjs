import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { run as validate } from '../../src/cli/validate.mjs';
import { app, news, version, root, BASE } from '../helpers/content.mjs';

const BIN = path.resolve('bin/altsource.mjs');
const cli = (cwd, ...args) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });

const valid = () => root({
  'source.meta.json': { name: 'S', baseURL: BASE, iconURL: 'assets/icon.png' },
  'apps/com.ipa.json': app('com.ipa', { versions: [version({ downloadURL: 'https://dev.example/a.ipa' })] }),
  'news/welcome.json': news('welcome'),
  'assets/icon.png': 'png:2x2',
});

test('validate exits 0 and prints the summary for a valid tree', async () => {
  const r = cli(await valid(), 'validate');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0 error\(s\)/);
});

test('validate exits 1 and lists codes for an invalid tree; --json emits issues', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE }, 'apps/com.x.json': app('com.y') });
  const r = cli(dir, 'validate');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /✖ E02 apps\/com\.x\.json#\/bundleIdentifier/);
  const j = cli(dir, 'validate', '--json');
  assert.equal(JSON.parse(j.stdout).errors[0].code, 'E02');
});

test('validate reports unreadable input as an error', async () => {
  const r = cli(await root({}), 'validate');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /source\.meta\.json/);
});

test('validate --check-urls turns broken links into E19, --check-urls-warn into W08', async () => {
  const dir = await valid();
  const out = { text: '', write(s) { this.text += s; } };
  const fetch = async (url) => ({ status: url.endsWith('.ipa') ? 404 : 200 });
  const code = await validate(['--check-urls'], { cwd: dir, stdout: out, stderr: out, fetch });
  assert.equal(code, 1);
  assert.match(out.text, /E19 classic#\/apps\/0\/versions\/0\/downloadURL/);
  out.text = '';
  const soft = await validate(['--check-urls-warn'], { cwd: dir, stdout: out, stderr: out, fetch });
  assert.equal(soft, 0);
  assert.match(out.text, /W08/);
});

test('build writes dist and prints counts; invalid tree exits 1', async () => {
  const dir = await valid();
  const r = cli(dir, 'build');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /classic\s+source\.json: 1 app\(s\), 1 news item\(s\)/);
  assert.ok((await readdir(path.join(dir, 'dist'))).includes('source.pal.json'));
  const bad = cli(await root({ 'source.meta.json': { name: 'S', baseURL: BASE }, 'apps/com.x.json': app('com.y') }), 'build');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /E02/);
});
