import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { mapURLs, resolveURL } from './urls.mjs';
import { localPath } from './validate.mjs';
import { imageSize } from './images.mjs';

async function localDims(value, rootDir) {
  const rel = typeof value === 'string' ? localPath(value) : null;
  if (!rel) return null;
  try { return imageSize(await readFile(path.join(rootDir, rel))); } catch { return null; }
}

async function fillList(original, resolved, rootDir) {
  const out = [];
  for (const [i, item] of original.entries()) {
    const res = resolved[i];
    if (item && typeof item === 'object' && Number.isInteger(item.width) && Number.isInteger(item.height)) { out.push(res); continue; }
    const dims = await localDims(typeof item === 'string' ? item : item?.imageURL, rootDir);
    if (!dims) { out.push(res); continue; }
    const base = typeof res === 'string' ? { imageURL: res } : res;
    out.push({ ...base, width: dims.width, height: dims.height });
  }
  return out;
}

/** Adds width/height to screenshots that point at local PNG/JPEG files under assets/. */
export async function fillScreenshotDims(original, resolved, rootDir) {
  if (Array.isArray(original)) return fillList(original, resolved, rootDir);
  if (original && typeof original === 'object') {
    const out = {};
    for (const device of Object.keys(original)) {
      out[device] = Array.isArray(original[device]) ? await fillList(original[device], resolved[device], rootDir) : resolved[device];
    }
    return out;
  }
  return resolved;
}

/** Deep copy of the loadContent() shape with absolute URLs and screenshot dimensions filled. */
export async function resolveContent(content, { rootDir }) {
  const base = content.meta.baseURL;
  const resolveAll = (obj) => mapURLs(obj, (value) => resolveURL(value, base));
  const meta = resolveAll(content.meta);
  const news = content.news.map((n) => ({ ...n, data: resolveAll(n.data) }));
  const apps = [];
  for (const a of content.apps) {
    const data = resolveAll(a.data);
    if (a.data.screenshots !== undefined) data.screenshots = await fillScreenshotDims(a.data.screenshots, data.screenshots, rootDir);
    apps.push({ ...a, data });
  }
  return { meta, apps, news };
}
