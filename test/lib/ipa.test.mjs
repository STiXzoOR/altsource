import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { inspectIPA, entitlementsFromMachO, versionFromIPA } from '../../src/lib/ipa.mjs';
import { makeIPA, machO } from '../helpers/ipa.mjs';

test('inspectIPA reads identity, privacy strings, entitlements from app + extensions, size and sha256', () => {
  const ipa = makeIPA({
    entitlements: { 'com.apple.security.application-groups': ['group.x'], 'aps-environment': 'production' },
    plugins: [{ name: 'Widget', entitlements: { 'com.apple.security.application-groups': ['group.x'], 'com.apple.developer.siri': true } }],
  });
  const r = inspectIPA(ipa);
  assert.equal(r.bundleIdentifier, 'com.example.demo');
  assert.equal(r.name, 'Demo App');
  assert.equal(r.version, '1.2.3');
  assert.equal(r.buildVersion, '45');
  assert.equal(r.minOSVersion, '16.0');
  assert.deepEqual(r.privacy, { NSCameraUsageDescription: 'Takes photos', NSMicrophoneUsageDescription: 'Records audio & video' });
  assert.deepEqual(r.entitlements, ['aps-environment', 'com.apple.developer.siri', 'com.apple.security.application-groups', 'get-task-allow']);
  assert.equal(r.size, ipa.length);
  assert.equal(r.sha256, createHash('sha256').update(ipa).digest('hex'));
});

test('fat binaries dedupe and implicit entitlements are dropped', () => {
  assert.deepEqual(entitlementsFromMachO(machO({ 'application-identifier': 'x', a: 1 }, { fat: true })).sort(), ['a', 'application-identifier']);
  const r = inspectIPA(makeIPA({ fat: true, entitlements: { 'keychain-access-groups': ['x'] } }));
  assert.deepEqual(r.entitlements, ['get-task-allow', 'keychain-access-groups']);
});

test('name falls back to CFBundleName then the .app folder; binary Info.plist works', async () => {
  const r = inspectIPA(makeIPA({ appName: 'Bare', info: { CFBundleDisplayName: undefined } }));
  assert.equal(r.name, 'Bare');
});

test('inspectIPA rejects zips without an app Info.plist', () => {
  const zip = Buffer.from(zipSync({ 'README.md': new Uint8Array([1]) }));
  assert.throws(() => inspectIPA(zip), /not an IPA/);
});

test('versionFromIPA builds an entry and omits undefined', () => {
  const info = inspectIPA(makeIPA());
  const v = versionFromIPA(info, { downloadURL: 'https://x/a.ipa', date: '2026-09-02', size: 999 });
  assert.deepEqual(Object.keys(v), ['version', 'buildVersion', 'date', 'downloadURL', 'size', 'sha256', 'minOSVersion']);
  assert.equal(v.size, 999);
  assert.equal(versionFromIPA(info, { downloadURL: 'https://x/a.ipa', date: 'd', notes: 'n' }).localizedDescription, 'n');
});
