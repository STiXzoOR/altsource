import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { parsePlist } from './plist.mjs';

const MAGIC = Buffer.from([0xfa, 0xde, 0x71, 0x71]);
const IMPLICIT = new Set(['application-identifier', 'com.apple.developer.team-identifier']);
const APP_INFO = /^Payload\/[^/]+\.app\/Info\.plist$/;
const APPEX_INFO = /^Payload\/[^/]+\.app\/PlugIns\/[^/]+\.appex\/Info\.plist$/;

/** Keys of every embedded entitlements blob in a Mach-O (all slices of a fat binary). */
export function entitlementsFromMachO(buffer) {
  const keys = new Set();
  for (let i = buffer.indexOf(MAGIC); i !== -1; i = buffer.indexOf(MAGIC, i + 4)) {
    if (i + 8 > buffer.length) break;
    const len = buffer.readUInt32BE(i + 4);
    if (len <= 8 || i + len > buffer.length) continue;
    try {
      for (const k of Object.keys(parsePlist(buffer.subarray(i + 8, i + len)))) keys.add(k);
    } catch { /* not a plist payload */ }
  }
  return [...keys];
}

const view = (buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

/** Identity, permissions and hashes of an IPA buffer. */
export function inspectIPA(buffer) {
  const bytes = view(buffer);
  const plists = unzipSync(bytes, { filter: (f) => APP_INFO.test(f.name) || APPEX_INFO.test(f.name) });
  const infoPath = Object.keys(plists).find((n) => APP_INFO.test(n));
  if (!infoPath) throw new Error('not an IPA: Payload/<App>.app/Info.plist not found');
  const info = parsePlist(Buffer.from(plists[infoPath]));
  const appDir = infoPath.slice(0, -'Info.plist'.length);
  const executables = new Set();
  if (info.CFBundleExecutable) executables.add(`${appDir}${info.CFBundleExecutable}`);
  for (const [name, data] of Object.entries(plists)) {
    if (!APPEX_INFO.test(name)) continue;
    const ext = parsePlist(Buffer.from(data));
    if (ext.CFBundleExecutable) executables.add(`${name.slice(0, -'Info.plist'.length)}${ext.CFBundleExecutable}`);
  }
  const binaries = unzipSync(bytes, { filter: (f) => executables.has(f.name) });
  const entitlements = new Set();
  for (const data of Object.values(binaries)) {
    for (const k of entitlementsFromMachO(Buffer.from(data))) if (!IMPLICIT.has(k)) entitlements.add(k);
  }
  const privacy = {};
  for (const [k, v] of Object.entries(info)) if (/UsageDescription$/.test(k) && typeof v === 'string') privacy[k] = v;
  return {
    bundleIdentifier: info.CFBundleIdentifier,
    name: info.CFBundleDisplayName ?? info.CFBundleName ?? appDir.split('/')[1].replace(/\.app$/, ''),
    version: info.CFBundleShortVersionString,
    buildVersion: info.CFBundleVersion,
    minOSVersion: info.MinimumOSVersion,
    privacy,
    entitlements: [...entitlements].sort(),
    size: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** A version entry from inspectIPA() output. */
export function versionFromIPA(info, { downloadURL, size = info.size, date, notes }) {
  const v = { version: info.version, buildVersion: info.buildVersion, date, localizedDescription: notes, downloadURL, size, sha256: info.sha256, minOSVersion: info.minOSVersion };
  for (const k of Object.keys(v)) if (v[k] === undefined) delete v[k];
  return v;
}
