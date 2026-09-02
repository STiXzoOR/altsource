import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const file = (rootDir, name) => path.join(rootDir, 'state', `${name}.json`);

export async function readState(rootDir, name, fallback = null) {
  try { return JSON.parse(await readFile(file(rootDir, name), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}

export async function writeState(rootDir, name, data) {
  const p = file(rootDir, name);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2) + '\n');
  return p;
}

/** Prepend entries (newest first) to state/<name>.json, keeping at most max. */
export async function appendLog(rootDir, name, entries, { max = 100 } = {}) {
  const existing = (await readState(rootDir, name, [])) ?? [];
  const next = [...entries, ...existing].slice(0, max);
  await writeState(rootDir, name, next);
  return next;
}
