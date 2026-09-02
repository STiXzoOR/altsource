import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodePNG } from '../../src/lib/png.mjs';

export const BASE = 'https://stixzoor.github.io/altsource/';

export function version(over = {}) {
  return { version: '1.0', buildVersion: '1', date: '2026-09-01', downloadURL: 'https://dev.example/app-1.0.ipa', size: 1234, minOSVersion: '16.0', localizedDescription: 'notes', ...over };
}

export function app(id = 'com.example.app', over = {}) {
  return {
    name: 'Example', bundleIdentifier: id, developerName: 'Dev', subtitle: 'sub', localizedDescription: 'desc',
    iconURL: 'https://dev.example/icon.png', category: 'utilities', screenshots: ['https://dev.example/s1.png'],
    versions: [version()], appPermissions: { entitlements: [], privacy: {} }, ...over,
  };
}

export function news(id = 'welcome', over = {}) {
  return { title: 'Welcome', identifier: id, caption: 'hi', date: '2026-09-02', ...over };
}

/** Build the loadContent() shape from plain objects. File names default to the identifiers. */
export function content({ meta = {}, apps = [], news: items = [] } = {}) {
  return {
    meta: { name: 'STiX Apps', baseURL: BASE, ...meta },
    apps: apps.map((a) => ({ file: `apps/${a.__file ?? a.bundleIdentifier}.json`, name: a.__file ?? a.bundleIdentifier, data: strip(a) })),
    news: items.map((n) => ({ file: `news/${n.__file ?? n.identifier}.json`, name: n.__file ?? n.identifier, data: strip(n) })),
  };
}
function strip(o) { const { __file, ...rest } = o; return rest; }

/** Temp repo root with the given files. Values: Buffer | string | object (JSON). 'png:WxH' makes a PNG. */
export async function root(files = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'altsource-'));
  for (const [rel, value] of Object.entries(files)) {
    const full = path.join(dir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    let data = value;
    if (typeof value === 'string' && value.startsWith('png:')) {
      const [w, h] = value.slice(4).split('x').map(Number);
      data = encodePNG(w, h, () => [40, 90, 200]);
    } else if (!Buffer.isBuffer(value) && typeof value !== 'string') data = JSON.stringify(value, null, 2);
    await writeFile(full, data);
  }
  return dir;
}

export const codes = (r) => [...r.errors, ...r.warnings].map((i) => i.code).sort();
export const errorCodes = (r) => r.errors.map((i) => i.code).sort();
