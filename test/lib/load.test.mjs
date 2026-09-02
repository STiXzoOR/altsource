import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadContent, LoadError } from '../../src/lib/load.mjs';

async function scaffold(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'altsource-load-'));
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

test('loads meta, apps and news in sorted order with file names', async () => {
  const dir = await scaffold({
    'source.meta.json': { name: 'S', baseURL: 'https://x/' },
    'apps/com.b.json': { name: 'B' },
    'apps/com.a.json': { name: 'A' },
    'apps/notes.txt': 'ignored',
    'news/welcome.json': { title: 'Hi' },
  });
  const c = await loadContent(dir);
  assert.equal(c.meta.name, 'S');
  assert.deepEqual(c.apps.map((a) => a.name), ['com.a', 'com.b']);
  assert.equal(c.apps[0].file, 'apps/com.a.json');
  assert.equal(c.apps[0].data.name, 'A');
  assert.deepEqual(c.news, [{ file: 'news/welcome.json', name: 'welcome', data: { title: 'Hi' } }]);
});

test('missing apps/ and news/ directories yield empty arrays', async () => {
  const dir = await scaffold({ 'source.meta.json': { name: 'S' } });
  const c = await loadContent(dir);
  assert.deepEqual(c.apps, []);
  assert.deepEqual(c.news, []);
});

test('missing source.meta.json throws LoadError naming the file', async () => {
  const dir = await scaffold({});
  await assert.rejects(loadContent(dir), (e) => e instanceof LoadError && e.file === 'source.meta.json');
});

test('invalid JSON throws LoadError naming the file', async () => {
  const dir = await scaffold({ 'source.meta.json': { name: 'S' }, 'apps/com.x.json': '{ not json' });
  await assert.rejects(loadContent(dir), (e) => e instanceof LoadError && e.file === 'apps/com.x.json' && /invalid JSON/.test(e.message));
});
