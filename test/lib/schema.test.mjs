import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getValidators, formatAjvError } from '../../src/lib/schema.mjs';

const v = getValidators();
const errs = (fn, data) => (fn(data) ? [] : fn.errors.map(formatAjvError));

const goodVersion = { version: '1.0', buildVersion: '1', date: '2026-09-02', downloadURL: 'https://x/a.ipa', size: 10 };
const goodApp = {
  name: 'A', bundleIdentifier: 'com.a', developerName: 'D', localizedDescription: 'desc',
  iconURL: 'https://x/i.png', versions: [goodVersion], appPermissions: { entitlements: [], privacy: {} },
};

test('meta requires name and baseURL', () => {
  assert.deepEqual(errs(v.meta, { name: 'S', baseURL: 'https://x/' }), []);
  assert.match(errs(v.meta, { name: 'S' }).join('\n'), /baseURL/);
  assert.match(errs(v.meta, { baseURL: 'https://x/', name: 5 }).join('\n'), /\/name: must be string/);
});

test('app requires the documented keys and validates nested versions', () => {
  assert.deepEqual(errs(v.app, goodApp), []);
  const missing = errs(v.app, { ...goodApp, developerName: undefined });
  assert.match(missing.join('\n'), /developerName/);
  const badVersion = errs(v.app, { ...goodApp, versions: [{ ...goodVersion, size: -1 }] });
  assert.match(badVersion.join('\n'), /\/versions\/0\/size/);
  assert.match(errs(v.app, { ...goodApp, versions: [] }).join('\n'), /versions.*fewer than 1/);
});

test('app category is an enum and kind is adp|ipa', () => {
  assert.match(errs(v.app, { ...goodApp, category: 'music' }).join('\n'), /category.*allowed: developer, entertainment, games, lifestyle, other, photo-video, social, utilities/);
  assert.match(errs(v.app, { ...goodApp, versions: [{ ...goodVersion, kind: 'zip' }] }).join('\n'), /kind/);
});

test('screenshots accept strings, objects, and iphone/ipad groups', () => {
  assert.deepEqual(errs(v.app, { ...goodApp, screenshots: ['https://x/1.png', { imageURL: 'https://x/2.png', width: 1, height: 2 }] }), []);
  assert.deepEqual(errs(v.app, { ...goodApp, screenshots: { iphone: ['https://x/1.png'], ipad: [{ imageURL: 'https://x/2.png', width: 1, height: 2 }] } }), []);
  assert.notDeepEqual(errs(v.app, { ...goodApp, screenshots: [{ width: 1 }] }), []);
});

test('upstream requires url for altstore/adp and repo for github', () => {
  assert.deepEqual(errs(v.app, { ...goodApp, upstream: { type: 'altstore', url: 'https://x/s.json' } }), []);
  assert.deepEqual(errs(v.app, { ...goodApp, upstream: { type: 'github', repo: 'o/r' } }), []);
  assert.match(errs(v.app, { ...goodApp, upstream: { type: 'github' } }).join('\n'), /upstream.*repo/);
  assert.match(errs(v.app, { ...goodApp, upstream: { type: 'adp' } }).join('\n'), /upstream.*url/);
  assert.match(errs(v.app, { ...goodApp, upstream: { type: 'ftp', url: 'x' } }).join('\n'), /upstream\/type/);
});

test('news requires title, identifier, caption, date', () => {
  assert.deepEqual(errs(v.news, { title: 't', identifier: 'i', caption: 'c', date: '2026-01-01' }), []);
  assert.match(errs(v.news, { title: 't' }).join('\n'), /identifier/);
});

test('unknown keys are allowed by the schemas', () => {
  assert.deepEqual(errs(v.app, { ...goodApp, iconUrl: 'typo', $schema: 'x' }), []);
});

test('source schema validates a built output', () => {
  assert.deepEqual(errs(v.source, { name: 'S', apps: [goodApp], news: [] }), []);
  assert.match(errs(v.source, { name: 'S', apps: [{}], news: [] }).join('\n'), /apps\/0/);
});
