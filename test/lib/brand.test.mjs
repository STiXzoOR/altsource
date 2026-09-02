import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconSVG, wordmarkSVG, headerSVG } from '../../src/lib/brand.mjs';

test('iconSVG is a self-contained 1024 square: woven gap mask, glow, chamfered sticks, no text or remote refs', () => {
  const svg = iconSVG();
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1024 1024"/);
  assert.match(svg, /<mask id="b-gap"/, 'the under stick is cut where the over stick crosses');
  assert.match(svg, /feGaussianBlur/, 'the sticks glow on the dark tile');
  assert.doesNotMatch(svg, /stroke-linecap="round"/, 'sticks are chamfered polygons, not round-capped lines');
  assert.doesNotMatch(svg, /<text|href="http|url\(http/);
  assert.ok((svg.match(/<path /g) ?? []).length >= 2, 'two sticks');
});

test('iconSVG takes an id prefix so the icon can be embedded next to itself', () => {
  const svg = iconSVG({ idPrefix: 'x' });
  assert.match(svg, /id="x-gap"/);
  assert.doesNotMatch(svg, /id="b-/);
  assert.equal(new Set(svg.match(/id="[^"]+"/g)).size, svg.match(/id="[^"]+"/g).length, 'ids are unique');
});

test('wordmarkSVG wraps outlined text in currentColor with a tight viewBox', () => {
  const svg = wordmarkSVG({ d: 'M0 0H10V10Z', width: 100, height: 40 });
  assert.match(svg, /viewBox="0 0 100 40"/);
  assert.match(svg, /fill="currentColor"/);
  assert.match(svg, /d="M0 0H10V10Z"/);
  assert.match(svg, /role="img" aria-label="STiX"/);
});

test('headerSVG is 1200×800, embeds the icon under its own ids and never uses live text', () => {
  const svg = headerSVG({ wordmark: 'M0 0Z', apps: 'M1 1Z', tagline: 'M2 2Z' });
  assert.match(svg, /viewBox="0 0 1200 800"/);
  assert.match(svg, /width="1200" height="800"/);
  assert.doesNotMatch(svg, /<text/);
  for (const d of ['M0 0Z', 'M1 1Z', 'M2 2Z']) assert.ok(svg.includes(`d="${d}"`), `${d} embedded`);
  assert.match(svg, /id="hdr-gap"/, 'embedded icon ids are prefixed');
  assert.match(svg, /<clipPath id="hdr-tile"/, 'the tile has rounded corners');
});
