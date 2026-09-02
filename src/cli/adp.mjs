import path from 'node:path';
import { parseArgs } from 'node:util';
import { adpStatus, processADP, registerDeveloper } from '../lib/altstore-api.mjs';
import { downloadADP } from '../lib/adp-archive.mjs';
import { UsageError } from './inputs.mjs';

const USAGE = `usage:
  altsource adp status <adpId> [--json]
  altsource adp process <adpId>
  altsource adp download <adpId> --out DIR [--wait] [--interval SECONDS]
  altsource adp register --developer-id ID --email EMAIL

The ADP ID comes from App Store Connect (Get an Alternative Distribution Package ID).
ALTSTORE_API_BASE overrides https://api.altstore.io.
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const requireId = (positionals) => { if (!positionals[0]) throw new UsageError('adpId is required'); return positionals[0]; };

async function status(argv, ctx) {
  const { values, positionals } = parseArgs({ args: argv, options: { json: { type: 'boolean', default: false } }, allowPositionals: true });
  const r = (await adpStatus(requireId(positionals), { fetch: ctx.fetch })) ?? {};
  if (values.json) ctx.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else ctx.stdout.write(r.downloadURL ? `ready: ${r.downloadURL}\n` : `processing: ${r.status ?? JSON.stringify(r)}\n`);
  return 0;
}

async function process_(argv, ctx) {
  const { positionals } = parseArgs({ args: argv, options: {}, allowPositionals: true });
  const id = requireId(positionals);
  const r = await processADP(id, { fetch: ctx.fetch });
  ctx.stdout.write(`processing requested for ${id}${r && Object.keys(r).length ? `: ${JSON.stringify(r)}` : ''}\n`);
  return 0;
}

async function download(argv, ctx) {
  const { values, positionals } = parseArgs({ args: argv, options: { out: { type: 'string' }, wait: { type: 'boolean', default: false }, interval: { type: 'string', default: '30' } }, allowPositionals: true });
  const id = requireId(positionals);
  if (!values.out) throw new UsageError('--out DIR is required');
  let r = (await adpStatus(id, { fetch: ctx.fetch })) ?? {};
  while (!r.downloadURL) {
    if (!values.wait) throw new UsageError(`ADP ${id} is still processing (${r.status ?? 'unknown status'}); retry later or pass --wait`);
    ctx.stdout.write(`still processing (${r.status ?? 'unknown'}); checking again in ${values.interval}s\n`);
    await (ctx.sleep ?? sleep)(Number(values.interval) * 1000);
    r = (await adpStatus(id, { fetch: ctx.fetch })) ?? {};
  }
  const { files } = await downloadADP(r.downloadURL, path.resolve(ctx.cwd, values.out), { fetch: ctx.fetch });
  ctx.stdout.write(`extracted ${files} file(s) into ${values.out}\n`);
  return 0;
}

async function register(argv, ctx) {
  const { values } = parseArgs({ args: argv, options: { 'developer-id': { type: 'string' }, email: { type: 'string' } } });
  if (!values['developer-id'] || !values.email) throw new UsageError('--developer-id and --email are required');
  const r = await registerDeveloper({ developerID: values['developer-id'], email: values.email }, { fetch: ctx.fetch });
  ctx.stdout.write(`token: ${r.token}\nexpires: ${r.expiration}\nPaste the token in App Store Connect → Users and Access → Integrations → Marketplace.\n`);
  return 0;
}

export async function run(argv, ctx) {
  const [sub, ...rest] = argv;
  const handlers = { status, process: process_, download, register };
  if (!handlers[sub]) { ctx.stderr.write(USAGE); return 1; }
  try {
    return await handlers[sub](rest, ctx);
  } catch (e) {
    ctx.stderr.write(`✖ ${e.message}\n`);
    return 1;
  }
}
