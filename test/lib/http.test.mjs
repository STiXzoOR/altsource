import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchJSON, fetchBuffer, loadBytes, githubHeaders } from '../../src/lib/http.mjs';
import { root } from '../helpers/content.mjs';

const ok = (body, headers = {}) => ({ ok: true, status: 200, headers: new Headers(headers), json: async () => JSON.parse(body), arrayBuffer: async () => new TextEncoder().encode(body).buffer });

test('fetchJSON parses and throws on non-OK', async () => {
  assert.deepEqual(await fetchJSON('https://x/j', { fetch: async () => ok('{"a":1}') }), { a: 1 });
  await assert.rejects(fetchJSON('https://x/j', { fetch: async () => ({ ok: false, status: 404 }) }), /GET https:\/\/x\/j → HTTP 404/);
});

test('fetchBuffer returns bytes and last-modified', async () => {
  const r = await fetchBuffer('https://x/b', { fetch: async () => ok('hi', { 'last-modified': 'Tue, 01 Sep 2026 00:00:00 GMT' }) });
  assert.equal(r.buffer.toString(), 'hi');
  assert.equal(r.lastModified, 'Tue, 01 Sep 2026 00:00:00 GMT');
});

test('loadBytes reads a local path relative to cwd or downloads a URL', async () => {
  const dir = await root({ 'a.bin': 'local' });
  const local = await loadBytes('a.bin', { cwd: dir });
  assert.equal(local.buffer.toString(), 'local');
  assert.equal(local.source, 'file');
  const remote = await loadBytes('https://x/a.ipa', { cwd: dir, fetch: async () => ok('remote') });
  assert.equal(remote.buffer.toString(), 'remote');
  assert.deepEqual([remote.source, remote.url], ['url', 'https://x/a.ipa']);
});

test('githubHeaders adds a bearer token only when present', () => {
  assert.deepEqual(githubHeaders(''), {});
  assert.deepEqual(githubHeaders('t0k'), { authorization: 'Bearer t0k' });
});
