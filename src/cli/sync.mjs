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
