import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTint, onTint, readableTint, contrast } from '../../site/src/lib/tint.mjs';

test('normalizeTint accepts #RRGGBB and RRGGBB, falls back otherwise', () => {
  assert.equal(normalizeTint('#1DB954'), '#1db954');
  assert.equal(normalizeTint('cb1633'), '#cb1633');
  assert.equal(normalizeTint(undefined), '#007aff');
  assert.equal(normalizeTint('blue', '#123456'), '#123456');
});

test('onTint picks black or white text for solid tints', () => {
  assert.equal(onTint('#ffffff'), '#000');
  assert.equal(onTint('#1db954'), '#fff');
  assert.equal(onTint('#f5a10d'), '#000');
});

test('readableTint keeps readable tints and darkens/lightens unreadable ones to 4.5:1', () => {
  assert.equal(readableTint('#0055cc', false), '#0055cc', 'already readable on white');
  assert.ok(contrast(readableTint('#ffd60a', false), '#ffffff') >= 4.5, 'yellow gets darkened for light mode');
  assert.ok(contrast(readableTint('#1a1a2e', true), '#1a191b') >= 4.5, 'near-black gets lightened for dark mode');
  assert.match(readableTint('#ffd60a', false), /^#[0-9a-f]{6}$/);
});
