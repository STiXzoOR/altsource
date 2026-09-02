import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePNG } from '../../src/lib/png.mjs';
import { pngSize } from '../helpers/png.mjs';
import { normalizeIcon, normalizeScreenshot, assetDir, iconPath, shotPath, mergeScreenshots } from '../../src/lib/assets.mjs';

test('normalizeIcon squares, resizes to 1024 and flattens to opaque RGB', async () => {
  const icon = await normalizeIcon(encodePNG(300, 200, () => [255, 0, 0]));
  assert.equal(icon.ext, 'png');
  assert.deepEqual([icon.width, icon.height], [1024, 1024]);
  assert.deepEqual(pngSize(icon.data), { width: 1024, height: 1024, colorType: 2 });
});

test('normalizeScreenshot caps the height at 1600 keeping the aspect, never enlarges, writes JPEG', async () => {
  const tall = await normalizeScreenshot(encodePNG(400, 2000, () => [0, 255, 0]));
  assert.deepEqual([tall.width, tall.height, tall.ext], [320, 1600, 'jpg']);
  assert.deepEqual([tall.data[0], tall.data[1]], [0xff, 0xd8], 'JPEG magic');
  const small = await normalizeScreenshot(encodePNG(300, 500, () => [0, 0, 255]));
  assert.deepEqual([small.width, small.height], [300, 500]);
});

test('asset paths are repo-relative under assets/apps/<id>/', () => {
  assert.equal(assetDir('com.x'), 'assets/apps/com.x');
  assert.equal(iconPath('com.x'), 'assets/apps/com.x/icon.png');
  assert.equal(shotPath('com.x', 'iphone', 3), 'assets/apps/com.x/iphone-3.jpg');
});

test('mergeScreenshots appends per device, keeps the list form for iPhone-only, replaces only the groups given', () => {
  const s1 = { imageURL: 'assets/apps/a/iphone-1.jpg', width: 1, height: 2 };
  const s2 = { imageURL: 'assets/apps/a/iphone-2.jpg', width: 1, height: 2 };
  const p1 = { imageURL: 'assets/apps/a/ipad-1.jpg', width: 3, height: 4 };
  assert.equal(mergeScreenshots(undefined, {}), undefined);
  assert.deepEqual(mergeScreenshots(undefined, { iphone: [s1] }), [s1]);
  assert.deepEqual(mergeScreenshots(['https://old/1.png'], { iphone: [s1] }), ['https://old/1.png', s1]);
  assert.deepEqual(mergeScreenshots(['https://old/1.png'], { iphone: [s1] }, { replace: true }), [s1]);
  assert.deepEqual(mergeScreenshots([s1], { ipad: [p1] }), { iphone: [s1], ipad: [p1] });
  assert.deepEqual(mergeScreenshots({ iphone: [s1], ipad: [p1] }, { iphone: [s2] }, { replace: true }), { iphone: [s2], ipad: [p1] });
});

test('normalizeIcon falls back to JPEG when the PNG would be heavy (over 300 KB)', async () => {
  const { randomBytes } = await import('node:crypto');
  const rnd = randomBytes(1024 * 1024);
  const textured = (x, y) => { const n = rnd[y * 1024 + x] & 31; return [((x >> 2) + n) & 255, ((y >> 2) + n) & 255, (((x + y) >> 3) + n) & 255]; };
  const icon = await normalizeIcon(encodePNG(1024, 1024, textured));
  assert.equal(icon.ext, 'jpg');
  assert.deepEqual([icon.data[0], icon.data[1]], [0xff, 0xd8], 'JPEG magic');
  assert.ok(icon.data.length < 800 * 1024, `icon is ${icon.data.length} bytes`);
  assert.equal(iconPath('com.x', 'jpg'), 'assets/apps/com.x/icon.jpg');
});
