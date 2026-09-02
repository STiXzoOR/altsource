import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../src/cli/serve.mjs';
import { root } from '../helpers/content.mjs';

test('static server serves index, json, 404 and blocks traversal', async () => {
  const dir = await root({ 'index.html': '<h1>hi</h1>', 'source.json': '{"name":"S"}', 'status/index.html': 'status' });
  const server = createStaticServer(dir);
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.equal(await index.text(), '<h1>hi</h1>');
    const json = await fetch(`${base}/source.json`);
    assert.match(json.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await json.json(), { name: 'S' });
    assert.equal((await fetch(`${base}/status/`)).status, 200);
    assert.equal((await fetch(`${base}/nope.png`)).status, 404);
    assert.equal((await fetch(`${base}/..%2f..%2fetc/passwd`)).status, 403);
  } finally {
    server.close();
  }
});
