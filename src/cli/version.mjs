import { parseArgs } from 'node:util';
import { readApp, writeApp, prependVersion } from '../lib/content.mjs';
import { inferKind } from '../lib/kinds.mjs';
import { SOURCE_OPTIONS, resolvePackage, sourceKind, reportFileIssues, UsageError } from './inputs.mjs';

const USAGE = `usage:
  altsource version add <bundleId> (--from-github owner/repo | --from-adp URL | --from-ipa PATH|URL)
                        [--asset GLOB] [--tag TAG] [--prerelease] [--release BASE_URL]
                        [--download-url URL] [--notes TEXT] [--date ISO] [--force]
`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function add(argv, ctx) {
  const { values, positionals } = parseArgs({ args: argv, options: { ...SOURCE_OPTIONS, force: { type: 'boolean', default: false } }, allowPositionals: true });
  const id = positionals[0];
  if (!id) throw new UsageError('bundleId is required');
  const kind = sourceKind(values);
  if (!kind || kind === 'from-source') throw new UsageError('one of --from-github, --from-adp, --from-ipa is required');
  const file = `apps/${id}.json`;
  const app = await readApp(ctx.cwd, id);
  if (!app) throw new UsageError(`${file} does not exist; use \`altsource app add\` first`);
  const pkg = await resolvePackage(values, ctx);
  let next = app;
  if (pkg.kind === 'ipa') {
    if (pkg.ipa.bundleIdentifier !== id) throw new UsageError(`the IPA is ${pkg.ipa.bundleIdentifier}, not ${id}`);
    const perms = { entitlements: pkg.ipa.entitlements, privacy: pkg.ipa.privacy };
    if (!same(perms, app.appPermissions)) { next = { ...next, appPermissions: perms }; ctx.stdout.write(`appPermissions updated from the IPA (${perms.entitlements.length} entitlement(s), ${Object.keys(perms.privacy).length} privacy key(s))\n`); }
  } else if (pkg.manifest.bundleIdentifier !== id) {
    throw new UsageError(`the ADP is ${pkg.manifest.bundleIdentifier}, not ${id}`);
  }
  next = prependVersion(next, pkg.version, { force: values.force });
  await writeApp(ctx.cwd, next);
  const v = pkg.version;
  ctx.stdout.write(`added ${v.version}${v.buildVersion ? ` (${v.buildVersion})` : ''} [${inferKind(v)}] to ${file}\n`);
  return (await reportFileIssues(file, ctx)) > 0 ? 1 : 0;
}

export async function run(argv, ctx) {
  const [sub, ...rest] = argv;
  if (sub !== 'add') { ctx.stderr.write(USAGE); return 1; }
  try {
    return await add(rest, ctx);
  } catch (e) {
    ctx.stderr.write(`✖ ${e.message}\n`);
    return 1;
  }
}
