import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navItems, isCurrent } from '../../site/src/lib/nav.mjs';
import { STORES, storesFor } from '../../site/src/lib/stores.mjs';

const base = '/altsource/';

test('navItems are Home, Apps, News, Status under the base path with a Hugeicon each', () => {
  assert.deepEqual(navItems(base).map((i) => [i.label, i.href]), [['Home', '/altsource/'], ['Apps', '/altsource/apps/'], ['News', '/altsource/news/'], ['Status', '/altsource/status/']]);
  for (const i of navItems(base)) assert.match(i.icon, /Icon$/);
});

test('isCurrent matches Home exactly and sections by prefix, with or without a trailing slash', () => {
  assert.equal(isCurrent('/altsource/', base, base), true);
  assert.equal(isCurrent('/altsource/apps/', base, base), false);
  assert.equal(isCurrent('/altsource/apps/', `${base}apps/`, base), true);
  assert.equal(isCurrent('/altsource/apps/com.x', `${base}apps/`, base), true);
  assert.equal(isCurrent('/altsource/news/', `${base}apps/`, base), false);
});

test('storesFor maps version kinds to the stores that can install them', () => {
  assert.equal(storesFor(['adp']), 'pal');
  assert.equal(storesFor(['ipa']), 'classic sidestore');
  assert.equal(storesFor(['adp', 'ipa']), 'pal classic sidestore');
  assert.equal(STORES[0].id, 'all');
});
