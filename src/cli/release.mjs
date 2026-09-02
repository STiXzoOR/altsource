import path from 'node:path';
import { parseArgs } from 'node:util';
import { readApp, writeApp, prependVersion, today } from '../lib/content.mjs';
import { parseManifest, versionFromManifest } from '../lib/adp.mjs';
import { readADPDir } from '../lib/adp-archive.mjs';
import { publishRelease, releaseBase } from '../lib/release.mjs';
import { detectRepo } from './status.mjs';
import { reportFileIssues, UsageError } from './inputs.mjs';

const USAGE = `usage:
  altsource release publish <bundleId> --adp-dir DIR --tag TAG [--repo owner/name] [--notes TEXT] [--date ISO] [--force] [--dry-run]

Uploads manifest.json, signature, variant/*.ipa and delta/*.ipa to a GitHub Release (gh must be
authenticated), then prepends the version with assetURLs to apps/<bundleId>.json.
`;

async function publish(argv, ctx) {
  const { values, positionals } = parseArgs({ args: argv, options: { 'adp-dir': { type: 'string' }, tag: { type: 'string' }, repo: { type: 'string' }, notes: { type: 'string' }, date: { type: 'string' }, force: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false } }, allowPositionals: true });
  const id = positionals[0];
  if (!id) throw new UsageError('bundleId is required');
  if (!values['adp-dir'] || !values.tag) throw new UsageError('--adp-dir DIR and --tag TAG are required');
  const repo = values.repo ?? detectRepo(ctx.cwd);
  if (!repo) throw new UsageError('--repo owner/name is required (no GitHub remote detected)');
  const file = `apps/${id}.json`;
  const app = await readApp(ctx.cwd, id);
  if (!app) throw new UsageError(`${file} does not exist; use \`altsource app add\` first`);
  const { manifest, files, warnings } = await readADPDir(path.resolve(ctx.cwd, values['adp-dir']));
  const parsed = parseManifest(manifest);
  if (parsed.bundleIdentifier && parsed.bundleIdentifier !== id) throw new UsageError(`the ADP is ${parsed.bundleIdentifier}, not ${id}`);
  for (const w of warnings) ctx.stdout.write(`note: ${w}\n`);
  const base = releaseBase(repo, values.tag);
  const version = versionFromManifest(parsed, { manifestURL: `${base}/manifest.json`, date: values.date ?? today(), notes: values.notes, releaseBase: base });
  let next = { ...app };
  if (!next.marketplaceID && parsed.marketplaceID) next.marketplaceID = parsed.marketplaceID;
  next = prependVersion(next, version, { force: values.force });
  if (values['dry-run']) {
    ctx.stdout.write(`would upload ${files.length} file(s) to ${base}/ and add:\n${JSON.stringify(version, null, 2)}\n`);
    return 0;
  }
  const r = await publishRelease({ repo, tag: values.tag, notes: values.notes ?? `${app.name} ${version.version}`, files, exec: ctx.exec });
  ctx.stdout.write(`${r.created ? 'created' : 'updated'} release ${values.tag} with ${files.length} file(s)\n`);
  await writeApp(ctx.cwd, next);
  ctx.stdout.write(`added ${version.version}${version.buildVersion ? ` (${version.buildVersion})` : ''} [adp] to ${file}\n`);
  return (await reportFileIssues(file, ctx)) > 0 ? 1 : 0;
}

export async function run(argv, ctx) {
  const [sub, ...rest] = argv;
  if (sub !== 'publish') { ctx.stderr.write(USAGE); return 1; }
  try {
    return await publish(rest, ctx);
  } catch (e) {
    ctx.stderr.write(`✖ ${e.message}\n`);
    return 1;
  }
}
