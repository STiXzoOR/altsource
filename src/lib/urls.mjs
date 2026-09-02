export const URL_KEYS = new Set(['iconURL', 'headerURL', 'website', 'patreonURL', 'downloadURL', 'imageURL', 'url']);

export function isAbsoluteURL(value) {
  if (typeof value !== 'string') return false;
  try { new URL(value); return true; } catch { return false; }
}

export function isAbsoluteHttps(value) {
  return isAbsoluteURL(value) && new URL(value).protocol === 'https:';
}

export function resolveURL(value, baseURL) {
  if (isAbsoluteURL(value)) return value;
  return new URL(value.replace(/^\.\//, ''), baseURL).href;
}

function mapScreenshots(node, fn, path) {
  if (Array.isArray(node)) {
    return node.map((item, i) => (typeof item === 'string' ? fn(item, `${path}/${i}`) : mapURLs(item, fn, `${path}/${i}`)));
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([device, list]) => [device, mapScreenshots(list, fn, `${path}/${device}`)]));
  }
  return node;
}

/** Deep-copies an AltStore object, replacing every URL-bearing string with fn(value, jsonPointer). */
export function mapURLs(node, fn, path = '') {
  if (Array.isArray(node)) return node.map((item, i) => mapURLs(item, fn, `${path}/${i}`));
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    const p = `${path}/${key}`;
    if (URL_KEYS.has(key) && typeof value === 'string') out[key] = fn(value, p);
    else if (key === 'screenshots') out[key] = mapScreenshots(value, fn, p);
    else if (key === 'assetURLs' && value && typeof value === 'object') {
      out[key] = Object.fromEntries(Object.entries(value).map(([name, u]) => [name, typeof u === 'string' ? fn(u, `${p}/${name}`) : u]));
    } else out[key] = mapURLs(value, fn, p);
  }
  return out;
}
