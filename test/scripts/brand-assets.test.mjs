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
  assert.deepEqual(written.map((f) => path.basename(f)).sort(), ['apple-touch-icon.png', 'header.png', 'header.svg', 'icon.png', 'logo.svg', 'wordmark.svg']);
});

test('icon.png is 1024 square and header.png is 1200×800', async () => {
  const dims = (buf) => { const { width, height } = pngSize(buf); return { width, height }; };
  assert.deepEqual(dims(await read('icon.png')), { width: 1024, height: 1024 });
  assert.deepEqual(dims(await read('header.png')), { width: 1200, height: 800 });
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

test('apple-touch-icon.png is 180 square and opaque, as iOS wants it', async () => {
  const { width, height, colorType } = pngSize(await read('apple-touch-icon.png'));
  assert.deepEqual({ width, height }, { width: 180, height: 180 });
  assert.equal(colorType, 2, 'RGB without alpha');
});
