import qrcode from 'qrcode-generator';
import { loadContent } from './load.mjs';
import { resolveContent } from './resolve.mjs';
import { buildOutput, OUTPUTS } from './build.mjs';
import { inferKind } from './kinds.mjs';
import { readState } from './state.mjs';
import { fetchUpstreamApp } from './upstream.mjs';
import { fetchLatestRelease, matchAsset } from './github.mjs';
import { fetchManifest, parseManifest } from './adp.mjs';
import { today } from './content.mjs';

const vkey = (v) => (v ? `${v.version}|${v.buildVersion ?? ''}` : null);
export const universalLink = (url) => `https://altstore.io/source/${url.replace(/^https?:\/\//, '')}`;

export function qrSVG(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

async function upstreamLatest(app, up, ctx) {
  if (up.type === 'altstore') {
    const { app: remote } = await fetchUpstreamApp(up.url, app.bundleIdentifier, { fetch: ctx.fetch });
    const v = remote.versions?.[0];
    return { ref: up.url, latest: v ? { version: v.version, buildVersion: v.buildVersion } : null, key: vkey(v) };
  }
  if (up.type === 'github') {
    const rel = await fetchLatestRelease(up.repo, { fetch: ctx.fetch, token: ctx.token, prerelease: up.prerelease === true });
    const asset = matchAsset(rel.assets, up.asset ?? '*.ipa');
    const local = (app.versions ?? []).find((v) => v.downloadURL === asset.url);
    return { ref: `https://github.com/${up.repo}`, latest: { version: local?.version ?? rel.tag, buildVersion: local?.buildVersion, tag: rel.tag }, key: local ? vkey(local) : `tag|${rel.tag}` };
  }
  if (up.type === 'adp') {
    const { manifest } = await fetchManifest(up.url, { fetch: ctx.fetch });
    const p = parseManifest(manifest);
    const latest = { version: p.version, buildVersion: p.buildVersion };
    return { ref: up.url, latest, key: vkey(latest) };
  }
  throw new Error(`unknown upstream type ${up.type}`);
}

export async function upstreamState(app, ctx) {
  const up = app.upstream;
  if (!up) return null;
  const base = { type: up.type, ref: up.repo ? `https://github.com/${up.repo}` : up.url, checkedAt: today() };
  if (!ctx.online) return { ...base, latest: null, state: 'unknown' };
  try {
    const r = await upstreamLatest(app, up, ctx);
    const localKeys = (app.versions ?? []).map(vkey);
    const state = r.key === localKeys[0] ? 'in-sync' : localKeys.includes(r.key) ? 'ahead' : 'behind';
    return { ...base, ref: r.ref, latest: r.latest, state };
  } catch (e) {
    return { ...base, latest: null, state: 'unknown', error: e.message };
  }
}

export async function buildStatus({ cwd, fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN, online = true, commit = null, repo = null }) {
  const raw = await loadContent(cwd);
  const content = await resolveContent(raw, { rootDir: cwd });
  const outputs = Object.fromEntries(Object.keys(OUTPUTS).map((n) => [n, buildOutput(content, n)]));
  const sourceURLs = Object.fromEntries(Object.entries(OUTPUTS).map(([n, o]) => [n, new URL(o.file, raw.meta.baseURL).href]));
  const qr = Object.fromEntries(Object.entries(sourceURLs).map(([n, url]) => [n, qrSVG(universalLink(url))]));
  const apps = [];
  for (const { data: app } of raw.apps) {
    const latest = app.versions?.[0];
    apps.push({
      bundleIdentifier: app.bundleIdentifier,
      name: app.name,
      kinds: [...new Set((app.versions ?? []).map(inferKind).filter(Boolean))],
      latest: latest ? { version: latest.version, buildVersion: latest.buildVersion, date: latest.date } : null,
      upstream: await upstreamState(app, { fetch, token, online }),
    });
  }
  return {
    generatedAt: today(), commit, repo, sourceURLs, qr,
    counts: { apps: raw.apps.length, pal: outputs.pal.apps.length, classic: outputs.classic.apps.length, news: raw.news.length },
    apps,
    linkCheck: await readState(cwd, 'link-check', null),
    recent: ((await readState(cwd, 'sync-log', [])) ?? []).slice(0, 20),
  };
}

const label = (l) => (l ? `${l.version}${l.buildVersion ? ` (${l.buildVersion})` : ''}` : '-');

export function formatStatusText(s) {
  const lines = [`${s.counts.apps} app(s): ${s.counts.pal} PAL, ${s.counts.classic} Classic; ${s.counts.news} news`];
  for (const a of s.apps) lines.push(`${(a.upstream?.state ?? 'none').padEnd(8)} ${a.bundleIdentifier}  local ${label(a.latest)}  upstream ${label(a.upstream?.latest)}${a.upstream?.error ? `  (${a.upstream.error})` : ''}`);
  if (s.linkCheck) lines.push(`links: ${s.linkCheck.broken.length} broken of ${s.linkCheck.total} (checked ${s.linkCheck.checkedAt})`);
  return lines.join('\n') + '\n';
}

export function formatStatusMarkdown(s) {
  const lines = ['## Status', '', `${s.counts.apps} app(s): ${s.counts.pal} PAL, ${s.counts.classic} Classic; ${s.counts.news} news`, '', '| App | Kinds | Local | Upstream | State |', '|---|---|---|---|---|'];
  for (const a of s.apps) lines.push(`| \`${a.bundleIdentifier}\` | ${a.kinds.join(', ')} | ${label(a.latest)} | ${label(a.upstream?.latest)} | ${a.upstream?.state ?? 'none'} |`);
  return lines.join('\n') + '\n';
}
