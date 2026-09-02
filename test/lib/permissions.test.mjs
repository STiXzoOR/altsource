import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensurePermissions } from '../../src/lib/permissions.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { makeIPA } from '../helpers/ipa.mjs';
import { app, version } from '../helpers/content.mjs';

test('ensurePermissions fills from the newest IPA only when missing', async () => {
  const fetch = makeFetch({ 'https://gh/d/a.ipa': { bytes: makeIPA({ entitlements: { 'aps-environment': 'production' } }) } });
  const a = app('com.example.demo', { appPermissions: undefined, versions: [version({ downloadURL: 'https://gh/d/a.ipa' })] });
  const r = await ensurePermissions(a, { cwd: '/', fetch });
  assert.deepEqual(r.app.appPermissions.entitlements, ['aps-environment', 'get-task-allow']);
  assert.match(r.note, /filled appPermissions from https:\/\/gh\/d\/a\.ipa/);
  const already = await ensurePermissions(app('com.x'), { cwd: '/', fetch });
  assert.equal(already.note, undefined);
  assert.equal(fetch.calls.length, 1);
});

test('ensurePermissions skips ADP versions and reports download failures', async () => {
  const fetch = makeFetch({});
  const adp = await ensurePermissions(app('com.x', { appPermissions: undefined, versions: [version({ downloadURL: 'https://h/adp/x/' })] }), { cwd: '/', fetch });
  assert.equal(adp.note, undefined);
  const bad = await ensurePermissions(app('com.x', { appPermissions: undefined, versions: [version({ downloadURL: 'https://gh/d/missing.ipa' })] }), { cwd: '/', fetch });
  assert.equal(bad.app.appPermissions, undefined);
  assert.match(bad.note, /could not inspect https:\/\/gh\/d\/missing\.ipa/);
});
