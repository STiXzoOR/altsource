import { parseArgs } from 'node:util';
import { federateSource } from '../lib/altstore-api.mjs';
import { readMeta } from '../lib/content.mjs';
import { UsageError } from './inputs.mjs';

export async function run(argv, ctx) {
  try {
    const { values } = parseArgs({ args: argv, options: { 'source-url': { type: 'string' } } });
    let url = values['source-url'];
    if (!url) {
      const meta = await readMeta(ctx.cwd);
      if (!meta) throw new UsageError('source.meta.json not found');
      if (!meta.fediUsername) throw new UsageError('set fediUsername in source.meta.json first (it cannot be changed later), deploy, then federate');
      url = new URL('source.pal.json', meta.baseURL).href;
    }
    await federateSource(url, { fetch: ctx.fetch });
    ctx.stdout.write(`federated ${url}; it will appear on https://explore.alt.store/\n`);
    return 0;
  } catch (e) {
    ctx.stderr.write(`✖ ${e.message}\n`);
    return 1;
  }
}
