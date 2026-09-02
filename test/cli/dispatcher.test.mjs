import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const BIN = path.resolve('bin/altsource.mjs');
const cli = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

test('no arguments prints usage and exits 1', () => {
  const r = cli();
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /usage: altsource/i);
});

test('--help prints usage and exits 0', () => {
  const r = cli('--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /validate/);
});

test('unknown command exits 1 with message', () => {
  const r = cli('frobnicate');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown command: frobnicate/);
});
