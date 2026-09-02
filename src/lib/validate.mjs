import path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { getValidators, formatAjvError } from './schema.mjs';
import { isAbsoluteURL, isAbsoluteHttps, mapURLs } from './urls.mjs';
import { inferKind } from './kinds.mjs';
import { imageSize } from './images.mjs';

export const CATEGORIES = ['developer', 'entertainment', 'games', 'lifestyle', 'other', 'photo-video', 'social', 'utilities'];

export const KNOWN_KEYS = {
  meta: ['$schema', 'baseURL', 'overrides', 'name', 'identifier', 'subtitle', 'description', 'iconURL', 'headerURL', 'website', 'fediUsername', 'patreonURL', 'tintColor', 'nsfw', 'featuredApps', 'localizedSubtitles', 'localizedDescriptions'],
  app: ['$schema', 'upstream', 'name', 'bundleIdentifier', 'marketplaceID', 'developerName', 'subtitle', 'localizedDescription', 'iconURL', 'tintColor', 'category', 'screenshots', 'versions', 'appPermissions', 'patreon', 'localizedSubtitles', 'localizedDescriptions'],
  version: ['kind', 'version', 'buildVersion', 'marketingVersion', 'date', 'localizedDescription', 'downloadURL', 'size', 'assetURLs', 'minOSVersion', 'maxOSVersion', 'sha256', 'localizedDescriptions'],
  news: ['$schema', 'title', 'identifier', 'caption', 'date', 'tintColor', 'imageURL', 'notify', 'url', 'appID'],
};

const HEX_COLOR = /^#?[0-9A-Fa-f]{6}$/;
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const OS_VERSION = /^\d+(\.\d+){0,2}$/;

export function isISODate(value) {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Relative reference → repo-relative path when it lives under assets/ or public/, else null. */
export function localPath(value) {
  const rel = value.replace(/^\.\//, '');
  return /^(assets|public)\//.test(rel) ? rel : null;
}

class Collector {
  constructor() { this.errors = []; this.warnings = []; }
  error(code, where, message) { this.errors.push({ code, path: where, message }); }
  warn(code, where, message) { this.warnings.push({ code, path: where, message }); }
}

const versionsOf = (a) => (Array.isArray(a.data.versions) ? a.data.versions.filter((v) => v && typeof v === 'object') : []);

function codeFor(err) {
  const p = err.instancePath;
  if (p.startsWith('/upstream')) return 'E16';
  if (p === '/category') return 'E10';
  if (p === '/versions' && err.keyword === 'minItems') return 'E11';
  if (p.startsWith('/appPermissions')) return 'E15';
  if (/^\/versions\/\d+\/size$/.test(p)) return 'E12';
  return 'E01';
}

// ajv reports an extra `if` error ("must match then schema") next to the real one; drop it.
const realErrors = (fn) => fn.errors.filter((e) => e.keyword !== 'if');
const pointer = (file, e) => `${file}#${e.instancePath || '/'}`;

function checkSchemas(c, { meta, apps, news }) {
  const v = getValidators();
  if (!v.meta(meta)) for (const e of realErrors(v.meta)) c.error('E01', pointer('source.meta.json', e), formatAjvError(e));
  for (const a of apps) if (!v.app(a.data)) for (const e of realErrors(v.app)) c.error(codeFor(e), pointer(a.file, e), formatAjvError(e));
  for (const n of news) if (!v.news(n.data)) for (const e of realErrors(v.news)) c.error('E01', pointer(n.file, e), formatAjvError(e));
}

function warnUnknown(c, obj, known, where) {
  if (!obj || typeof obj !== 'object') return;
  const set = new Set(known);
  for (const key of Object.keys(obj)) if (!set.has(key)) c.warn('W01', `${where}/${key}`, `unknown key "${key}" (typo? AltStore ignores it)`);
}

function checkUnknownKeys(c, { meta, apps, news }) {
  warnUnknown(c, meta, KNOWN_KEYS.meta, 'source.meta.json#');
  for (const a of apps) {
    warnUnknown(c, a.data, KNOWN_KEYS.app, `${a.file}#`);
    versionsOf(a).forEach((ver, i) => warnUnknown(c, ver, KNOWN_KEYS.version, `${a.file}#/versions/${i}`));
  }
  for (const n of news) warnUnknown(c, n.data, KNOWN_KEYS.news, `${n.file}#`);
}

function checkIdentity(c, { meta, apps, news }) {
  const seenApps = new Map();
  for (const a of apps) {
    const id = a.data.bundleIdentifier;
    if (typeof id !== 'string') continue;
    if (id !== a.name) c.error('E02', `${a.file}#/bundleIdentifier`, `bundleIdentifier "${id}" must equal the file name "${a.name}"`);
    if (seenApps.has(id)) c.error('E03', `${a.file}#/bundleIdentifier`, `duplicate bundleIdentifier "${id}" (also in ${seenApps.get(id)})`);
    else seenApps.set(id, a.file);
  }
  const seenNews = new Map();
  for (const n of news) {
    const id = n.data.identifier;
    if (typeof id !== 'string') continue;
    if (id !== n.name) c.error('E04', `${n.file}#/identifier`, `identifier "${id}" must equal the file name "${n.name}"`);
    if (seenNews.has(id)) c.error('E04', `${n.file}#/identifier`, `duplicate news identifier "${id}" (also in ${seenNews.get(id)})`);
    else seenNews.set(id, n.file);
  }
  const known = new Set(seenApps.keys());
  const featured = Array.isArray(meta.featuredApps) ? meta.featuredApps : [];
  featured.forEach((id, i) => { if (!known.has(id)) c.error('E05', `source.meta.json#/featuredApps/${i}`, `featured app "${id}" is not in apps/`); });
  if (featured.length > 5) c.warn('W02', 'source.meta.json#/featuredApps', `AltStore shows only the first 5 of ${featured.length} featured apps`);
  for (const n of news) if (typeof n.data.appID === 'string' && !known.has(n.data.appID)) c.warn('W06', `${n.file}#/appID`, `appID "${n.data.appID}" is not in apps/`);
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function checkURLs(c, { meta, apps, news }, rootDir) {
  const refs = [];
  const collect = (obj, where) => mapURLs(obj, (value, p) => { refs.push({ value, where: `${where}#${p}` }); return value; });
  collect(meta, 'source.meta.json');
  for (const a of apps) collect(a.data, a.file);
  for (const n of news) collect(n.data, n.file);
  for (const { value, where } of refs) {
    if (isAbsoluteHttps(value)) continue;
    if (isAbsoluteURL(value)) { c.error('E06', where, `URLs must use https:// (got ${value})`); continue; }
    const rel = localPath(value);
    if (!rel) { c.error('E07', where, `relative URL "${value}" must point into assets/ or public/`); continue; }
    if (!(await exists(path.join(rootDir, rel)))) c.error('E07', where, `relative URL "${value}" does not exist in the repo`);
  }
}

function checkFormats(c, { meta, apps, news }) {
  const tint = (value, where) => {
    if (value !== undefined && !(typeof value === 'string' && HEX_COLOR.test(value))) c.error('E08', where, `tintColor must be a hex colour like #F54F32 (got ${JSON.stringify(value)})`);
  };
  const date = (value, where) => {
    if (value !== undefined && !isISODate(value)) c.error('E09', where, `date must be ISO 8601 like 2026-09-02 or 2026-09-02T12:00:00Z (got ${JSON.stringify(value)})`);
  };
  tint(meta.tintColor, 'source.meta.json#/tintColor');
  for (const a of apps) {
    tint(a.data.tintColor, `${a.file}#/tintColor`);
    versionsOf(a).forEach((ver, i) => date(ver.date, `${a.file}#/versions/${i}/date`));
  }
  for (const n of news) {
    tint(n.data.tintColor, `${n.file}#/tintColor`);
    date(n.data.date, `${n.file}#/date`);
  }
}

/** { errors: Issue[], warnings: Issue[] } with Issue = { code, path, message }. */
export async function validateContent(content, { rootDir }) {
  const c = new Collector();
  checkSchemas(c, content);
  checkUnknownKeys(c, content);
  checkIdentity(c, content);
  await checkURLs(c, content, rootDir);
  checkFormats(c, content);
  return { errors: c.errors, warnings: c.warnings };
}
