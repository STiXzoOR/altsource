import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePNG } from '../../src/lib/png.mjs';
import { imageSize } from '../../src/lib/images.mjs';

test('encodePNG writes a valid signature, IHDR and decodable IDAT', () => {
  const png = encodePNG(3, 2, (x, y) => [x * 10, y * 10, 7]);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 3);
  assert.equal(png.readUInt32BE(20), 2);
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.toString('ascii', 37, 41), 'IDAT');
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  // 2 rows × (1 filter byte + 3 px × 3 channels)
  assert.deepEqual([...raw], [0, 0, 0, 7, 10, 0, 7, 20, 0, 7, 0, 0, 10, 7, 10, 10, 7, 20, 10, 7]);
});

test('imageSize reads PNG dimensions', () => {
  assert.deepEqual(imageSize(encodePNG(1179, 2556, () => [0, 0, 0])), { width: 1179, height: 2556 });
});

test('imageSize reads JPEG dimensions from SOF0', () => {
  const jpeg = Buffer.from([
    0xff, 0xd8,                   // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4 (2 bytes payload)
    0xff, 0xc0, 0x00, 0x11, 0x08, // SOF0, length 17, precision 8
    0x00, 0x20,                   // height 32
    0x00, 0x10,                   // width 16
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,                   // EOI
  ]);
  assert.deepEqual(imageSize(jpeg), { width: 16, height: 32 });
});

test('imageSize returns null for unknown data', () => {
  assert.equal(imageSize(Buffer.from('not an image')), null);
  assert.equal(imageSize(Buffer.alloc(0)), null);
});
