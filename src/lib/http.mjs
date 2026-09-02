import { readFile } from 'node:fs/promises';
import path from 'node:path';

export function githubHeaders(token = process.env.GITHUB_TOKEN) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchJSON(url, { fetch = globalThis.fetch, headers = {} } = {}) {
  const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

export async function fetchBuffer(url, { fetch = globalThis.fetch, headers = {} } = {}) {
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return { buffer: Buffer.from(await res.arrayBuffer()), lastModified: res.headers?.get?.('last-modified') ?? null };
}

/** Bytes from a local path (relative to cwd) or an https URL. */
export async function loadBytes(pathOrURL, { cwd, fetch = globalThis.fetch } = {}) {
  if (/^https?:\/\//i.test(pathOrURL)) {
    const { buffer } = await fetchBuffer(pathOrURL, { fetch });
    return { buffer, source: 'url', url: pathOrURL };
  }
  return { buffer: await readFile(path.resolve(cwd ?? process.cwd(), pathOrURL)), source: 'file' };
}
