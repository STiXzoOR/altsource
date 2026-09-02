import { zipSync } from 'fflate';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function node(v) {
  if (typeof v === 'string') return `<string>${esc(v)}</string>`;
  if (typeof v === 'number') return Number.isInteger(v) ? `<integer>${v}</integer>` : `<real>${v}</real>`;
  if (typeof v === 'boolean') return v ? '<true/>' : '<false/>';
  if (Array.isArray(v)) return `<array>${v.map(node).join('')}</array>`;
  return `<dict>${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `<key>${esc(k)}</key>${node(x)}`).join('')}</dict>`;
}
export const xmlPlist = (obj) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">${node(obj)}</plist>\n`;

function blob(entitlements) {
  const xml = Buffer.from(xmlPlist(entitlements));
  const head = Buffer.alloc(8);
  head.writeUInt32BE(0xfade7171, 0);
  head.writeUInt32BE(xml.length + 8, 4);
  return Buffer.concat([head, xml]);
}

/** A fake Mach-O: filler bytes around one (or two, when fat) entitlements blobs. */
export function machO(entitlements, { fat = false } = {}) {
  const filler = Buffer.alloc(512, 0xab);
  const parts = [Buffer.from('\xcf\xfa\xed\xfe', 'latin1'), filler, blob(entitlements), filler];
  if (fat) parts.push(blob(entitlements), filler);
  return Buffer.concat(parts);
}

export function makeIPA({ appName = 'Demo', info = {}, entitlements = {}, plugins = [], fat = false, extra = {} } = {}) {
  const base = {
    CFBundleIdentifier: 'com.example.demo', CFBundleName: appName, CFBundleDisplayName: `${appName} App`, CFBundleExecutable: appName,
    CFBundleShortVersionString: '1.2.3', CFBundleVersion: '45', MinimumOSVersion: '16.0',
    NSCameraUsageDescription: 'Takes photos', NSMicrophoneUsageDescription: 'Records audio & video', UIDeviceFamily: [1, 2], ...info,
  };
  const ents = { 'application-identifier': 'TEAM.com.example.demo', 'com.apple.developer.team-identifier': 'TEAM', 'get-task-allow': true, ...entitlements };
  const dir = `Payload/${appName}.app/`;
  const files = {
    [`${dir}Info.plist`]: new Uint8Array(Buffer.from(xmlPlist(base))),
    [`${dir}${appName}`]: new Uint8Array(machO(ents, { fat })),
    [`${dir}Assets.car`]: new Uint8Array(Buffer.alloc(64, 1)),
    [`${dir}Frameworks/Lib.framework/Lib`]: new Uint8Array(machO({ 'com.apple.should.not.count': true })),
  };
  for (const p of plugins) {
    const pdir = `${dir}PlugIns/${p.name}.appex/`;
    files[`${pdir}Info.plist`] = new Uint8Array(Buffer.from(xmlPlist({ CFBundleIdentifier: `com.example.demo.${p.name}`, CFBundleExecutable: p.name, ...(p.info ?? {}) })));
    files[`${pdir}${p.name}`] = new Uint8Array(machO({ 'application-identifier': 'x', ...(p.entitlements ?? {}) }));
  }
  for (const [k, v] of Object.entries(extra)) files[k] = new Uint8Array(Buffer.from(v));
  return Buffer.from(zipSync(files, { level: 1 }));
}
