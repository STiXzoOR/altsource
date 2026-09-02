import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildAll, BuildError } from '../lib/build.mjs';
import { LoadError } from '../lib/load.mjs';
import { formatIssues } from './format.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

/** Serves files under outDir; directories map to index.html; paths escaping outDir get 403. */
export function createStaticServer(outDir) {
  const root = path.resolve(outDir);
  return http.createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end('bad request'); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
    try {
      const data = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
}

export async function run(argv, { cwd, stdout, stderr }) {
  const { values } = parseArgs({ args: argv, options: { port: { type: 'string', default: '4173' }, out: { type: 'string', default: 'dist' } } });
  const outDir = path.resolve(cwd, values.out);
  try {
    await buildAll({ rootDir: cwd, outDir });
  } catch (e) {
    if (e instanceof BuildError) { stderr.write(formatIssues(e.issues)); return 1; }
    if (e instanceof LoadError) { stderr.write(`✖ ${e.message}\n`); return 1; }
    throw e;
  }
  const server = createStaticServer(outDir);
  await new Promise((resolve) => server.listen(Number(values.port), resolve));
  stdout.write(`serving ${path.relative(cwd, outDir) || '.'}/ at http://localhost:${server.address().port}/ (Ctrl+C to stop)\n`);
  return new Promise(() => {});
}
