import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const root = path.resolve(process.env.ALTSOURCE_ROOT ?? process.cwd());
const meta = JSON.parse(readFileSync(path.join(root, 'source.meta.json'), 'utf8'));
const baseURL = new URL(meta.baseURL);
const basePath = baseURL.pathname.replace(/\/+$/, '');

export default defineConfig({
  output: 'static',
  srcDir: 'site/src',
  publicDir: process.env.ALTSOURCE_PUBLIC ?? '.altsource',
  outDir: process.env.ALTSOURCE_OUT ?? 'dist',
  site: baseURL.origin,
  ...(basePath ? { base: basePath } : {}),
  trailingSlash: 'always',
  cacheDir: process.env.ALTSOURCE_ASTRO_CACHE ?? '.astro',
  vite: { plugins: [tailwindcss()], cacheDir: process.env.ALTSOURCE_ASTRO_CACHE ? path.join(process.env.ALTSOURCE_ASTRO_CACHE, 'vite') : 'node_modules/.vite', server: { fs: { allow: ['.', root] } } },
});
