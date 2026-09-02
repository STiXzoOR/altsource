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
