# altsource Milestone 3 (Automation + Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The source keeps itself current: a scheduled GitHub Action pulls new versions from each app's upstream (another AltStore source, GitHub Releases, or an ADP manifest), validates, commits, and redeploys; a weekly link check opens an issue when something breaks; and a status dashboard shows local vs upstream versions, recent activity, broken links, and QR codes.

**Architecture:** `sync.mjs` turns each app's `upstream` block into a pure "next app object" decision, never throwing (errors become results). `runSync` writes apps, news, and `state/sync-log.json`. `status.mjs` compares local versions with upstream and assembles `status.json`, which a static page renders. Workflows call the CLI; bot commits then invoke the reusable deploy workflow because `GITHUB_TOKEN` pushes do not trigger `push` events.

**Tech Stack:** Node 24, existing deps plus `qrcode-generator` (zero dependencies, ESM) for SVG QR codes.

**Spec:** `docs/superpowers/specs/2026-09-02-altsource-design.md` sections 7, 7.1, 7.2, 8, 11 (milestone 3).

## Global Constraints

- Same rules as milestones 1–2 (Node 24, ESM, TDD, `$TRAILERS`, injectable `fetch`).
- New runtime dep: `qrcode-generator@^2.0.4` only.
- `sync` exits 0 unless the repo cannot be read; per-app failures are results, not exceptions.
- Sync news identifier: `update-<slug(bundleId)>-<slug(version)>-<slug(build or 0)>`; created only when `upstream.news !== false`; `notify` only when `upstream.notify === true`.
- `state/*.json` files are written by bots and committed; `state/sync-log.json` keeps at most 100 entries, newest first.
- `status.json` is written into `dist/` (never committed); QR codes encode the universal add link, not the raw JSON URL.
- Bot commits: `github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>`.
- Code blocks introduced by `` `path`: `` are materialised verbatim.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/state.mjs` | `readState`, `writeState`, `appendLog` for `state/<name>.json` |
| `src/lib/permissions.mjs` | `ensurePermissions(app, ctx)` (moved out of `cli/app.mjs`) |
| `src/lib/sync.mjs` | `syncApp`, `runSync`, `formatSyncMarkdown` |
| `src/lib/status.mjs` | `upstreamState`, `buildStatus`, `formatStatusText`, `formatStatusMarkdown` |
| `src/cli/sync.mjs`, `src/cli/check-links.mjs`, `src/cli/status.mjs` | commands |
| `src/cli/serve.mjs` | adds `prepare()` (build + offline status) |
| `public/status/index.html` | dashboard |
| `.github/workflows/sync.yml`, `links.yml`, `deploy.yml` | automation |

---

### Task 1: State files and the QR dependency

**Files:** `package.json`, `src/lib/state.mjs`, `test/lib/state.test.mjs`

**Interfaces:** `readState(rootDir, name, fallback = null)`, `writeState(rootDir, name, data) → path`, `appendLog(rootDir, name, entries, { max = 100 }) → entries[]` (prepends, newest first, capped).

- [ ] Step 1: `npm install qrcode-generator@^2.0.4`
- [ ] Step 2: failing tests

`test/lib/state.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readState, writeState, appendLog } from '../../src/lib/state.mjs';
import { root } from '../helpers/content.mjs';

test('readState returns the fallback when missing and parses when present', async () => {
  const dir = await root();
  assert.equal(await readState(dir, 'nope'), null);
  assert.deepEqual(await readState(dir, 'nope', []), []);
  await writeState(dir, 'thing', { a: 1 });
  assert.deepEqual(await readState(dir, 'thing'), { a: 1 });
  assert.ok((await readFile(`${dir}/state/thing.json`, 'utf8')).endsWith('}\n'));
});

test('appendLog prepends newest first and caps the length', async () => {
  const dir = await root();
  await appendLog(dir, 'log', [{ n: 1 }]);
  await appendLog(dir, 'log', [{ n: 2 }, { n: 3 }], { max: 2 });
  assert.deepEqual(await readState(dir, 'log'), [{ n: 2 }, { n: 3 }]);
});
```

- [ ] Step 3: implement

`src/lib/state.mjs`:
```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const file = (rootDir, name) => path.join(rootDir, 'state', `${name}.json`);

export async function readState(rootDir, name, fallback = null) {
  try { return JSON.parse(await readFile(file(rootDir, name), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}

export async function writeState(rootDir, name, data) {
  const p = file(rootDir, name);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2) + '\n');
  return p;
}

/** Prepend entries (newest first) to state/<name>.json, keeping at most max. */
export async function appendLog(rootDir, name, entries, { max = 100 } = {}) {
  const existing = (await readState(rootDir, name, [])) ?? [];
  const next = [...entries, ...existing].slice(0, max);
  await writeState(rootDir, name, next);
  return next;
}
```

- [ ] Step 4: green; commit `feat: state files and qrcode-generator dep`.

---

### Task 2: `ensurePermissions` as a library function

**Files:** `src/lib/permissions.mjs`, `test/lib/permissions.test.mjs`, `src/cli/app.mjs` (use it; delete `fillPermissionsFromIPA`)

**Interfaces:** `ensurePermissions(app, { cwd, fetch }) → Promise<{ app, note? }>` — when `appPermissions` is missing and the newest version is an IPA, downloads it and fills `{ entitlements, privacy }`; otherwise returns the app untouched. Failures return a note, never throw.

- [ ] Step 1: failing tests

`test/lib/permissions.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensurePermissions } from '../../src/lib/permissions.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { makeIPA } from '../helpers/ipa.mjs';
import { app, version } from '../helpers/content.mjs';

test('ensurePermissions fills from the newest IPA only when missing', async () => {
  const fetch = makeFetch({ 'https://gh/d/a.ipa': { bytes: makeIPA({ entitlements: { 'aps-environment': 'production' } }) } });
  const a = app('com.example.demo', { appPermissions: undefined, versions: [version({ downloadURL: 'https://gh/d/a.ipa' })] });
  const r = await ensurePermissions(a, { cwd: '/', fetch });
  assert.deepEqual(r.app.appPermissions.entitlements, ['aps-environment', 'get-task-allow']);
  assert.match(r.note, /filled appPermissions from https:\/\/gh\/d\/a\.ipa/);
  const already = await ensurePermissions(app('com.x'), { cwd: '/', fetch });
  assert.equal(already.note, undefined);
  assert.equal(fetch.calls.length, 1);
});

test('ensurePermissions skips ADP versions and reports download failures', async () => {
  const fetch = makeFetch({});
  const adp = await ensurePermissions(app('com.x', { appPermissions: undefined, versions: [version({ downloadURL: 'https://h/adp/x/' })] }), { cwd: '/', fetch });
  assert.equal(adp.note, undefined);
  const bad = await ensurePermissions(app('com.x', { appPermissions: undefined, versions: [version({ downloadURL: 'https://gh/d/missing.ipa' })] }), { cwd: '/', fetch });
  assert.equal(bad.app.appPermissions, undefined);
  assert.match(bad.note, /could not inspect https:\/\/gh\/d\/missing\.ipa/);
});
```

- [ ] Step 2: implement

`src/lib/permissions.mjs`:
```js
import { loadBytes } from './http.mjs';
import { inspectIPA } from './ipa.mjs';
import { inferKind } from './kinds.mjs';

/** Fill appPermissions from the newest IPA when missing. Returns { app, note? }; never throws. */
export async function ensurePermissions(app, { cwd, fetch }) {
  const latest = app.versions?.[0];
  if (app.appPermissions || !latest || inferKind(latest) !== 'ipa') return { app };
  try {
    const { buffer } = await loadBytes(latest.downloadURL, { cwd, fetch });
    const ipa = inspectIPA(buffer);
    return { app: { ...app, appPermissions: { entitlements: ipa.entitlements, privacy: ipa.privacy } }, note: `filled appPermissions from ${latest.downloadURL}` };
  } catch (e) {
    return { app, note: `could not inspect ${latest.downloadURL} for permissions: ${e.message}` };
  }
}
```

In `src/cli/app.mjs`: delete `fillPermissionsFromIPA` and its `loadBytes`/`inspectIPA` imports (keep `inferKind`), import `ensurePermissions` from `../lib/permissions.mjs`, and in `buildApp`'s `from-source` branch replace the two lines with:
```js
    const filled = await ensurePermissions({ ...rest, ...overrides(values) }, ctx);
    if (filled.note) notes.push(filled.note);
    let out = filled.app;
```

- [ ] Step 3: green (the existing `app add --from-source` test still passes); commit `refactor: ensurePermissions library function`.

---

### Task 3: Sync engine

**Files:** `src/lib/sync.mjs`, `test/lib/sync.test.mjs`

**Interfaces:**
- `syncApp({ id, app }, { cwd, fetch, token }) → { id, action: 'added'|'updated'|'unchanged'|'error'|'skipped', app?, version?, from?, to?, notes?, message? }`.
  - `altstore`: copies the keys in `upstream.sync` (default `['versions']`, `'*'` = every key except `bundleIdentifier`/`$schema`) from the upstream listing, then `ensurePermissions`.
  - `github`: newest release (prereleases only when `upstream.prerelease`), asset by `upstream.asset` glob; unchanged when a local version already has that `downloadURL`; otherwise download, inspect (bundle id must match), prepend with `force`, refresh `appPermissions`; release body becomes notes unless `upstream.notes === 'none'`.
  - `adp`: unchanged when `(version, buildVersion)` exists as an ADP version; otherwise prepend per the manifest and set `marketplaceID` when missing.
  - `action` is `added` when `versions[0]` changed, `updated` when anything else changed, else `unchanged`.
- `runSync({ cwd, fetch, token, only = [], dryRun = false }) → { results, changed: string[] }` — writes changed apps, creates a news item per `added` (unless `upstream.news === false`; `notify` per `upstream.notify`), skips existing news ids, appends `added|updated|error` results to `state/sync-log.json` (not in dry runs).
- `formatSyncMarkdown(results) → string` — a table; pipes in messages escaped.

- [ ] Step 1: failing tests

`test/lib/sync.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncApp, runSync, formatSyncMarkdown } from '../../src/lib/sync.mjs';
import { writeApp, readApp, listNews } from '../../src/lib/content.mjs';
import { readState } from '../../src/lib/state.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const upstreamSource = { name: 'S', apps: [{ bundleIdentifier: 'com.up', name: 'Up 2', developerName: 'U', localizedDescription: 'new desc', iconURL: 'https://s/i2.png', subtitle: 'fresh', versions: [version({ version: '2.0', buildVersion: '2', date: '2026-09-02', downloadURL: 'https://gh/d/App-1.9.ipa' }), version({ version: '1.0', buildVersion: '1', downloadURL: 'https://gh/d/App-1.8.ipa' })] }] };
const all = { ...routes, 'https://s/up.json': { json: upstreamSource } };
const ctx = (extra = {}) => ({ cwd: '/', fetch: makeFetch(all), token: '', ...extra });

test('altstore upstream: replaces versions by default, detects the new release, keeps local metadata', async () => {
  const local = app('com.up', { name: 'Local name', versions: [version({ version: '1.0', buildVersion: '1', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'altstore', url: 'https://s/up.json' } });
  const r = await syncApp({ id: 'com.up', app: local }, ctx());
  assert.equal(r.action, 'added');
  assert.deepEqual([r.from, r.to], ['1.0', '2.0']);
  assert.equal(r.app.name, 'Local name');
  assert.equal(r.app.versions.length, 2);
  assert.equal(r.app.subtitle, 'sub');
});

test('altstore upstream: sync "*" copies every field, unchanged when nothing differs, fills missing permissions', async () => {
  const local = app('com.up', { appPermissions: undefined, versions: upstreamSource.apps[0].versions, upstream: { type: 'altstore', url: 'https://s/up.json', sync: '*' } });
  const r = await syncApp({ id: 'com.up', app: local }, ctx());
  assert.equal(r.action, 'updated');
  assert.equal(r.app.name, 'Up 2');
  assert.equal(r.app.bundleIdentifier, 'com.up');
  assert.deepEqual(r.app.appPermissions.entitlements, ['com.apple.developer.siri', 'get-task-allow']);
  const again = await syncApp({ id: 'com.up', app: r.app }, ctx());
  assert.equal(again.action, 'unchanged');
});

test('github upstream: adds the newest release with permissions; unchanged when the asset is already listed', async () => {
  const local = app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'github', repo: 'o/r' } });
  const r = await syncApp({ id: 'com.example.demo', app: local }, ctx());
  assert.equal(r.action, 'added');
  assert.equal(r.version.version, '1.3.0');
  assert.equal(r.version.localizedDescription, 'newer');
  assert.equal(r.version.size, routes['https://api.github.com/repos/o/r/releases?per_page=30'].json[0].assets[0].size);
  assert.deepEqual(r.app.appPermissions.entitlements, ['com.apple.developer.siri', 'get-task-allow']);
  assert.equal((await syncApp({ id: 'com.example.demo', app: r.app }, ctx())).action, 'unchanged');
  const noNotes = await syncApp({ id: 'com.example.demo', app: { ...local, upstream: { type: 'github', repo: 'o/r', notes: 'none' } } }, ctx());
  assert.equal(noNotes.version.localizedDescription, undefined);
});

test('github upstream: wrong bundle id and missing asset become errors, never throws', async () => {
  const r = await syncApp({ id: 'com.other', app: app('com.other', { upstream: { type: 'github', repo: 'o/r' } }) }, ctx());
  assert.equal(r.action, 'error');
  assert.match(r.message, /release asset is com\.example\.demo, expected com\.other/);
  const missing = await syncApp({ id: 'com.x', app: app('com.x', { upstream: { type: 'github', repo: 'o/r', asset: '*.zip' } }) }, ctx());
  assert.equal(missing.action, 'error');
  assert.match(missing.message, /no release asset matches/);
  assert.equal((await syncApp({ id: 'com.x', app: app('com.x') }, ctx())).action, 'skipped');
});

test('adp upstream: adds a new manifest version (with marketplaceID) and is unchanged afterwards', async () => {
  const local = app('com.tsg0o0.cse', { versions: [version({ version: '4.18', buildVersion: '70', downloadURL: 'https://h/adp/old/' })], upstream: { type: 'adp', url: 'https://h/adp/x/' } });
  const r = await syncApp({ id: 'com.tsg0o0.cse', app: local }, ctx());
  assert.equal(r.action, 'added');
  assert.equal(r.app.marketplaceID, '6445840140');
  assert.deepEqual([r.version.version, r.version.buildVersion, r.version.downloadURL, r.version.date], ['4.19', '71', 'https://h/adp/x/', '2026-06-10T07:00:00Z']);
  assert.equal((await syncApp({ id: 'com.tsg0o0.cse', app: r.app }, ctx())).action, 'unchanged');
});

test('runSync writes changed apps, creates one news item per new version, logs, honours only/dryRun', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } });
  await writeApp(dir, app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'github', repo: 'o/r', notify: true } }));
  await writeApp(dir, app('com.static'));
  await writeApp(dir, app('com.broken', { upstream: { type: 'github', repo: 'o/r', asset: '*.zip' } }));
  const dry = await runSync({ cwd: dir, fetch: makeFetch(all), dryRun: true });
  assert.deepEqual(dry.changed, ['com.example.demo']);
  assert.equal((await readApp(dir, 'com.example.demo')).versions.length, 1, 'dry run writes nothing');
  assert.equal(await readState(dir, 'sync-log'), null);
  const only = await runSync({ cwd: dir, fetch: makeFetch(all), only: ['com.broken'] });
  assert.deepEqual(only.results.map((r) => [r.id, r.action]), [['com.broken', 'error']]);
  const real = await runSync({ cwd: dir, fetch: makeFetch(all) });
  assert.deepEqual(real.changed, ['com.example.demo']);
  assert.equal((await readApp(dir, 'com.example.demo')).versions[0].version, '1.3.0');
  const news = await listNews(dir);
  assert.deepEqual(news.map((n) => n.id), ['update-com-example-demo-1-3-0-50']);
  assert.equal(news[0].item.notify, true);
  assert.equal(news[0].item.appID, 'com.example.demo');
  assert.equal(news[0].item.title, 'Example 1.3.0');
  const log = await readState(dir, 'sync-log');
  assert.deepEqual(log.slice(0, 2).map((e) => [e.id, e.action]), [['com.broken', 'error'], ['com.example.demo', 'added']]);
  assert.equal(log.length, 3);
  const again = await runSync({ cwd: dir, fetch: makeFetch(all) });
  assert.deepEqual(again.changed, []);
  assert.equal((await listNews(dir)).length, 1, 'no duplicate news');
});

test('formatSyncMarkdown renders a table', () => {
  const md = formatSyncMarkdown([{ id: 'com.a', action: 'added', from: '1', to: '2' }, { id: 'com.b', action: 'error', message: 'boom | bang' }]);
  assert.match(md, /\| `com\.a` \| added \| 1 → 2 \|/);
  assert.match(md, /boom \\\| bang/);
  assert.match(formatSyncMarkdown([]), /no apps with upstream/);
});
```

- [ ] Step 2: implement

`src/lib/sync.mjs`:
```js
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
```

- [ ] Step 3: green; commit `feat: upstream sync engine`.

---

### Task 4: Status model

**Files:** `src/lib/status.mjs`, `test/lib/status.test.mjs`

**Interfaces:**
- `upstreamState(app, { fetch, token, online }) → null | { type, ref, latest: { version, buildVersion, tag? } | null, state: 'in-sync'|'behind'|'ahead'|'unknown', checkedAt, error? }`. `in-sync` when the upstream's newest matches `versions[0]`; `ahead` when it matches an older local version; `behind` otherwise; `unknown` when offline or the fetch fails.
- `buildStatus({ cwd, fetch, token, online = true, commit, repo }) → status` per spec §8, with `qr.{pal,classic}` as SVG of the universal add link, `linkCheck` from `state/link-check.json`, `recent` = first 20 of `state/sync-log.json`.
- `formatStatusText(status)`, `formatStatusMarkdown(status)`.

- [ ] Step 1: failing tests

`test/lib/status.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatus, upstreamState, formatStatusText, formatStatusMarkdown } from '../../src/lib/status.mjs';
import { writeApp, writeNews } from '../../src/lib/content.mjs';
import { writeState } from '../../src/lib/state.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, news, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const fetch = () => makeFetch(routes);

test('upstreamState: none, in-sync, behind, ahead, unknown, offline', async () => {
  assert.equal(await upstreamState(app('com.x'), { fetch: fetch(), online: true }), null);
  const gh = (versions) => app('com.example.demo', { versions, upstream: { type: 'github', repo: 'o/r' } });
  const v19 = version({ version: '1.3.0', buildVersion: '50', downloadURL: 'https://gh/d/App-1.9.ipa' });
  const v18 = version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' });
  assert.equal((await upstreamState(gh([v19, v18]), { fetch: fetch(), online: true })).state, 'in-sync');
  assert.equal((await upstreamState(gh([v18]), { fetch: fetch(), online: true })).state, 'behind');
  assert.equal((await upstreamState(gh([version({ version: '9', downloadURL: 'https://cdn/9.ipa' }), v19]), { fetch: fetch(), online: true })).state, 'ahead');
  const off = await upstreamState(gh([v18]), { fetch: fetch(), online: false });
  assert.deepEqual([off.state, off.latest, off.type, off.ref], ['unknown', null, 'github', 'https://github.com/o/r']);
  const bad = await upstreamState(app('com.x', { upstream: { type: 'adp', url: 'https://h/adp/missing/' } }), { fetch: fetch(), online: true });
  assert.equal(bad.state, 'unknown');
  assert.match(bad.error, /HTTP 404/);
  const adp = await upstreamState(app('com.tsg0o0.cse', { versions: [version({ version: '4.19', buildVersion: '71', downloadURL: 'https://h/adp/x/' })], upstream: { type: 'adp', url: 'https://h/adp/x/' } }), { fetch: fetch(), online: true });
  assert.deepEqual([adp.state, adp.latest], ['in-sync', { version: '4.19', buildVersion: '71' }]);
  const alt = await upstreamState(app('com.example.demo', { versions: [version({ version: '0.9' })], upstream: { type: 'altstore', url: 'https://s/source.json' } }), { fetch: fetch(), online: true });
  assert.deepEqual([alt.state, alt.latest.version], ['behind', '1.0']);
});

test('buildStatus assembles counts, apps, QR codes, link-check and recent log', async () => {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE } });
  await writeApp(dir, app('com.example.demo', { versions: [version({ version: '1.3.0', buildVersion: '50', downloadURL: 'https://gh/d/App-1.9.ipa' })], upstream: { type: 'github', repo: 'o/r' } }));
  await writeApp(dir, app('com.pal', { marketplaceID: '1', versions: [version({ downloadURL: 'https://h/adp/p/' })] }));
  await writeNews(dir, news('welcome'));
  await writeState(dir, 'link-check', { checkedAt: 'x', total: 3, broken: [] });
  await writeState(dir, 'sync-log', Array.from({ length: 25 }, (_, i) => ({ at: 'x', id: `com.${i}`, action: 'added' })));
  const s = await buildStatus({ cwd: dir, fetch: fetch(), online: true, commit: 'abc', repo: 'STiXzoOR/altsource' });
  assert.deepEqual(s.counts, { apps: 2, pal: 1, classic: 1, news: 1 });
  assert.deepEqual(s.sourceURLs, { pal: `${BASE}source.pal.json`, classic: `${BASE}source.json` });
  assert.match(s.qr.pal, /^<svg/);
  assert.deepEqual(s.apps.map((a) => [a.bundleIdentifier, a.kinds, a.upstream?.state ?? null]), [['com.example.demo', ['ipa'], 'in-sync'], ['com.pal', ['adp'], null]]);
  assert.deepEqual(s.apps[0].latest, { version: '1.3.0', buildVersion: '50', date: '2026-09-01' });
  assert.equal(s.linkCheck.total, 3);
  assert.equal(s.recent.length, 20);
  assert.deepEqual([s.commit, s.repo], ['abc', 'STiXzoOR/altsource']);
  assert.match(formatStatusText(s), /in-sync\s+com\.example\.demo/);
  assert.match(formatStatusMarkdown(s), /\| `com\.pal` \| adp \|/);
});
```

- [ ] Step 2: implement

`src/lib/status.mjs`:
```js
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
```

- [ ] Step 3: green; commit `feat: status model with upstream freshness and QR codes`.

---

### Task 5: `sync`, `check-links`, `status` commands; `serve` writes an offline status

**Files:** `src/cli/sync.mjs`, `src/cli/check-links.mjs`, `src/cli/status.mjs`, `src/cli/serve.mjs` (add `prepare`), `bin/altsource.mjs` (commands + usage), `test/cli/automation.test.mjs`

**Interfaces:**
- `sync [ids…] [--dry-run] [--json] [--markdown]` — text lines `action  id  from → to  news:<id>  message`, `::warning::` annotations for errors under `GITHUB_ACTIONS`; always exit 0.
- `check-links [--write] [--json] [--markdown]` — probes every URL of both outputs; `--write` stores `state/link-check.json`; exit 1 when broken and not `--write`.
- `status [--write] [--out dist] [--json] [--markdown] [--offline]` — `--write` writes `<out>/status.json` (creating the directory); `repo` from `GITHUB_REPOSITORY` or `git remote get-url origin`, `commit` from `GITHUB_SHA` or `git rev-parse HEAD`.
- `serve.mjs`: `prepare({ cwd, outDir })` = `buildAll` + offline status written to `<outDir>/status.json`; `run` uses it.

- [ ] Step 1: failing tests

`test/cli/automation.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run as sync } from '../../src/cli/sync.mjs';
import { run as checkLinks } from '../../src/cli/check-links.mjs';
import { run as status } from '../../src/cli/status.mjs';
import { prepare } from '../../src/cli/serve.mjs';
import { writeApp } from '../../src/lib/content.mjs';
import { makeFetch } from '../helpers/fakefetch.mjs';
import { app, version, root, BASE } from '../helpers/content.mjs';
import { routes } from '../helpers/routes.mjs';

const out = () => ({ text: '', write(s) { this.text += s; } });
async function ctx() {
  const dir = await root({ 'source.meta.json': { name: 'S', baseURL: BASE, iconURL: 'assets/icon.png' }, 'assets/icon.png': 'png:2x2', 'public/index.html': 'x' });
  await writeApp(dir, app('com.example.demo', { versions: [version({ version: '1.2.3', buildVersion: '45', downloadURL: 'https://gh/d/App-1.8.ipa' })], upstream: { type: 'github', repo: 'o/r' } }));
  const o = out();
  const fetch = makeFetch({ ...routes, 'https://dev.example/icon.png': { status: 200 }, 'https://dev.example/s1.png': { status: 404 }, [`${BASE}assets/icon.png`]: { status: 200 } });
  return { cwd: dir, stdout: o, stderr: o, fetch, out: o };
}

test('sync --dry-run reports without writing; sync writes and prints markdown/json', async () => {
  const c = await ctx();
  assert.equal(await sync(['--dry-run'], c), 0);
  assert.match(c.out.text, /added\s+com\.example\.demo\s+1\.2\.3 → 1\.3\.0/);
  assert.match(c.out.text, /1 app\(s\) changed \(dry run/);
  c.out.text = '';
  assert.equal(await sync(['--markdown'], c), 0);
  assert.match(c.out.text, /## Sync\n\n\| App \| Action/);
  assert.equal(JSON.parse(await readFile(`${c.cwd}/apps/com.example.demo.json`, 'utf8')).versions[0].version, '1.3.0');
  c.out.text = '';
  assert.equal(await sync(['--json'], c), 0);
  assert.deepEqual(JSON.parse(c.out.text).changed, []);
});

test('check-links lists broken URLs, exits 1 unless --write, and writes state', async () => {
  const c = await ctx();
  assert.equal(await checkLinks([], c), 1);
  assert.match(c.out.text, /https:\/\/dev\.example\/s1\.png .*404/);
  c.out.text = '';
  assert.equal(await checkLinks(['--write', '--markdown'], c), 0);
  const state = JSON.parse(await readFile(`${c.cwd}/state/link-check.json`, 'utf8'));
  assert.equal(state.broken.length, 1);
  assert.match(c.out.text, /## Link check/);
});

test('status prints the table, --write writes status.json, prepare() writes it offline for serve', async () => {
  const c = await ctx();
  assert.equal(await status(['--write', '--out', 'dist'], c), 0);
  assert.match(c.out.text, /behind\s+com\.example\.demo/);
  const s = JSON.parse(await readFile(`${c.cwd}/dist/status.json`, 'utf8'));
  assert.equal(s.apps[0].upstream.state, 'behind');
  c.out.text = '';
  assert.equal(await status(['--json', '--offline'], c), 0);
  assert.equal(JSON.parse(c.out.text).apps[0].upstream.state, 'unknown');
  await prepare({ cwd: c.cwd, outDir: `${c.cwd}/dist` });
  const local = JSON.parse(await readFile(`${c.cwd}/dist/status.json`, 'utf8'));
  assert.equal(local.apps[0].upstream.state, 'unknown');
  assert.ok((await readFile(`${c.cwd}/dist/source.json`, 'utf8')).includes('com.example.demo'));
});
```

- [ ] Step 2: implement

`src/cli/sync.mjs`:
```js
import { parseArgs } from 'node:util';
import { runSync, formatSyncMarkdown } from '../lib/sync.mjs';

export async function run(argv, { cwd, stdout, stderr, fetch = globalThis.fetch }) {
  const { values, positionals } = parseArgs({ args: argv, options: { 'dry-run': { type: 'boolean', default: false }, json: { type: 'boolean', default: false }, markdown: { type: 'boolean', default: false } }, allowPositionals: true });
  const { results, changed } = await runSync({ cwd, fetch, only: positionals, dryRun: values['dry-run'] });
  if (values.json) stdout.write(JSON.stringify({ results: results.map(({ app, version, ...r }) => r), changed }, null, 2) + '\n');
  else if (values.markdown) stdout.write(`## Sync${values['dry-run'] ? ' (dry run)' : ''}\n\n${formatSyncMarkdown(results)}`);
  else {
    for (const r of results) stdout.write(`${r.action.padEnd(9)} ${r.id}${r.to ? `  ${r.from ?? '-'} → ${r.to}` : ''}${r.news ? `  news:${r.news}` : ''}${r.message ? `  ${r.message}` : ''}\n`);
    stdout.write(`${changed.length} app(s) changed${values['dry-run'] ? ' (dry run, nothing written)' : ''}\n`);
  }
  for (const r of results) if (r.action === 'error') (process.env.GITHUB_ACTIONS ? stdout : stderr).write(process.env.GITHUB_ACTIONS ? `::warning title=sync ${r.id}::${r.message}\n` : `✖ ${r.id}: ${r.message}\n`);
  return 0;
}
```

`src/cli/check-links.mjs`:
```js
import { parseArgs } from 'node:util';
import { loadContent } from '../lib/load.mjs';
import { resolveContent } from '../lib/resolve.mjs';
import { buildOutput, OUTPUTS } from '../lib/build.mjs';
import { collectURLs, checkLinks } from '../lib/links.mjs';
import { writeState } from '../lib/state.mjs';
import { today } from '../lib/content.mjs';

export function formatLinksMarkdown(record) {
  const lines = ['## Link check', '', `${record.broken.length} broken of ${record.total} URL(s) (checked ${record.checkedAt})`, ''];
  if (record.broken.length) { lines.push('| URL | Status | Where |', '|---|---|---|'); for (const b of record.broken) lines.push(`| ${b.url} | ${b.status || 'network error'} | \`${b.where}\` |`); }
  return lines.join('\n') + '\n';
}

export async function run(argv, { cwd, stdout, fetch = globalThis.fetch }) {
  const { values } = parseArgs({ args: argv, options: { write: { type: 'boolean', default: false }, json: { type: 'boolean', default: false }, markdown: { type: 'boolean', default: false } } });
  const raw = await loadContent(cwd);
  const content = await resolveContent(raw, { rootDir: cwd });
  const sources = Object.fromEntries(Object.keys(OUTPUTS).map((n) => [n, buildOutput(content, n)]));
  const { total, broken } = await checkLinks(collectURLs(sources), { fetch });
  const record = { checkedAt: today(), total, broken };
  if (values.write) await writeState(cwd, 'link-check', record);
  if (values.json) stdout.write(JSON.stringify(record, null, 2) + '\n');
  else if (values.markdown) stdout.write(formatLinksMarkdown(record));
  else {
    for (const b of broken) stdout.write(`✖ ${b.url} → ${b.status || 'network error'}  (${b.where})\n`);
    stdout.write(`${broken.length} broken of ${total} URL(s)${values.write ? '; wrote state/link-check.json' : ''}\n`);
  }
  return broken.length > 0 && !values.write ? 1 : 0;
}
```

`src/cli/status.mjs`:
```js
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildStatus, formatStatusText, formatStatusMarkdown } from '../lib/status.mjs';

function git(cwd, ...args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

export function detectRepo(cwd) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const m = /github\.com[:/]([^/]+\/[^/.]+)/.exec(git(cwd, 'remote', 'get-url', 'origin') ?? '');
  return m ? m[1] : null;
}

export async function writeStatus(status, outDir) {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, 'status.json');
  await writeFile(file, JSON.stringify(status, null, 2) + '\n');
  return file;
}

export async function run(argv, { cwd, stdout, fetch = globalThis.fetch }) {
  const { values } = parseArgs({ args: argv, options: { write: { type: 'boolean', default: false }, out: { type: 'string', default: 'dist' }, json: { type: 'boolean', default: false }, markdown: { type: 'boolean', default: false }, offline: { type: 'boolean', default: false } } });
  const status = await buildStatus({ cwd, fetch, online: !values.offline, commit: process.env.GITHUB_SHA ?? git(cwd, 'rev-parse', 'HEAD'), repo: detectRepo(cwd) });
  if (values.write) await writeStatus(status, path.resolve(cwd, values.out));
  if (values.json) stdout.write(JSON.stringify(status, null, 2) + '\n');
  else if (values.markdown) stdout.write(formatStatusMarkdown(status));
  else stdout.write(formatStatusText(status));
  return 0;
}
```

In `src/cli/serve.mjs` add after the imports:
```js
import { buildStatus } from '../lib/status.mjs';
import { writeStatus, detectRepo } from './status.mjs';

/** Build dist/ and an offline status.json so the status page works locally. */
export async function prepare({ cwd, outDir }) {
  const result = await buildAll({ rootDir: cwd, outDir });
  await writeStatus(await buildStatus({ cwd, online: false, repo: detectRepo(cwd) }), outDir);
  return result;
}
```
and in `run` replace `await buildAll({ rootDir: cwd, outDir });` with `await prepare({ cwd, outDir });`.

In `bin/altsource.mjs` add `'sync', 'check-links', 'status'` to `COMMANDS` and these usage lines:
```
  sync       pull new versions from each app's upstream (altsource sync --dry-run)
  check-links probe every URL in both outputs (--write stores state/link-check.json)
  status     local vs upstream versions (--write writes dist/status.json)
```

- [ ] Step 3: green; commit `feat: sync, check-links and status commands`.

---

### Task 6: Status dashboard page

**Files:** `public/status/index.html`, `public/index.html` (footer link to `status/`)

Static page; reads `../status.json`, `../source.pal.json`, `../source.json`. Degrades to "no status.json" when absent.

`public/status/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Status · STiX Apps</title>
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: light dark; --bg: #f6f7fb; --fg: #111827; --muted: #6b7280; --card: #fff; --line: #e5e7eb; --ok: #16a34a; --warn: #d97706; --bad: #dc2626; --info: #2563eb; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b0f19; --fg: #f3f4f6; --muted: #9ca3af; --card: #111827; --line: #1f2937; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 28px 20px 64px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; } h2 { font-size: 1.1rem; margin: 28px 0 10px; }
  .muted { color: var(--muted); } .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0; }
  .tile { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
  .tile b { display: block; font-size: 1.6rem; }
  .sources { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .src { display: flex; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; align-items: center; }
  .src svg { width: 120px; height: 120px; flex: none; background: #fff; border-radius: 8px; }
  .src .url { word-break: break-all; }
  .src button { margin-top: 6px; border: 1px solid var(--line); background: transparent; color: var(--fg); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-top: 1px solid var(--line); vertical-align: top; } th { border-top: 0; color: var(--muted); font-weight: 600; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
  .wrap { overflow-x: auto; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: .75rem; font-weight: 700; color: #fff; background: var(--muted); }
  .badge.in-sync { background: var(--ok); } .badge.behind { background: var(--warn); } .badge.ahead { background: var(--info); } .badge.unknown { background: var(--bad); }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0 0; }
  .actions a { padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: inherit; text-decoration: none; font-weight: 600; }
  .empty { color: var(--muted); padding: 16px; border: 1px dashed var(--line); border-radius: 14px; }
</style>
</head>
<body>
<main>
  <h1 id="title">Status</h1>
  <p class="muted" id="meta">Loading…</p>
  <div class="actions" id="actions" hidden></div>

  <div class="tiles" id="tiles"></div>

  <h2>Sources</h2>
  <div class="sources" id="sources"></div>

  <h2>Apps</h2>
  <div class="wrap"><table id="apps"><thead><tr><th>App</th><th>Kinds</th><th>Local</th><th>Upstream</th><th>State</th><th>Checked</th></tr></thead><tbody></tbody></table></div>
  <p class="empty" id="no-apps" hidden>No apps yet.</p>

  <h2>Recent activity</h2>
  <div class="wrap"><table id="recent"><thead><tr><th>When</th><th>App</th><th>Action</th><th>Version</th><th>Message</th></tr></thead><tbody></tbody></table></div>
  <p class="empty" id="no-recent" hidden>No sync activity recorded.</p>

  <h2>Links</h2>
  <p id="links" class="muted"></p>
  <div class="wrap"><table id="broken" hidden><thead><tr><th>URL</th><th>Status</th><th>Where</th></tr></thead><tbody></tbody></table></div>
</main>
<script>
(async () => {
  const $ = (id) => document.getElementById(id);
  const here = new URL('..', location.href);
  const load = async (f) => { try { const r = await fetch(new URL(f, here), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } };
  const [status, pal, classic] = await Promise.all([load('status.json'), load('source.pal.json'), load('source.json')]);
  const src = pal ?? classic;
  const name = src?.name ?? 'STiX Apps';
  $('title').textContent = `${name} · status`;
  document.title = `Status · ${name}`;
  const universal = (url) => 'https://altstore.io/source/' + url.replace(/^https?:\/\//, '');
  const fmt = (iso) => iso ? iso.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, ' UTC') : '-';
  const label = (l) => l ? `${l.version}${l.buildVersion ? ` (${l.buildVersion})` : ''}` : '-';

  if (!status) {
    $('meta').textContent = 'No status.json next to the sources (run `altsource status --write`, or open the deployed site). Showing the sources only.';
    const apps = [...(pal?.apps ?? []), ...(classic?.apps ?? [])];
    const seen = new Set();
    for (const a of apps) { if (seen.has(a.bundleIdentifier)) continue; seen.add(a.bundleIdentifier); const tr = document.createElement('tr'); tr.innerHTML = `<td></td><td></td><td></td><td>-</td><td><span class="badge">n/a</span></td><td>-</td>`; tr.children[0].textContent = a.name; tr.children[1].textContent = pal?.apps?.includes(a) ? 'adp' : 'ipa'; tr.children[2].textContent = label(a.versions?.[0]); $('apps').tBodies[0].appendChild(tr); }
    $('no-apps').hidden = seen.size > 0; $('no-recent').hidden = false; $('links').textContent = 'No link check recorded.';
    return;
  }

  $('meta').textContent = `generated ${fmt(status.generatedAt)}${status.commit ? ` · commit ${status.commit.slice(0, 7)}` : ''}`;
  if (status.repo) {
    const base = `https://github.com/${status.repo}`;
    $('actions').hidden = false;
    $('actions').innerHTML = [['Repository', base], ['Run sync', `${base}/actions/workflows/sync.yml`], ['Run link check', `${base}/actions/workflows/links.yml`], ['Deploys', `${base}/actions/workflows/deploy.yml`], ['Publish release', `${base}/actions/workflows/release.yml`]].map(([t, u]) => `<a href="${u}">${t}</a>`).join('');
  }
  const c = status.counts;
  const behind = status.apps.filter((a) => a.upstream?.state === 'behind').length;
  const unknown = status.apps.filter((a) => a.upstream?.state === 'unknown').length;
  $('tiles').innerHTML = [['Apps', c.apps], ['PAL', c.pal], ['Classic', c.classic], ['News', c.news], ['Behind upstream', behind], ['Upstream unknown', unknown], ['Broken links', status.linkCheck ? status.linkCheck.broken.length : '-']].map(([t, v]) => `<div class="tile"><span class="muted">${t}</span><b>${v}</b></div>`).join('');

  for (const [key, title] of [['pal', 'AltStore PAL'], ['classic', 'AltStore Classic / SideStore']]) {
    const url = status.sourceURLs[key];
    const div = document.createElement('div'); div.className = 'src';
    div.innerHTML = `${status.qr[key]}<div><b>${title}</b><div class="url mono"></div><button>Copy URL</button> <a class="mono" href="${universal(url)}">add link</a></div>`;
    div.querySelector('.url').textContent = url;
    div.querySelector('button').addEventListener('click', async (e) => { await navigator.clipboard.writeText(url); e.target.textContent = 'Copied'; setTimeout(() => (e.target.textContent = 'Copy URL'), 1200); });
    $('sources').appendChild(div);
  }

  const tb = $('apps').tBodies[0];
  for (const a of status.apps) {
    const up = a.upstream;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><b></b><br><span class="mono muted"></span></td><td></td><td></td><td></td><td></td><td class="muted"></td>`;
    tr.children[0].querySelector('b').textContent = a.name; tr.children[0].querySelector('span').textContent = a.bundleIdentifier;
    tr.children[1].textContent = a.kinds.join(', ');
    tr.children[2].textContent = label(a.latest) + (a.latest?.date ? ` · ${a.latest.date.slice(0, 10)}` : '');
    tr.children[3].innerHTML = up ? `<a class="mono" href="${up.ref}">${up.type}</a> ${label(up.latest)}${up.latest?.tag ? ` <span class="muted">${up.latest.tag}</span>` : ''}${up.error ? `<br><span class="muted">${up.error}</span>` : ''}` : '<span class="muted">none</span>';
    tr.children[4].innerHTML = up ? `<span class="badge ${up.state}">${up.state}</span>` : '<span class="badge">manual</span>';
    tr.children[5].textContent = up ? fmt(up.checkedAt) : '-';
    tb.appendChild(tr);
  }
  $('no-apps').hidden = status.apps.length > 0;

  const rb = $('recent').tBodies[0];
  for (const e of status.recent ?? []) { const tr = document.createElement('tr'); tr.innerHTML = '<td class="muted"></td><td class="mono"></td><td></td><td></td><td class="muted"></td>'; [fmt(e.at), e.id, e.action, e.version ?? '-', e.message ?? ''].forEach((v, i) => (tr.children[i].textContent = v)); rb.appendChild(tr); }
  $('no-recent').hidden = (status.recent ?? []).length > 0;

  if (status.linkCheck) {
    const lc = status.linkCheck;
    $('links').textContent = `${lc.broken.length} broken of ${lc.total} URL(s), checked ${fmt(lc.checkedAt)}`;
    if (lc.broken.length) { $('broken').hidden = false; const bb = $('broken').tBodies[0]; for (const b of lc.broken) { const tr = document.createElement('tr'); tr.innerHTML = '<td class="mono"></td><td></td><td class="mono muted"></td>'; [b.url, b.status || 'network error', b.where].forEach((v, i) => (tr.children[i].textContent = v)); bb.appendChild(tr); } }
  } else $('links').textContent = 'No link check recorded yet.';
})();
</script>
</body>
</html>
```

In `public/index.html`, change the footer to:
```html
  <footer>Built from <a id="website" href="#">the repository</a> · <a href="status/">status</a>. AltStore PAL installs notarized apps in the EU, Japan and Brazil; AltStore Classic and SideStore sideload IPAs everywhere.</footer>
```

- [ ] Step 1: `npm run serve`, open `http://localhost:4173/status/`: tiles, two QR codes, "No apps yet", "No sync activity", "No link check recorded yet". Then `npm test`; commit `feat: status dashboard page`.

---

### Task 7: Workflows

**Files:** `.github/workflows/sync.yml`, `.github/workflows/links.yml`, `.github/workflows/deploy.yml` (status step)

`.github/workflows/sync.yml`:
```yaml
name: Sync
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      apps:
        description: 'Bundle identifiers to sync (space separated; empty = all)'
        required: false
        default: ''
      dry_run:
        description: 'Dry run (report only, no commit)'
        type: boolean
        default: false
concurrency:
  group: content
  cancel-in-progress: false
jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      changed: ${{ steps.commit.outputs.changed }}
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - name: Sync upstreams
        run: node bin/altsource.mjs sync ${{ inputs.apps }} ${{ inputs.dry_run == true && '--dry-run' || '' }} --markdown | tee -a "$GITHUB_STEP_SUMMARY"
      - name: Validate and build
        if: ${{ inputs.dry_run != true }}
        run: npm run validate && npm run build
      - name: Commit
        id: commit
        if: ${{ inputs.dry_run != true }}
        run: |
          if [ -n "$(git status --porcelain apps news state)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            FILES=$(git status --porcelain apps news | sed 's/^...//' | sed 's/^/- /')
            git add apps news state
            git commit -m "chore(sync): update apps from upstream" -m "$FILES"
            git push
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi
  deploy:
    needs: sync
    if: needs.sync.outputs.changed == 'true'
    permissions:
      contents: read
      pages: write
      id-token: write
    uses: ./.github/workflows/deploy.yml
```

`.github/workflows/links.yml`:
```yaml
name: Link check
on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:
concurrency:
  group: content
  cancel-in-progress: false
jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    outputs:
      changed: ${{ steps.commit.outputs.changed }}
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - name: Check links
        run: node bin/altsource.mjs check-links --write --markdown | tee -a "$GITHUB_STEP_SUMMARY"
      - name: Commit state
        id: commit
        run: |
          if [ -n "$(git status --porcelain state)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add state
            git commit -m "chore(links): record link check"
            git push
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi
      - name: Open, update or close the issue
        run: |
          gh label create link-check --description "Automated link check" --color D93F0B --force >/dev/null 2>&1 || true
          BROKEN=$(node -e "console.log(require('./state/link-check.json').broken.length)")
          BODY=$(node -e "const s=require('./state/link-check.json');console.log(s.broken.map(b=>'- '+b.url+' → '+(b.status||'network error')+' ('+b.where+')').join('\n'))")
          EXISTING=$(gh issue list --label link-check --state open --json number -q '.[0].number')
          if [ "$BROKEN" != "0" ]; then
            if [ -n "$EXISTING" ]; then
              gh issue comment "$EXISTING" --body "Still broken as of $(date -u +%F):"$'\n\n'"$BODY"
            else
              gh issue create --title "Broken links in the source" --label link-check --body "The weekly link check found URLs that no longer respond:"$'\n\n'"$BODY"
            fi
          elif [ -n "$EXISTING" ]; then
            gh issue close "$EXISTING" --comment "All links respond again."
          fi
  deploy:
    needs: check
    if: needs.check.outputs.changed == 'true'
    permissions:
      contents: read
      pages: write
      id-token: write
    uses: ./.github/workflows/deploy.yml
```

In `.github/workflows/deploy.yml`, after `- run: npm run build` add:
```yaml
      - name: Status
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          node bin/altsource.mjs status --write
          node bin/altsource.mjs status --offline --markdown >> "$GITHUB_STEP_SUMMARY"
```
(The second call renders the table without a second round of network calls; the written `status.json` is the online one.)

- [ ] Step 1: write the three files; `npm test`; commit `ci: sync and link-check workflows, status in deploy`.

---

### Task 8: README, merge, deploy, exercise the workflows

- [ ] Step 1: README — add an "Automation" section: what `sync.yml` does (every 6 h, `--upstream` apps only, commits + redeploys, news per update, `notify` opt-in per app via `upstream.notify`), `links.yml` (weekly, issue labelled `link-check`), the status page URL, `state/` files, and how to run each manually (`gh workflow run Sync`, `gh workflow run "Link check"`, or the buttons on the status page). Mention the `upstream` keys table: `type`, `url`/`repo`, `asset`, `prerelease`, `notes`, `sync`, `news`, `notify`.
- [ ] Step 2: `npm test`, `npm run validate`, `npm run build`; commit `docs: automation`.
- [ ] Step 3: merge `m3-automation` into `main`, push, watch Deploy; confirm `https://stixzoor.github.io/altsource/status.json` and `…/status/` respond.
- [ ] Step 4: `gh workflow run Sync` and `gh workflow run "Link check"`; watch both to success; confirm the sync summary says "no apps with upstream" and the link check committed `state/link-check.json` with 0 broken and triggered a deploy.
