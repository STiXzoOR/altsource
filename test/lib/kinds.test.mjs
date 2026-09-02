import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferKind } from '../../src/lib/kinds.mjs';

test('explicit kind wins', () => {
  assert.equal(inferKind({ kind: 'ipa', downloadURL: 'https://x/adp/manifest.json' }), 'ipa');
  assert.equal(inferKind({ kind: 'adp', downloadURL: 'https://x/a.ipa' }), 'adp');
});

test('assetURLs implies adp', () => {
  assert.equal(inferKind({ downloadURL: 'https://x/whatever', assetURLs: { manifest: 'https://x/m' } }), 'adp');
});

test('manifest.json or trailing slash implies adp', () => {
  assert.equal(inferKind({ downloadURL: 'https://x/app/adp/abc/manifest.json' }), 'adp');
  assert.equal(inferKind({ downloadURL: 'https://x/app/adp/abc/' }), 'adp');
});

test('.ipa implies ipa, case-insensitive, ignoring query', () => {
  assert.equal(inferKind({ downloadURL: 'https://x/releases/download/v1/App.IPA?x=1' }), 'ipa');
});

test('unknown shapes return null', () => {
  assert.equal(inferKind({ downloadURL: 'https://x/app/adp/abc' }), null);
  assert.equal(inferKind({}), null);
  assert.equal(inferKind({ downloadURL: 42 }), null);
});
