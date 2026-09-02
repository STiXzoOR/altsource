import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { orderKeys, KEY_ORDER } from './build.mjs';
import { inferKind } from './kinds.mjs';

const APP_ORDER = ['$schema', ...KEY_ORDER.app, 'upstream'];
const VERSION_ORDER = ['kind', ...KEY_ORDER.version];
const META_ORDER = ['$schema', 'baseURL', ...KEY_ORDER.source.filter((k) => k !== 'apps' && k !== 'news'), 'overrides'];
const NEWS_ORDER = ['$schema', ...KEY_ORDER.news];

export const today = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function slugify(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

const appPath = (rootDir, id) => path.join(rootDir, 'apps', `${id}.json`);
const newsPath = (rootDir, id) => path.join(rootDir, 'news', `${id}.json`);

async function readJSONOrNull(p) {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

async function writeJSON(p, data) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2) + '\n');
  return p;
}

async function listDir(rootDir, dir) {
  let names;
  try { names = await readdir(path.join(rootDir, dir)); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const out = [];
  for (const n of names.filter((x) => x.endsWith('.json')).sort()) {
    out.push({ id: n.slice(0, -'.json'.length), data: JSON.parse(await readFile(path.join(rootDir, dir, n), 'utf8')) });
  }
  return out;
}

export const readApp = (rootDir, id) => readJSONOrNull(appPath(rootDir, id));

export function normalizeApp(app) {
  const data = orderKeys({ $schema: '../schema/app.schema.json', ...app }, APP_ORDER);
  if (Array.isArray(data.versions)) data.versions = data.versions.map((v) => orderKeys(v, VERSION_ORDER));
  return data;
}

export const writeApp = (rootDir, app) => writeJSON(appPath(rootDir, app.bundleIdentifier), normalizeApp(app));

export async function listApps(rootDir) {
  return (await listDir(rootDir, 'apps')).map(({ id, data }) => ({ id, app: data }));
}

export const readMeta = (rootDir) => readJSONOrNull(path.join(rootDir, 'source.meta.json'));
export const writeMeta = (rootDir, meta) => writeJSON(path.join(rootDir, 'source.meta.json'), orderKeys(meta, META_ORDER));

export async function listNews(rootDir) {
  return (await listDir(rootDir, 'news')).map(({ id, data }) => ({ id, item: data }));
}
export const newsExists = async (rootDir, id) => (await readJSONOrNull(newsPath(rootDir, id))) !== null;
export const writeNews = (rootDir, item) => writeJSON(newsPath(rootDir, item.identifier), orderKeys({ $schema: '../schema/news.schema.json', ...item }, NEWS_ORDER));

export async function removeApp(rootDir, id) {
  const removed = (await readApp(rootDir, id)) !== null;
  if (removed) await unlink(appPath(rootDir, id));
  let unfeatured = false;
  const meta = await readMeta(rootDir);
  if (meta && Array.isArray(meta.featuredApps) && meta.featuredApps.includes(id)) {
    meta.featuredApps = meta.featuredApps.filter((x) => x !== id);
    await writeMeta(rootDir, meta);
    unfeatured = true;
  }
  const newsReferencing = (await listNews(rootDir)).filter((n) => n.item.appID === id).map((n) => n.id);
  return { removed, unfeatured, newsReferencing };
}

/** New app object with `version` first; a duplicate (kind, version, build) throws unless force replaces it. */
export function prependVersion(app, version, { force = false } = {}) {
  const key = (v) => `${inferKind(v)}|${v.version}|${v.buildVersion ?? ''}`;
  const versions = Array.isArray(app.versions) ? app.versions : [];
  const dup = versions.findIndex((v) => key(v) === key(version));
  if (dup !== -1 && !force) throw new Error(`version ${version.version} (${version.buildVersion ?? 'no build'}) already exists at index ${dup}; use --force to replace it`);
  return { ...app, versions: [version, ...versions.filter((_, i) => i !== dup)] };
}
