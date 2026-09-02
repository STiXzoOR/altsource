import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerDeveloper, adpStatus, processADP, federateSource } from '../../src/lib/altstore-api.mjs';

const recorder = (status = 200, body = '{}') => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, ...init }); return { ok: status < 400, status, text: async () => body }; };
  fetch.calls = calls;
  return fetch;
};

test('registerDeveloper posts JSON to /register and returns the token', async () => {
  const fetch = recorder(200, '{"token":"T","expiration":"2027-01-01T00:00:00Z"}');
  const r = await registerDeveloper({ developerID: 'DEV1', email: 'me@x' }, { fetch });
  assert.deepEqual(r, { token: 'T', expiration: '2027-01-01T00:00:00Z' });
  assert.equal(fetch.calls[0].url, 'https://api.altstore.io/register');
  assert.equal(fetch.calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(fetch.calls[0].body), { developerID: 'DEV1', email: 'me@x' });
  assert.equal(fetch.calls[0].headers['content-type'], 'application/json');
});

test('adpStatus, processADP and federateSource hit the documented endpoints; errors include status and body', async () => {
  const fetch = recorder(200, '{"status":"PROCESSING"}');
  assert.deepEqual(await adpStatus('ADP 1', { fetch }), { status: 'PROCESSING' });
  assert.equal(fetch.calls[0].url, 'https://api.altstore.io/adps/ADP%201');
  assert.equal(fetch.calls[0].method, 'GET');
  await processADP('A', { fetch });
  assert.deepEqual([fetch.calls[1].url, fetch.calls[1].method, JSON.parse(fetch.calls[1].body)], ['https://api.altstore.io/adps', 'POST', { adpID: 'A' }]);
  assert.equal(await federateSource('https://x/source.pal.json', { fetch: recorder(200, '') }), null);
  await assert.rejects(adpStatus('nope', { fetch: recorder(404, '{"error":"not found"}') }), /GET \/adps\/nope → HTTP 404: not found/);
});

test('ALTSTORE_API_BASE overrides the host', async () => {
  process.env.ALTSTORE_API_BASE = 'https://staging.example/v1/';
  try {
    const fetch = recorder();
    await processADP('A', { fetch });
    assert.equal(fetch.calls[0].url, 'https://staging.example/v1/adps');
  } finally {
    delete process.env.ALTSTORE_API_BASE;
  }
});
