/** routes: { [url]: { json?: any, bytes?: Buffer|string, status?: number, headers?: object } }. Records calls in fetch.calls. */
export function makeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {} });
    const key = Object.keys(routes).find((k) => (k.endsWith('*') ? url.startsWith(k.slice(0, -1)) : url === k));
    const r = key ? routes[key] : { status: 404 };
    const status = r.status ?? 200;
    const body = r.bytes !== undefined ? Buffer.from(r.bytes) : Buffer.from(JSON.stringify(r.json ?? null));
    return {
      ok: status >= 200 && status < 300, status, headers: new Headers(r.headers ?? {}),
      json: async () => JSON.parse(body.toString('utf8')),
      text: async () => body.toString('utf8'),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  fetch.calls = calls;
  return fetch;
}
