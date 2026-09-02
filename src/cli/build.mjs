import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildAll, BuildError } from '../lib/build.mjs';
import { LoadError } from '../lib/load.mjs';
import { formatIssues } from './format.mjs';

export async function run(argv, { cwd, stdout, stderr }) {
  const { values } = parseArgs({ args: argv, options: { out: { type: 'string', default: 'dist' } } });
  const outDir = path.resolve(cwd, values.out);
  try {
    const { outputs, warnings } = await buildAll({ rootDir: cwd, outDir });
    if (warnings.length > 0) stdout.write(formatIssues({ errors: [], warnings }));
    for (const [name, o] of Object.entries(outputs)) {
      stdout.write(`${name.padEnd(8)} ${o.file}: ${o.apps} app(s), ${o.news} news item(s)\n`);
    }
    stdout.write(`built ${path.relative(cwd, outDir) || '.'}/\n`);
    return 0;
  } catch (e) {
    if (e instanceof BuildError) { stderr.write(formatIssues(e.issues)); return 1; }
    if (e instanceof LoadError) { stderr.write(`✖ ${e.message}\n`); return 1; }
    throw e;
  }
}
