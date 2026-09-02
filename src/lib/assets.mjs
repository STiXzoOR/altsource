import sharp from 'sharp';

export const ICON_SIZE = 1024;
export const ICON_PNG_MAX_BYTES = 300 * 1024;
export const SHOT_MAX_HEIGHT = 1600;

/**
 * Square, opaque 1024 px icon from any raster; non-square input is cover-cropped around the centre.
 * PNG when that stays under 300 KB, otherwise JPEG (icons are opaque, so nothing is lost but bytes).
 */
export async function normalizeIcon(buffer) {
  const square = sharp(buffer).resize(ICON_SIZE, ICON_SIZE, { fit: 'cover', position: 'centre' }).flatten({ background: '#ffffff' }).removeAlpha();
  const png = await square.clone().png({ palette: false, compressionLevel: 9 }).toBuffer();
  if (png.length <= ICON_PNG_MAX_BYTES) return { data: png, width: ICON_SIZE, height: ICON_SIZE, ext: 'png' };
  const jpg = await square.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { data: jpg, width: ICON_SIZE, height: ICON_SIZE, ext: 'jpg' };
}

/** JPEG no taller than 1600 px, aspect kept, never enlarged. */
export async function normalizeScreenshot(buffer) {
  const data = await sharp(buffer)
    .resize({ height: SHOT_MAX_HEIGHT, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const { width, height } = await sharp(data).metadata();
  return { data, width, height, ext: 'jpg' };
}

/** Repo-relative locations of an app's vendored assets. */
export const assetDir = (id) => `assets/apps/${id}`;
export const iconPath = (id, ext = 'png') => `${assetDir(id)}/icon.${ext}`;
export const shotPath = (id, device, n) => `${assetDir(id)}/${device}-${n}.jpg`;

const groups = (value) => (Array.isArray(value) ? { iphone: value, ipad: [] } : { iphone: value?.iphone ?? [], ipad: value?.ipad ?? [] });

/**
 * New `screenshots` value. Existing entries stay as they are (strings or objects); new ones are appended per device.
 * With `replace`, a device group is cleared before appending when new entries exist for it. Returns the list form
 * when only iPhone entries exist, the `{ iphone, ipad }` form otherwise, `undefined` when nothing is left.
 */
export function mergeScreenshots(existing, added = {}, { replace = false } = {}) {
  const cur = groups(existing);
  const merged = {};
  for (const device of ['iphone', 'ipad']) {
    const fresh = added[device] ?? [];
    merged[device] = [...(replace && fresh.length ? [] : cur[device]), ...fresh];
  }
  if (merged.iphone.length === 0 && merged.ipad.length === 0) return undefined;
  return merged.ipad.length === 0 ? merged.iphone : merged;
}
