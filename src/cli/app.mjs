import { parseArgs } from 'node:util';
import path from 'node:path';
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { readApp, writeApp, listApps, removeApp, today } from '../lib/content.mjs';
import { fetchUpstreamApp } from '../lib/upstream.mjs';
import { fetchRepoInfo } from '../lib/github.mjs';
import { inferKind } from '../lib/kinds.mjs';
import { ensurePermissions } from '../lib/permissions.mjs';
import { SOURCE_OPTIONS, resolvePackage, sourceKind, reportFileIssues, UsageError } from './inputs.mjs';
import { loadBytes } from '../lib/http.mjs';
import { normalizeIcon, normalizeScreenshot, assetDir, iconPath, shotPath, mergeScreenshots } from '../lib/assets.mjs';

const USAGE = `usage:
  altsource app add [bundleId] (--from-source URL | --from-github owner/repo | --from-adp URL | --from-ipa PATH|URL) [options]
  altsource app add                       interactive prompts
  altsource app list [--json]
  altsource app remove <bundleId>
  altsource app assets <bundleId> [--icon URL|PATH] [--screenshot URL|PATH]... [--ipad URL|PATH]... [--replace]

options for add:
  --upstream                              record the origin so \`altsource sync\` can update the app
  --name --developer --subtitle --description --icon --category --tint --marketplace-id
  --asset GLOB --tag TAG --prerelease     GitHub releases
  --release BASE_URL                      ADP hosted on GitHub Releases (writes assetURLs)
  --download-url URL                      required with a local --from-ipa file
  --notes TEXT --date ISO --force

options for assets:
  --icon                                  any raster; stored as a 1024 px opaque PNG
  --screenshot / --ipad                   repeatable, in order; stored as JPEG no taller than 1600 px
  --replace                               clear a device's existing screenshots before adding
`;

const ADD_OPTIONS = {
  ...SOURCE_OPTIONS,
  upstream: { type: 'boolean', default: false }, force: { type: 'boolean', default: false },
  name: { type: 'string' }, developer: { type: 'string' }, subtitle: { type: 'string' }, description: { type: 'string' },
  icon: { type: 'string' }, category: { type: 'string' }, tint: { type: 'string' }, 'marketplace-id': { type: 'string' },
};

function overrides(values) {
  const m = { name: values.name, developerName: values.developer, subtitle: values.subtitle, localizedDescription: values.description, iconURL: values.icon, category: values.category, tintColor: values.tint, marketplaceID: values['marketplace-id'] };
  for (const k of Object.keys(m)) if (m[k] === undefined) delete m[k];
  return m;
}

async function buildApp(bundleId, values, ctx) {
  const notes = [];
  const kind = sourceKind(values);
  if (kind === 'from-source') {
    if (!bundleId) throw new UsageError('bundleId is required with --from-source');
    const { app } = await fetchUpstreamApp(values['from-source'], bundleId, { fetch: ctx.fetch });
    const { $schema, ...rest } = app;
    const filled = await ensurePermissions({ ...rest, ...overrides(values) }, ctx);
    if (filled.note) notes.push(filled.note);
    let out = filled.app;
    if (values.upstream) out = { ...out, upstream: { type: 'altstore', url: values['from-source'] } };
    return { app: out, notes };
  }
  const pkg = await resolvePackage(values, ctx);
  if (!pkg) return null;
  if (pkg.kind === 'ipa') {
    const { ipa } = pkg;
    if (bundleId && bundleId !== ipa.bundleIdentifier) throw new UsageError(`the IPA is ${ipa.bundleIdentifier}, not ${bundleId}`);
    let { developer, description, icon } = values;
    if (pkg.repo) {
      const owner = pkg.repo.split('/')[0];
      const info = await fetchRepoInfo(pkg.repo, { fetch: ctx.fetch }).catch(() => null);
      developer ??= info?.owner ?? owner;
      description ??= info?.description || `${ipa.name} from https://github.com/${pkg.repo}`;
      if (!icon) { icon = `https://github.com/${info?.owner ?? owner}.png`; notes.push(`iconURL set to the GitHub avatar of ${owner}; replace it with the real app icon`); }
    } else {
      developer ??= 'Unknown';
      description ??= ipa.name;
      if (!icon) { icon = 'assets/icon.png'; notes.push('iconURL set to the source icon; replace it with the app icon'); }
    }
    const app = { name: ipa.name, bundleIdentifier: ipa.bundleIdentifier, developerName: developer, localizedDescription: description, iconURL: icon, ...overrides(values), versions: [pkg.version], appPermissions: { entitlements: ipa.entitlements, privacy: ipa.privacy } };
    if (values.upstream && pkg.repo) {
      app.upstream = { type: 'github', repo: pkg.repo };
      if (values.asset) app.upstream.asset = values.asset;
      if (values.prerelease) app.upstream.prerelease = true;
    }
    return { app, notes };
  }
  const m = pkg.manifest;
  if (bundleId && bundleId !== m.bundleIdentifier) throw new UsageError(`the ADP is ${m.bundleIdentifier}, not ${bundleId}`);
  const app = { name: values.name ?? m.bundleIdentifier, bundleIdentifier: m.bundleIdentifier, marketplaceID: m.marketplaceID, developerName: values.developer ?? 'Unknown', localizedDescription: values.description ?? '', iconURL: values.icon ?? 'assets/icon.png', ...overrides(values), versions: [pkg.version], appPermissions: { entitlements: [], privacy: {} } };
  if (!values.name) notes.push('name set to the bundle identifier; pass --name');
  if (!values.icon) notes.push('iconURL set to the source icon; pass --icon');
  notes.push('appPermissions left empty: ADP manifests do not list entitlements; fill them in by hand');
  if (values.upstream) app.upstream = { type: 'adp', url: values['from-adp'] };
  return { app, notes };
}

/** Line-buffered prompts: lines are queued as they arrive, so piped input works as well as a terminal. */
function prompter(input, output) {
  const rl = createInterface({ input, terminal: false });
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => { const w = waiters.shift(); if (w) w(line); else queue.push(line); });
  rl.on('close', () => { closed = true; for (const w of waiters.splice(0)) w(null); });
  return {
    async ask(question, fallback) {
      output.write(fallback !== undefined ? `${question} [${fallback}]: ` : `${question}: `);
      const line = queue.length ? queue.shift() : closed ? null : await new Promise((r) => waiters.push(r));
      if (line === null) throw new UsageError('input ended before all prompts were answered');
      return line.trim() || fallback;
    },
    close: () => rl.close(),
  };
}

async function interactive(ctx) {
  const { ask, close } = prompter(ctx.input ?? process.stdin, ctx.stdout);
  try {
    const name = await ask('App name');
    const bundleIdentifier = await ask('Bundle identifier');
    const developerName = await ask('Developer name');
    const localizedDescription = await ask('Description');
    const subtitle = await ask('Subtitle (optional)', '');
    const iconURL = await ask('Icon URL or assets/ path');
    const downloadURL = await ask('Download URL (.ipa or ADP directory)');
    const version = await ask('Version');
    const buildVersion = await ask('Build number');
    const size = Number(await ask('Size in bytes'));
    const minOSVersion = await ask('Minimum iOS version (optional)', '');
    const v = { version, buildVersion, date: today(), downloadURL, size };
    if (minOSVersion) v.minOSVersion = minOSVersion;
    const app = { name, bundleIdentifier, developerName, localizedDescription, iconURL, versions: [v], appPermissions: { entitlements: [], privacy: {} } };
    if (subtitle) app.subtitle = subtitle;
    return { app, notes: ['appPermissions left empty; list entitlements and usage descriptions before publishing'] };
  } finally {
    close();
  }
}

async function add(argv, ctx) {
  const { values, positionals } = parseArgs({ args: argv, options: ADD_OPTIONS, allowPositionals: true });
  const built = (await buildApp(positionals[0], values, ctx)) ?? (await interactive(ctx));
  const { app, notes } = built;
  const file = `apps/${app.bundleIdentifier}.json`;
  if (!values.force && (await readApp(ctx.cwd, app.bundleIdentifier))) throw new UsageError(`${file} already exists; use --force to replace it`);
  await writeApp(ctx.cwd, app);
  const v = app.versions[0];
  ctx.stdout.write(`added ${file} — ${app.name} ${v.version}${v.buildVersion ? ` (${v.buildVersion})` : ''} [${inferKind(v) ?? 'unknown kind'}]\n`);
  for (const n of notes) ctx.stdout.write(`note: ${n}\n`);
  return (await reportFileIssues(file, ctx)) > 0 ? 1 : 0;
}

async function list(argv, ctx) {
  const { values } = parseArgs({ args: argv, options: { json: { type: 'boolean', default: false } } });
  const rows = (await listApps(ctx.cwd)).map(({ id, app }) => {
    const kinds = [...new Set((app.versions ?? []).map(inferKind).filter(Boolean))];
    const latest = app.versions?.[0];
    return { bundleIdentifier: id, name: app.name, kinds, latest: latest ? `${latest.version}${latest.buildVersion ? ` (${latest.buildVersion})` : ''}` : '-', upstream: app.upstream ? `${app.upstream.type}:${app.upstream.repo ?? app.upstream.url}` : '-' };
  });
  if (values.json) { ctx.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return 0; }
  if (rows.length === 0) { ctx.stdout.write('no apps yet\n'); return 0; }
  const w = (k) => Math.max(...rows.map((r) => String(Array.isArray(r[k]) ? r[k].join(',') : r[k]).length));
  for (const r of rows) ctx.stdout.write(`${r.bundleIdentifier.padEnd(w('bundleIdentifier'))}  ${r.name.padEnd(w('name'))}  ${r.kinds.join(',').padEnd(w('kinds'))}  ${r.latest.padEnd(w('latest'))}  ${r.upstream}\n`);
  return 0;
}

async function remove(argv, ctx) {
  const { positionals } = parseArgs({ args: argv, options: {}, allowPositionals: true });
  const id = positionals[0];
  if (!id) throw new UsageError('bundleId is required');
  const r = await removeApp(ctx.cwd, id);
  if (!r.removed) { ctx.stderr.write(`apps/${id}.json does not exist\n`); return 1; }
  ctx.stdout.write(`removed apps/${id}.json${r.unfeatured ? ' (and dropped it from featuredApps)' : ''}\n`);
  for (const n of r.newsReferencing) ctx.stdout.write(`note: news/${n}.json still references ${id} via appID\n`);
  return 0;
}

const ASSET_OPTIONS = {
  icon: { type: 'string' },
  screenshot: { type: 'string', multiple: true, default: [] },
  ipad: { type: 'string', multiple: true, default: [] },
  replace: { type: 'boolean', default: false },
};

async function assets(argv, ctx) {
  const { values, positionals } = parseArgs({ args: argv, options: ASSET_OPTIONS, allowPositionals: true });
  const id = positionals[0];
  if (!id) throw new UsageError('bundleId is required');
  if (!values.icon && values.screenshot.length === 0 && values.ipad.length === 0) throw new UsageError('pass --icon and/or --screenshot / --ipad');
  const app = await readApp(ctx.cwd, id);
  if (!app) throw new UsageError(`apps/${id}.json does not exist`);
  const dir = path.join(ctx.cwd, assetDir(id));
  await mkdir(dir, { recursive: true });
  const written = [];
  const next = { ...app };
  if (values.icon) {
    const { buffer } = await loadBytes(values.icon, { cwd: ctx.cwd, fetch: ctx.fetch });
    const icon = await normalizeIcon(buffer);
    const rel = iconPath(id, icon.ext);
    await writeFile(path.join(ctx.cwd, rel), icon.data);
    for (const other of ['png', 'jpg'].filter((e) => e !== icon.ext)) await unlink(path.join(ctx.cwd, iconPath(id, other))).catch(() => {});
    next.iconURL = rel;
    written.push(rel);
  }
  const added = {};
  for (const [device, inputs] of [['iphone', values.screenshot], ['ipad', values.ipad]]) {
    if (inputs.length === 0) continue;
    if (values.replace) for (const f of await readdir(dir)) if (f.startsWith(`${device}-`)) await unlink(path.join(dir, f));
    let n = (await readdir(dir)).filter((f) => f.startsWith(`${device}-`)).length;
    added[device] = [];
    for (const input of inputs) {
      const { buffer } = await loadBytes(input, { cwd: ctx.cwd, fetch: ctx.fetch });
      const shot = await normalizeScreenshot(buffer);
      n += 1;
      const rel = shotPath(id, device, n);
      await writeFile(path.join(ctx.cwd, rel), shot.data);
      added[device].push({ imageURL: rel, width: shot.width, height: shot.height });
      written.push(rel);
    }
  }
  const merged = mergeScreenshots(app.screenshots, added, { replace: values.replace });
  if (merged === undefined) delete next.screenshots; else next.screenshots = merged;
  await writeApp(ctx.cwd, next);
  for (const w of written) ctx.stdout.write(`wrote ${w}\n`);
  ctx.stdout.write(`updated apps/${id}.json\n`);
  return 0;
}

export async function run(argv, ctx) {
  const [sub, ...rest] = argv;
  const handlers = { add, list, remove, assets };
  if (!handlers[sub]) { ctx.stderr.write(USAGE); return 1; }
  try {
    return await handlers[sub](rest, ctx);
  } catch (e) {
    if (e instanceof UsageError || e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || e.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') { ctx.stderr.write(`✖ ${e.message}\n`); return 1; }
    ctx.stderr.write(`✖ ${e.message}\n`);
    return 1;
  }
}
