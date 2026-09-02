import { fetchBuffer } from './http.mjs';

/** Directory URL of an ADP (trailing slash, no query/hash) from a manifest, directory, or bare URL. */
export function adpRootURL(url) {
  const u = new URL(url);
  if (u.pathname.endsWith('/manifest.json')) u.pathname = u.pathname.slice(0, -'manifest.json'.length);
  else if (!u.pathname.endsWith('/')) u.pathname += '/';
  u.search = '';
  u.hash = '';
  return u.href;
}

const baseName = (p) => p.split('/').pop();

export function parseManifest(m) {
  if (!m || typeof m !== 'object' || !Array.isArray(m.variants)) throw new Error('not an ADP manifest: "variants" missing');
  const variants = m.variants.map((v) => ({ id: v.publicId, file: baseName(v.assetPath ?? ''), size: v.variantDetails?.compressedSize ?? 0 }));
  const deltas = (m.deltas ?? []).map((d) => ({ id: d.publicId, file: baseName(d.assetPath ?? '') }));
  return {
    bundleIdentifier: m.bundleId,
    marketplaceID: m.appleItemId == null ? undefined : String(m.appleItemId),
    version: m.shortVersionString,
    buildVersion: m.bundleVersion == null ? undefined : String(m.bundleVersion),
    minOSVersion: m.minimumSystemVersions?.ios,
    size: Math.max(0, ...variants.map((v) => v.size)),
    variants,
    deltas,
  };
}

export function versionFromManifest(parsed, { manifestURL, date, notes, releaseBase }) {
  const v = { version: parsed.version, buildVersion: parsed.buildVersion, date, localizedDescription: notes, downloadURL: adpRootURL(manifestURL), size: parsed.size, minOSVersion: parsed.minOSVersion };
  if (releaseBase) {
    const base = releaseBase.replace(/\/+$/, '');
    v.assetURLs = { manifest: `${base}/manifest.json`, signature: `${base}/signature` };
    for (const f of [...parsed.variants, ...parsed.deltas]) v.assetURLs[f.file.replace(/\.[^.]+$/, '')] = `${base}/${f.file}`;
  }
  for (const k of Object.keys(v)) if (v[k] === undefined) delete v[k];
  return v;
}

export async function fetchManifest(url, { fetch } = {}) {
  const manifestURL = url.endsWith('manifest.json') ? url : `${adpRootURL(url)}manifest.json`;
  const { buffer, lastModified } = await fetchBuffer(manifestURL, { fetch });
  let manifest;
  try { manifest = JSON.parse(buffer.toString('utf8')); } catch { throw new Error(`${manifestURL} is not JSON`); }
  return { manifest, manifestURL, lastModified };
}
