import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAbsoluteURL, isAbsoluteHttps, resolveURL, mapURLs } from '../../src/lib/urls.mjs';

const BASE = 'https://stixzoor.github.io/altsource/';

test('isAbsoluteURL', () => {
  assert.equal(isAbsoluteURL('https://a.b/c'), true);
  assert.equal(isAbsoluteURL('http://a.b/c'), true);
  assert.equal(isAbsoluteURL('assets/icon.png'), false);
  assert.equal(isAbsoluteURL(42), false);
});

test('isAbsoluteHttps accepts only https', () => {
  assert.equal(isAbsoluteHttps('https://a.b/c'), true);
  assert.equal(isAbsoluteHttps('http://a.b/c'), false);
  assert.equal(isAbsoluteHttps('assets/icon.png'), false);
});

test('resolveURL keeps absolute URLs untouched', () => {
  assert.equal(resolveURL('https://dev.example/x.ipa', BASE), 'https://dev.example/x.ipa');
});

test('resolveURL resolves relative and ./ paths against baseURL', () => {
  assert.equal(resolveURL('assets/icon.png', BASE), `${BASE}assets/icon.png`);
  assert.equal(resolveURL('./assets/icon.png', BASE), `${BASE}assets/icon.png`);
});

test('mapURLs visits URL keys, screenshots, device arrays and assetURLs with JSON-pointer paths', () => {
  const input = {
    name: 'x',
    iconURL: 'a.png',
    screenshots: { iphone: ['s1.png', { imageURL: 's2.png', width: 1, height: 2 }], ipad: ['s3.png'] },
    versions: [{ downloadURL: 'v.ipa', assetURLs: { manifest: 'm.json' } }],
    nested: { url: 'n' },
  };
  const seen = [];
  const out = mapURLs(input, (v, p) => { seen.push([v, p]); return `R:${v}`; });
  assert.deepEqual(seen, [
    ['a.png', '/iconURL'],
    ['s1.png', '/screenshots/iphone/0'],
    ['s2.png', '/screenshots/iphone/1/imageURL'],
    ['s3.png', '/screenshots/ipad/0'],
    ['v.ipa', '/versions/0/downloadURL'],
    ['m.json', '/versions/0/assetURLs/manifest'],
    ['n', '/nested/url'],
  ]);
  assert.equal(out.iconURL, 'R:a.png');
  assert.equal(out.screenshots.iphone[1].width, 1);
  assert.equal(input.iconURL, 'a.png', 'input must not be mutated');
});

test('mapURLs handles plain screenshot arrays', () => {
  const out = mapURLs({ screenshots: ['a', { imageURL: 'b' }] }, (v) => v.toUpperCase());
  assert.deepEqual(out.screenshots, ['A', { imageURL: 'B' }]);
});
