import path from 'node:path';
import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { loadContent } from './load.mjs';
import { validateContent } from './validate.mjs';
import { resolveContent } from './resolve.mjs';
import { inferKind } from './kinds.mjs';

export const OUTPUTS = {
  pal: { kind: 'adp', file: 'source.pal.json' },
  classic: { kind: 'ipa', file: 'source.json' },
};

const STRIP = {
  meta: ['$schema', 'baseURL', 'overrides'],
  app: ['$schema', 'upstream'],
  version: ['kind'],
  news: ['$schema'],
};

export const KEY_ORDER = {
  source: ['name', 'identifier', 'subtitle', 'description', 'iconURL', 'headerURL', 'website', 'fediUsername', 'patreonURL', 'tintColor', 'nsfw', 'featuredApps', 'localizedSubtitles', 'localizedDescriptions', 'apps', 'news'],
  app: ['name', 'bundleIdentifier', 'marketplaceID', 'developerName', 'subtitle', 'localizedDescription', 'iconURL', 'tintColor', 'category', 'screenshots', 'versions', 'appPermissions', 'patreon', 'localizedSubtitles', 'localizedDescriptions'],
  version: ['version', 'buildVersion', 'marketingVersion', 'date', 'localizedDescription', 'downloadURL', 'size', 'sha256', 'assetURLs', 'minOSVersion', 'maxOSVersion', 'localizedDescriptions'],
  news: ['title', 'identifier', 'caption', 'date', 'tintColor', 'imageURL', 'notify', 'url', 'appID'],
};

/** Known keys first in the given order, remaining keys alphabetically → deterministic JSON. */
export function orderKeys(obj, order) {
  const out = {};
  for (const key of order) if (key in obj) out[key] = obj[key];
  for (const key of Object.keys(obj).sort()) if (!(key in out)) out[key] = obj[key];
  return out;
}

function omit(obj, keys) {
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
}

/** The AltStore source object for one output ('pal' | 'classic') from resolved content. */
export function buildOutput(content, outputName) {
  const { kind } = OUTPUTS[outputName];
  const apps = [];
  for (const a of content.apps) {
    const versions = (a.data.versions ?? [])
      .filter((v) => inferKind(v) === kind)
      .map((v) => orderKeys(omit(v, STRIP.version), KEY_ORDER.version));
    if (versions.length === 0) continue;
    apps.push(orderKeys({ ...omit(a.data, STRIP.app), versions }, KEY_ORDER.app));
  }
  apps.sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }));
  const present = new Set(apps.map((a) => a.bundleIdentifier));
  const meta = { ...omit(content.meta, STRIP.meta), ...(content.meta.overrides?.[outputName] ?? {}) };
  if (Array.isArray(meta.featuredApps)) meta.featuredApps = meta.featuredApps.filter((id) => present.has(id));
  const news = content.news
    .map((n) => orderKeys(omit(n.data, STRIP.news), KEY_ORDER.news))
    .filter((n) => n.appID === undefined || present.has(n.appID));
  return orderKeys({ ...meta, apps, news }, KEY_ORDER.source);
}

export class BuildError extends Error {
  constructor(issues) {
    super(`validation failed with ${issues.errors.length} error(s)`);
    this.name = 'BuildError';
    this.issues = issues;
  }
}

/** Validate, then write both sources, assets/, public/ and .nojekyll into outDir. */
export async function buildAll({ rootDir, outDir }) {
  const root = path.resolve(rootDir);
  const out = path.resolve(outDir);
  if (out === root || root.startsWith(out + path.sep)) throw new Error(`refusing to build into outDir ${out}: it contains the repo`);
  const raw = await loadContent(root);
  const issues = await validateContent(raw, { rootDir: root });
  if (issues.errors.length > 0) throw new BuildError(issues);
  const content = await resolveContent(raw, { rootDir: root });
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const outputs = {};
  for (const [name, { file }] of Object.entries(OUTPUTS)) {
    const source = buildOutput(content, name);
    await writeFile(path.join(out, file), JSON.stringify(source, null, 2) + '\n');
    outputs[name] = { file, apps: source.apps.length, news: source.news.length };
  }
  for (const [dir, dest] of [['assets', path.join(out, 'assets')], ['public', out]]) {
    try { await cp(path.join(root, dir), dest, { recursive: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  await writeFile(path.join(out, '.nojekyll'), '');
  return { outputs, warnings: issues.warnings };
}
