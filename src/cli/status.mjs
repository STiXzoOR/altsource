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
