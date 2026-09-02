import { parseArgs } from 'node:util';
import { newsExists, writeNews, slugify, today } from '../lib/content.mjs';
import { reportFileIssues, UsageError } from './inputs.mjs';

const USAGE = `usage:
  altsource news add --title TEXT --caption TEXT [--id ID] [--date ISO] [--app BUNDLE_ID]
                     [--url URL] [--image URL] [--notify] [--tint HEX] [--force]
`;

async function add(argv, ctx) {
  const { values } = parseArgs({ args: argv, options: { title: { type: 'string' }, caption: { type: 'string' }, id: { type: 'string' }, date: { type: 'string' }, app: { type: 'string' }, url: { type: 'string' }, image: { type: 'string' }, notify: { type: 'boolean', default: false }, tint: { type: 'string' }, force: { type: 'boolean', default: false } } });
  if (!values.title || !values.caption) throw new UsageError('--title and --caption are required');
  const identifier = values.id ?? slugify(values.title);
  const file = `news/${identifier}.json`;
  if (!values.force && (await newsExists(ctx.cwd, identifier))) throw new UsageError(`${file} already exists; use --force to replace it`);
  const item = { title: values.title, identifier, caption: values.caption, date: values.date ?? today(), tintColor: values.tint, imageURL: values.image, notify: values.notify || undefined, url: values.url, appID: values.app };
  for (const k of Object.keys(item)) if (item[k] === undefined) delete item[k];
  await writeNews(ctx.cwd, item);
  ctx.stdout.write(`added ${file}\n`);
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
