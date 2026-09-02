import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchUpstreamApp } from '../../src/lib/upstream.mjs';

test('fetchUpstreamApp finds the app by bundle identifier or lists what exists', async () => {
  const fetch = async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ name: 'S', apps: [{ bundleIdentifier: 'com.a', name: 'A' }, { bundleIdentifier: 'com.b', name: 'B' }] }) });
  const r = await fetchUpstreamApp('https://s/source.json', 'com.b', { fetch });
  assert.equal(r.app.name, 'B');
  assert.equal(r.source.name, 'S');
  await assert.rejects(fetchUpstreamApp('https://s/source.json', 'com.c', { fetch }), /com\.c not found in https:\/\/s\/source\.json \(available: com\.a, com\.b\)/);
});
