import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePlist, parseXMLPlist } from '../../src/lib/plist.mjs';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- a comment -->
  <key>CFBundleIdentifier</key><string>com.example.xml</string>
  <key>Nested</key>
  <dict><key>n</key><integer>3</integer><key>r</key><real>1.5</real><key>t</key><true/><key>f</key><false/></dict>
  <key>List</key><array><string>a &amp; b</string><string>&lt;c&gt;</string><integer>-2</integer></array>
  <key>Empty</key><array/>
  <key>Blank</key><string></string>
  <key>When</key><date>2026-09-02T10:00:00Z</date>
  <key>Bytes</key><data>aGk=</data>
</dict>
</plist>`;

test('parseXMLPlist handles the plist value types', () => {
  const p = parseXMLPlist(XML);
  assert.equal(p.CFBundleIdentifier, 'com.example.xml');
  assert.deepEqual(p.Nested, { n: 3, r: 1.5, t: true, f: false });
  assert.deepEqual(p.List, ['a & b', '<c>', -2]);
  assert.deepEqual(p.Empty, []);
  assert.equal(p.Blank, '');
  assert.equal(p.When.toISOString(), '2026-09-02T10:00:00.000Z');
  assert.equal(p.Bytes.toString(), 'hi');
});

test('parsePlist detects binary plists', async () => {
  const p = parsePlist(await readFile('test/fixtures/info.bplist'));
  assert.equal(p.CFBundleIdentifier, 'com.example.bin');
  assert.equal(p.CFBundleVersion, '42');
  assert.equal(p.NSCameraUsageDescription, 'Camera & photos');
  assert.deepEqual(p.UIDeviceFamily, [1, 2]);
});

test('parsePlist parses XML buffers and rejects garbage', () => {
  assert.equal(parsePlist(Buffer.from(XML)).CFBundleIdentifier, 'com.example.xml');
  assert.throws(() => parsePlist(Buffer.from('nope')), /plist/);
});
