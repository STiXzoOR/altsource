import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export class LoadError extends Error {
  constructor(message, file) {
    super(message);
    this.name = 'LoadError';
    this.file = file;
  }
}

async function readJSON(rootDir, rel) {
  let text;
  try {
    text = await readFile(path.join(rootDir, rel), 'utf8');
  } catch (e) {
    throw new LoadError(`cannot read ${rel}: ${e.message}`, rel);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new LoadError(`invalid JSON in ${rel}: ${e.message}`, rel);
  }
}

async function readJSONDir(rootDir, dir) {
  let names;
  try {
    names = await readdir(path.join(rootDir, dir));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const files = names.filter((n) => n.endsWith('.json')).sort();
  return Promise.all(files.map(async (n) => ({
    file: `${dir}/${n}`,
    name: n.slice(0, -'.json'.length),
    data: await readJSON(rootDir, `${dir}/${n}`),
  })));
}

/** { meta, apps: [{ file, name, data }], news: [{ file, name, data }] } */
export async function loadContent(rootDir) {
  const meta = await readJSON(rootDir, 'source.meta.json');
  const [apps, news] = await Promise.all([readJSONDir(rootDir, 'apps'), readJSONDir(rootDir, 'news')]);
  return { meta, apps, news };
}
