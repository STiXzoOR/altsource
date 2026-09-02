import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run } from '../../src/cli/news.mjs';
import { root, BASE } from '../helpers/content.mjs';

const out = () => ({ text: '', write(s) { this.text += s; } });
const ctx = async () => { const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } }); const o = out(); return { cwd: dir, stdout: o, stderr: o, out: o }; };

test('news add writes a file named after the id (slug of the title by default)', async () => {
  const c = await ctx();
  assert.equal(await run(['add', '--title', 'Nuvio 0.4.18 released!', '--caption', 'Faster', '--app', 'com.x', '--notify', '--url', 'https://x', '--date', '2026-09-02'], c), 0, c.out.text);
  const n = JSON.parse(await readFile(`${c.cwd}/news/nuvio-0-4-18-released.json`, 'utf8'));
  assert.deepEqual(n, { $schema: '../schema/news.schema.json', title: 'Nuvio 0.4.18 released!', identifier: 'nuvio-0-4-18-released', caption: 'Faster', date: '2026-09-02', notify: true, url: 'https://x', appID: 'com.x' });
  assert.match(c.out.text, /added news\/nuvio-0-4-18-released\.json/);
  assert.equal(await run(['add', '--title', 'Nuvio 0.4.18 released!', '--caption', 'x'], c), 1);
  assert.match(c.out.text, /already exists/);
  assert.equal(await run(['add', '--id', 'custom', '--title', 'T', '--caption', 'C', '--tint', '#123456', '--image', 'https://x/i.png'], c), 0, c.out.text);
  const m = JSON.parse(await readFile(`${c.cwd}/news/custom.json`, 'utf8'));
  assert.equal(m.tintColor, '#123456');
  assert.match(m.date, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(await run(['add', '--caption', 'no title'], c), 1);
});
