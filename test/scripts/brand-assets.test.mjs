import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateBrandAssets } from '../../scripts/make-brand-assets.mjs';
import { pngSize } from '../helpers/png.mjs';

const outDir = await mkdtemp(path.join(tmpdir(), 'altsource-brand-'));
const written = await generateBrandAssets({ outDir });
const read = (f) => readFile(path.join(outDir, f));

test('writes the SVG masters and the two PNGs AltStore needs, and reports them', () => {
  assert.deepEqual(written.map((f) => path.basename(f)).sort(), ['header.png', 'header.svg', 'icon.png', 'logo.svg', 'wordmark.svg']);
});

test('icon.png is 1024 square and header.png is 1200×800', async () => {
  assert.deepEqual(pngSize(await read('icon.png')), { width: 1024, height: 1024 });
  assert.deepEqual(pngSize(await read('header.png')), { width: 1200, height: 800 });
});

test('the header outlines every word to paths, so no font is needed to render it', async () => {
  const svg = (await read('header.svg')).toString();
  assert.doesNotMatch(svg, /<text|font-family/);
  assert.ok((svg.match(/<path d="M[^"]{200,}"/g) ?? []).length >= 3, 'wordmark, Apps and tagline are real outlines');
});

test('wordmark.svg is a tight, colourable "STiX"', async () => {
  const svg = (await read('wordmark.svg')).toString();
  assert.match(svg, /viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/);
  assert.match(svg, /fill="currentColor"/);
  assert.match(svg, /aria-label="STiX"/);
});

test('the PNGs are encoded small enough to serve as favicon and link preview', async () => {
  assert.ok((await read('icon.png')).length < 160_000, 'icon.png under 160 KB');
  assert.ok((await read('header.png')).length < 160_000, 'header.png under 160 KB');
});
