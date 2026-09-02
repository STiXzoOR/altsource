import { mapURLs } from './urls.mjs';

/** Unique URLs across built outputs: [{ url, where: '<output>#<pointer>' }] (first occurrence wins). */
export function collectURLs(sources) {
  const seen = new Map();
  for (const [name, source] of Object.entries(sources)) {
    mapURLs(source, (url, pointer) => {
      if (!seen.has(url)) seen.set(url, `${name}#${pointer}`);
      return url;
    });
  }
  return [...seen].map(([url, where]) => ({ url, where }));
}

async function probe(url, fetch, timeoutMs) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: method === 'GET' ? { Range: 'bytes=0-0' } : {},
      });
      if (method === 'HEAD' && [403, 404, 405].includes(res.status)) continue;
      return res.status;
    } catch {
      if (method === 'GET') return 0;
    }
  }
  return 0;
}

/** { total, broken: [{ url, where, status }] }; status 0 means a network error. */
export async function checkLinks(entries, { fetch = globalThis.fetch, concurrency = 8, timeoutMs = 10000 } = {}) {
  const broken = [];
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const entry = entries[next++];
      const status = await probe(entry.url, fetch, timeoutMs);
      if (status < 200 || status >= 400) broken.push({ ...entry, status });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  broken.sort((a, b) => a.url.localeCompare(b.url));
  return { total: entries.length, broken };
}
