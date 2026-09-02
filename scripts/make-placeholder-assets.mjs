import { mkdir, writeFile } from 'node:fs/promises';
import { encodePNG } from '../src/lib/png.mjs';

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const gradient = (from, to) => (x, y, w, h) => {
  const t = (x / w + y / h) / 2;
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
};

async function write(file, w, h, fn) {
  await writeFile(file, encodePNG(w, h, (x, y) => fn(x, y, w, h)));
  console.log(`wrote ${file} (${w}×${h})`);
}

await mkdir('assets', { recursive: true });
await write('assets/icon.png', 512, 512, gradient([59, 130, 246], [139, 92, 246]));   // blue → violet
await write('assets/header.png', 1200, 800, gradient([15, 23, 42], [59, 130, 246])); // navy → blue
