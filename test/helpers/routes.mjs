import { readFile } from 'node:fs/promises';
import { makeIPA } from './ipa.mjs';
import { version } from './content.mjs';

export const ipa18 = makeIPA();
const ipa19 = makeIPA({ info: { CFBundleShortVersionString: '1.3.0', CFBundleVersion: '50' }, entitlements: { 'com.apple.developer.siri': true } });
const manifest = JSON.parse(await readFile('test/fixtures/adp-manifest.json', 'utf8'));
const releases = [
  { tag_name: 'v1.9', prerelease: false, draft: false, body: 'newer', published_at: '2026-09-02T00:00:00Z', assets: [{ name: 'App-1.9.ipa', size: ipa19.length, browser_download_url: 'https://gh/d/App-1.9.ipa' }] },
  { tag_name: 'v1.8', prerelease: false, draft: false, body: 'Release notes', published_at: '2026-08-01T00:00:00Z', assets: [{ name: 'App-1.8.ipa', size: 61310926, browser_download_url: 'https://gh/d/App-1.8.ipa' }] },
];
export const routes = {
  'https://api.github.com/repos/o/r/releases?per_page=30': { json: releases },
  'https://api.github.com/repos/o/r/releases/tags/v1.8': { json: releases[1] },
  'https://api.github.com/repos/o/r': { json: { description: 'Repo description', owner: { login: 'o' }, html_url: 'https://github.com/o/r' } },
  'https://gh/d/App-1.8.ipa': { bytes: ipa18 },
  'https://gh/d/App-1.9.ipa': { bytes: ipa19 },
  'https://s/source.json': { json: { name: 'S', apps: [{ bundleIdentifier: 'com.example.demo', name: 'Up', developerName: 'U', localizedDescription: 'd', iconURL: 'https://s/i.png', versions: [version({ downloadURL: 'https://gh/d/App-1.8.ipa' })] }] } },
  'https://h/adp/x/manifest.json': { json: manifest, headers: { 'last-modified': 'Wed, 10 Jun 2026 07:00:00 GMT' } },
};
