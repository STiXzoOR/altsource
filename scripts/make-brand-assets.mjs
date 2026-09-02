/**
 * Regenerate the brand assets in assets/ from src/lib/brand.mjs:
 *   logo.svg, icon.png (1024²), wordmark.svg, header.svg, header.png (1200×800).
 * Text is outlined with opentype.js from the vendored Chakra Petch fonts (brand/fonts, OFL 1.1),
 * so nothing at build or run time depends on a font. The PNGs are committed; run this only after
 * changing the brand.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { iconSVG, wordmarkSVG, headerSVG, ICON_SIZE } from '../src/lib/brand.mjs';

const PNG = { compressionLevel: 9, effort: 10 }; // lossless, smallest
const FONTS = { bold: 'brand/fonts/ChakraPetch-Bold.ttf', medium: 'brand/fonts/ChakraPetch-Medium.ttf' };

async function loadFont(file) {
  const buf = await readFile(file);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
const outline = (font, text, x, y, size) => font.getPath(text, x, y, size).toPathData(2);

/** Outline text at the origin and return { d, width, height } for a tight viewBox. */
function outlineTight(font, text, size) {
  const box = font.getPath(text, 0, 0, size).getBoundingBox();
  const pad = size * 0.02;
  return { d: outline(font, text, -box.x1 + pad, -box.y1 + pad, size), width: +(box.x2 - box.x1 + 2 * pad).toFixed(2), height: +(box.y2 - box.y1 + 2 * pad).toFixed(2) };
}

export async function generateBrandAssets({ outDir = 'assets', rootDir = process.cwd() } = {}) {
  const bold = await loadFont(path.join(rootDir, FONTS.bold));
  const medium = await loadFont(path.join(rootDir, FONTS.medium));
  const svgs = {
    'logo.svg': iconSVG(),
    'wordmark.svg': wordmarkSVG(outlineTight(bold, 'STiX', 1000)),
    'header.svg': headerSVG({
      wordmark: outline(bold, 'STiX', 110, 430, 280),
      apps: outline(bold, 'Apps', 114, 560, 112),
      tagline: outline(medium, 'Hand-picked apps for AltStore', 116, 626, 32),
    }),
  };
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const [name, svg] of Object.entries(svgs)) {
    const file = path.join(outDir, name);
    await writeFile(file, svg);
    written.push(file);
  }
  const icon = path.join(outDir, 'icon.png');
  await sharp(Buffer.from(svgs['logo.svg'])).resize(ICON_SIZE, ICON_SIZE).png(PNG).toFile(icon);
  const header = path.join(outDir, 'header.png');
  await sharp(Buffer.from(svgs['header.svg'])).png(PNG).toFile(header);
  written.push(icon, header);
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await generateBrandAssets();
  for (const f of files) console.log(`wrote ${f}`);
}
