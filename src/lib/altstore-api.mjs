const base = () => (process.env.ALTSTORE_API_BASE ?? 'https://api.altstore.io').replace(/\/+$/, '');

async function call(method, path, body, { fetch = globalThis.fetch } = {}) {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}${data?.error ? `: ${data.error}` : text ? `: ${text.slice(0, 200)}` : ''}`);
  return data;
}

/** POST /register → { token, expiration }; the token goes into App Store Connect → Integrations → Marketplace. */
export const registerDeveloper = ({ developerID, email }, opts) => call('POST', '/register', { developerID, email }, opts);
/** GET /adps/:id → { status } while processing, { downloadURL } when ready. */
export const adpStatus = (adpID, opts) => call('GET', `/adps/${encodeURIComponent(adpID)}`, null, opts);
/** POST /adps { adpID } — ask AltStore PAL to process a notarized ADP. */
export const processADP = (adpID, opts) => call('POST', '/adps', { adpID }, opts);
/** POST /federate { source } — list the source on explore.alt.store. */
export const federateSource = (source, opts) => call('POST', '/federate', { source }, opts);
