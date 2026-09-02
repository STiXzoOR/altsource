import path from 'node:path';
import { loadContent } from '../../../src/lib/load.mjs';
import { resolveContent } from '../../../src/lib/resolve.mjs';
import { buildOutput, OUTPUTS } from '../../../src/lib/build.mjs';
import { inferKind } from '../../../src/lib/kinds.mjs';

export const ROOT = path.resolve(process.env.ALTSOURCE_ROOT ?? process.cwd());
let cache = null;
export { inferKind };

export const universalLink = (sourceURL, bundleId) =>
  `https://altstore.io/source/${sourceURL.replace(/^https?:\/\//, '')}${bundleId ? `?app=${encodeURIComponent(bundleId)}` : ''}`;

/** Everything the pages need, computed once per build from the content tree. */
export async function getSite() {
  if (cache) return cache;
  const raw = await loadContent(ROOT);
  const content = await resolveContent(raw, { rootDir: ROOT });
  const pal = buildOutput(content, 'pal');
  const classic = buildOutput(content, 'classic');
  const base = raw.meta.baseURL;
  const urls = { pal: new URL(OUTPUTS.pal.file, base).href, classic: new URL(OUTPUTS.classic.file, base).href };
  const kinds = new Map();
  for (const a of pal.apps) kinds.set(a.bundleIdentifier, ['adp']);
  for (const a of classic.apps) kinds.set(a.bundleIdentifier, [...(kinds.get(a.bundleIdentifier) ?? []), 'ipa']);
  const apps = content.apps
    .filter((a) => kinds.has(a.data.bundleIdentifier))
    .map((a) => {
      const { upstream, $schema, ...app } = a.data;
      const project = upstream?.type === 'github' && upstream.repo ? { label: 'Project on GitHub', href: `https://github.com/${upstream.repo}` } : undefined;
      return { id: app.bundleIdentifier, app, kinds: kinds.get(app.bundleIdentifier), latest: app.versions[0], project };
    })
    .sort((x, y) => x.app.name.localeCompare(y.app.name, 'en', { sensitivity: 'base' }));
  const byId = new Map(apps.map((e) => [e.id, e]));
  const featured = (raw.meta.featuredApps ?? []).map((id) => byId.get(id)).filter(Boolean);
  const news = content.news
    .map((n) => { const { $schema, ...item } = n.data; return item; })
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const { $schema, baseURL, overrides, ...meta } = content.meta;
  cache = { meta, base, urls, apps, featured, news, counts: { pal: pal.apps.length, classic: classic.apps.length } };
  return cache;
}

export function installLinks(entry, urls) {
  const { app, kinds } = entry;
  const links = [];
  if (kinds.includes('adp')) links.push({ label: 'Get in AltStore PAL', href: universalLink(urls.pal, app.bundleIdentifier), kind: 'adp', primary: true });
  if (kinds.includes('ipa')) {
    const ipa = app.versions.find((v) => inferKind(v) === 'ipa');
    links.push({ label: 'Get in AltStore', href: universalLink(urls.classic, app.bundleIdentifier), kind: 'ipa', primary: !kinds.includes('adp') });
    links.push({ label: 'Install with SideStore', href: `sidestore://install?url=${encodeURIComponent(ipa.downloadURL)}`, kind: 'ipa' });
    links.push({ label: 'Download .ipa', href: ipa.downloadURL, kind: 'ipa', download: true });
  }
  return links;
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${i > 0 && v < 100 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(iso);
  const t = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Version as people see it: the marketing version when the app has one, never the build number. */
export const versionLabel = (v) => v.marketingVersion ?? v.version;

const CATEGORY_LABELS = { developer: 'Developer Tools', 'photo-video': 'Photo & Video' };
/** Title-case label for an AltStore category id. */
export function categoryLabel(id) {
  if (!id) return 'Other';
  return CATEGORY_LABELS[id] ?? id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function screenshotsOf(app) {
  const s = app?.screenshots;
  const norm = (list) => (Array.isArray(list) ? list : []).map((x) => (typeof x === 'string' ? { imageURL: x } : x));
  if (!s) return { iphone: [], ipad: [] };
  return Array.isArray(s) ? { iphone: norm(s), ipad: [] } : { iphone: norm(s.iphone), ipad: norm(s.ipad) };
}

const escapeHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped text with http(s) URLs turned into links. Keep newlines with `whitespace-pre-line`. */
export function linkify(text) {
  return escapeHTML(text ?? '').replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, (url) => `<a href="${url}" rel="noopener" target="_blank">${url}</a>`);
}
