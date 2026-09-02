import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../../src/lib/validate.mjs';
import { content, app, version, root, codes, errorCodes } from '../helpers/content.mjs';

const run = async (c, files) => validateContent(c, { rootDir: await root(files) });
const adp = (over = {}) => version({ downloadURL: 'https://dev.example/app/adp/abc/', ...over });

test('E11 empty versions and duplicate version/build pairs', async () => {
  const r1 = await run(content({ apps: [app('com.x', { versions: [] })] }));
  assert.deepEqual(errorCodes(r1), ['E11']);
  const r2 = await run(content({ apps: [app('com.x', { versions: [version(), version({ date: '2026-08-01' })] })] }));
  assert.deepEqual(errorCodes(r2), ['E11']);
  const r3 = await run(content({ apps: [app('com.x', { versions: [version({ buildVersion: undefined }), version({ buildVersion: undefined, date: '2026-08-01' })] })] }));
  assert.deepEqual(errorCodes(r3), ['E11'], 'missing buildVersion counts as the same build');
  const both = await run(content({ apps: [app('com.x', { marketplaceID: '1', versions: [adp(), version()] })] }));
  assert.deepEqual(both.errors, [], 'the same release as ADP and IPA is allowed');
});

test('E12 size must be a positive integer', async () => {
  const r = await run(content({ apps: [app('com.x', { versions: [version({ size: 0 })] })] }));
  assert.deepEqual(errorCodes(r), ['E12']);
});

test('E14 unknown kind', async () => {
  const r = await run(content({ apps: [app('com.x', { versions: [version({ downloadURL: 'https://dev.example/download?id=1' })] })] }));
  assert.deepEqual(errorCodes(r), ['E14']);
});

test('E17 OS versions, W04 maxOSVersion', async () => {
  const r = await run(content({ apps: [app('com.x', { versions: [version({ minOSVersion: 'iOS 16', maxOSVersion: '18.0' })] })] }));
  assert.deepEqual(errorCodes(r), ['E17']);
  assert.ok(codes(r).includes('W04'));
});

test('E18 ADP versions require marketplaceID', async () => {
  const r = await run(content({ apps: [app('com.x', { versions: [adp()] })] }));
  assert.deepEqual(errorCodes(r), ['E18']);
  const ok = await run(content({ apps: [app('com.x', { marketplaceID: '6445840140', versions: [adp()] })] }));
  assert.deepEqual(ok.errors, []);
});

test('E13 iPad screenshots need dimensions unless a local PNG provides them', async () => {
  const shots = { iphone: ['https://dev.example/1.png'], ipad: ['https://dev.example/2.png', { imageURL: 'https://dev.example/3.png', width: 1668, height: 2388 }, 'assets/apps/com.x/ipad.png'] };
  const r = await run(content({ apps: [app('com.x', { screenshots: shots })] }), { 'assets/apps/com.x/ipad.png': 'png:1668x2388' });
  assert.deepEqual(errorCodes(r), ['E13']);
  assert.equal(r.errors[0].path, 'apps/com.x.json#/screenshots/ipad/0');
});

test('W03 versions out of date order', async () => {
  const r = await run(content({ apps: [app('com.x', { versions: [version({ version: '1.0', date: '2026-01-01' }), version({ version: '1.1', date: '2026-02-01' })] })] }));
  assert.deepEqual(r.errors, []);
  assert.ok(codes(r).includes('W03'));
});

test('W05 recommended fields', async () => {
  const r = await run(content({ apps: [app('com.x', { subtitle: undefined, screenshots: [], versions: [version({ minOSVersion: undefined, localizedDescription: undefined })] })] }));
  assert.deepEqual(r.errors, []);
  assert.equal(codes(r).filter((c) => c === 'W05').length, 4);
});

test('W07 missing permissions warns; E15 malformed permissions errors', async () => {
  const w = await run(content({ apps: [app('com.x', { appPermissions: undefined })] }));
  assert.deepEqual(w.errors, []);
  assert.ok(codes(w).includes('W07'));
  const e1 = await run(content({ apps: [app('com.x', { appPermissions: { entitlements: 'nope', privacy: {} } })] }));
  assert.deepEqual(errorCodes(e1), ['E15']);
  const e2 = await run(content({ apps: [app('com.x', { appPermissions: { entitlements: [] } })] }));
  assert.deepEqual(errorCodes(e2), ['E15'], 'privacy is required when appPermissions is present');
});
