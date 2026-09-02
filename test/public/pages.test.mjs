import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = ['public/index.html', 'public/status/index.html'];

test('public pages link only to things a visitor can use (no GitHub Actions or workflow links)', async () => {
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /\/actions\/|workflows\//, `${file} links to GitHub Actions`);
    assert.doesNotMatch(html, /Run sync|Run link check|Publish release/, `${file} shows maintainer-only actions`);
  }
});
