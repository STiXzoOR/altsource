import { parseArgs } from 'node:util';
import { loadContent, LoadError } from '../lib/load.mjs';
import { validateContent } from '../lib/validate.mjs';
import { resolveContent } from '../lib/resolve.mjs';
import { buildOutput, OUTPUTS } from '../lib/build.mjs';
import { collectURLs, checkLinks } from '../lib/links.mjs';
import { formatIssues } from './format.mjs';

export async function run(argv, { cwd, stdout, stderr, fetch = globalThis.fetch }) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'check-urls': { type: 'boolean', default: false },
      'check-urls-warn': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
  });
  let raw;
  try {
    raw = await loadContent(cwd);
  } catch (e) {
    if (e instanceof LoadError) { stderr.write(`✖ ${e.message}\n`); return 1; }
    throw e;
  }
  const issues = await validateContent(raw, { rootDir: cwd });
  const soft = values['check-urls-warn'];
  if ((values['check-urls'] || soft) && issues.errors.length === 0) {
    const content = await resolveContent(raw, { rootDir: cwd });
    const sources = Object.fromEntries(Object.keys(OUTPUTS).map((name) => [name, buildOutput(content, name)]));
    const { broken } = await checkLinks(collectURLs(sources), { fetch });
    for (const b of broken) {
      (soft ? issues.warnings : issues.errors).push({
        code: soft ? 'W08' : 'E19',
        path: b.where,
        message: `${b.url} responded ${b.status === 0 ? 'with a network error' : `HTTP ${b.status}`}`,
      });
    }
  }
  if (values.json) stdout.write(JSON.stringify(issues, null, 2) + '\n');
  else stdout.write(formatIssues(issues));
  return issues.errors.length > 0 ? 1 : 0;
}
