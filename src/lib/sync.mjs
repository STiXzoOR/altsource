import { fetchUpstreamApp } from './upstream.mjs';
import { fetchLatestRelease, matchAsset } from './github.mjs';
import { fetchManifest, parseManifest, versionFromManifest } from './adp.mjs';
import { loadBytes } from './http.mjs';
import { inspectIPA, versionFromIPA } from './ipa.mjs';
import { inferKind } from './kinds.mjs';
import { listApps, writeApp, writeNews, newsExists, prependVersion, slugify, today } from './content.mjs';
import { appendLog } from './state.mjs';
import { ensurePermissions } from './permissions.mjs';

const vkey = (v) => (v ? `${inferKind(v)}|${v.version}|${v.buildVersion ?? ''}` : null);
const isoFromHTTPDate = (s) => { const t = s ? Date.parse(s) : NaN; return Number.isNaN(t) ? undefined : new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z'); };

async function syncAltstore(app, up, ctx) {
  const { app: remote } = await fetchUpstreamApp(up.url, app.bundleIdentifier, { fetch: ctx.fetch });
  const fields = up.sync === '*' ? Object.keys(remote).filter((k) => k !== 'bundleIdentifier' && k !== '$schema') : (up.sync ?? ['versions']);
  const next = { ...app };
  for (const f of fields) if (remote[f] !== undefined) next[f] = remote[f];
  return next;
}

async function syncGithub(app, up, ctx) {
  const release = await fetchLatestRelease(up.repo, { fetch: ctx.fetch, token: ctx.token, prerelease: up.prerelease === true });
  const asset = matchAsset(release.assets, up.asset ?? '*.ipa');
  if ((app.versions ?? []).some((v) => v.downloadURL === asset.url)) return app;
  const { buffer } = await loadBytes(asset.url, { cwd: ctx.cwd, fetch: ctx.fetch });
  const ipa = inspectIPA(buffer);
  if (ipa.bundleIdentifier !== app.bundleIdentifier) throw new Error(`release asset is ${ipa.bundleIdentifier}, expected ${app.bundleIdentifier}`);
  const version = versionFromIPA(ipa, { downloadURL: asset.url, size: asset.size, date: release.publishedAt ?? today(), notes: up.notes === 'none' ? undefined : release.body || undefined });
  return prependVersion({ ...app, appPermissions: { entitlements: ipa.entitlements, privacy: ipa.privacy } }, version, { force: true });
}

async function syncADP(app, up, ctx) {
  const { manifest, manifestURL, lastModified } = await fetchManifest(up.url, { fetch: ctx.fetch });
  const parsed = parseManifest(manifest);
  if (parsed.bundleIdentifier && parsed.bundleIdentifier !== app.bundleIdentifier) throw new Error(`manifest is ${parsed.bundleIdentifier}, expected ${app.bundleIdentifier}`);
  const exists = (app.versions ?? []).some((v) => inferKind(v) === 'adp' && v.version === parsed.version && (v.buildVersion ?? '') === (parsed.buildVersion ?? ''));
  if (exists) return app;
  const version = versionFromManifest(parsed, { manifestURL, date: isoFromHTTPDate(lastModified) ?? today() });
  const next = { ...app };
  if (!next.marketplaceID && parsed.marketplaceID) next.marketplaceID = parsed.marketplaceID;
  return prependVersion(next, version, { force: true });
}

const HANDLERS = { altstore: syncAltstore, github: syncGithub, adp: syncADP };

/** Decide the next state of one app from its upstream. Never throws. */
export async function syncApp({ id, app }, ctx) {
  const up = app.upstream;
  if (!up) return { id, action: 'skipped', message: 'no upstream' };
  try {
    const handler = HANDLERS[up.type];
    if (!handler) throw new Error(`unknown upstream type ${up.type}`);
    let next = await handler(app, up, ctx);
    const notes = [];
    if (up.type === 'altstore') {
      const filled = await ensurePermissions(next, ctx);
      next = filled.app;
      if (filled.note) notes.push(filled.note);
    }
    const before = vkey(app.versions?.[0]);
    const after = vkey(next.versions?.[0]);
    const changed = JSON.stringify(next) !== JSON.stringify(app);
    const action = before !== after ? 'added' : changed ? 'updated' : 'unchanged';
    return { id, action, app: next, version: next.versions?.[0], from: app.versions?.[0]?.version, to: next.versions?.[0]?.version, notes };
  } catch (e) {
    return { id, action: 'error', message: e.message };
  }
}

function newsFor(app, version, up) {
  const label = version.buildVersion ? `${version.version} (${version.buildVersion})` : version.version;
  const item = {
    title: `${app.name} ${version.version}`,
    identifier: `update-${slugify(app.bundleIdentifier)}-${slugify(version.version)}-${slugify(version.buildVersion ?? '0')}`,
    caption: `Version ${label} is now available.`,
    date: version.date ?? today(),
    appID: app.bundleIdentifier,
  };
  if (up.notify === true) item.notify = true;
  return item;
}

/** Sync every app with an upstream (or only the given ids). Writes files unless dryRun. */
export async function runSync({ cwd, fetch = globalThis.fetch, token = process.env.GITHUB_TOKEN, only = [], dryRun = false }) {
  const apps = (await listApps(cwd)).filter(({ id, app }) => app.upstream && (only.length === 0 || only.includes(id)));
  const results = [];
  for (const entry of apps) {
    const r = await syncApp(entry, { cwd, fetch, token });
    if (!dryRun && (r.action === 'added' || r.action === 'updated')) {
      await writeApp(cwd, r.app);
      if (r.action === 'added' && entry.app.upstream.news !== false) {
        const item = newsFor(r.app, r.version, entry.app.upstream);
        if (!(await newsExists(cwd, item.identifier))) { await writeNews(cwd, item); r.news = item.identifier; }
      }
    }
    results.push(r);
  }
  const changed = results.filter((r) => r.action === 'added' || r.action === 'updated').map((r) => r.id);
  const loggable = results.filter((r) => ['added', 'updated', 'error'].includes(r.action));
  if (!dryRun && loggable.length > 0) {
    const at = today();
    await appendLog(cwd, 'sync-log', loggable.map((r) => ({ at, id: r.id, action: r.action, version: r.to, message: r.message })));
  }
  return { results, changed };
}

export function formatSyncMarkdown(results) {
  const lines = ['| App | Action | From → To | Note |', '|---|---|---|---|'];
  for (const r of results) {
    const note = (r.message ?? (r.notes ?? []).join('; ')).replace(/\|/g, '\\|');
    lines.push(`| \`${r.id}\` | ${r.action} | ${r.from ?? '-'} → ${r.to ?? '-'} | ${note} |`);
  }
  if (results.length === 0) lines.push('| _no apps with upstream_ | | | |');
  return lines.join('\n') + '\n';
}
