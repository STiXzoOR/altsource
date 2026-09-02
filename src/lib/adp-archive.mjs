import path from 'node:path';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { fetchBuffer } from './http.mjs';

/** Extract an ADP zip into outDir, dropping the folder that wraps manifest.json. */
export async function extractADP(buffer, outDir) {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('not a zip archive (expected the ADP .zip from the AltStore API)');
  const entries = unzipSync(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  const names = Object.keys(entries).filter((n) => !n.endsWith('/') && !n.startsWith('__MACOSX/'));
  const manifest = names.find((n) => n === 'manifest.json' || n.endsWith('/manifest.json'));
  if (!manifest) throw new Error('manifest.json not found in the archive');
  const prefix = manifest.slice(0, -'manifest.json'.length);
  const rootDir = path.resolve(outDir);
  let files = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const target = path.resolve(rootDir, name.slice(prefix.length));
    if (!target.startsWith(rootDir + path.sep)) throw new Error(`unsafe path in archive: ${name}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entries[name]);
    files++;
  }
  return { root: rootDir, files };
}

export async function downloadADP(downloadURL, outDir, { fetch } = {}) {
  const { buffer } = await fetchBuffer(downloadURL, { fetch });
  return extractADP(buffer, outDir);
}

/** manifest.json, signature, variant/*.ipa and delta/*.ipa of an extracted ADP. */
export async function readADPDir(dir) {
  const manifestPath = path.join(dir, 'manifest.json');
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (e) { throw new Error(`${manifestPath}: ${e.code === 'ENOENT' ? 'not found' : e.message}`); }
  const files = [{ name: 'manifest.json', path: manifestPath }];
  const warnings = [];
  const signature = path.join(dir, 'signature');
  try { await stat(signature); files.push({ name: 'signature', path: signature }); } catch { warnings.push('signature file missing'); }
  for (const sub of ['variant', 'delta']) {
    let names = [];
    try { names = (await readdir(path.join(dir, sub))).filter((n) => n.endsWith('.ipa')).sort(); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    for (const n of names) files.push({ name: n, path: path.join(dir, sub, n) });
  }
  return { manifest, files, warnings };
}
