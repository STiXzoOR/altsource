import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readState, writeState, appendLog } from '../../src/lib/state.mjs';
import { root } from '../helpers/content.mjs';

test('readState returns the fallback when missing and parses when present', async () => {
  const dir = await root();
  assert.equal(await readState(dir, 'nope'), null);
  assert.deepEqual(await readState(dir, 'nope', []), []);
  await writeState(dir, 'thing', { a: 1 });
  assert.deepEqual(await readState(dir, 'thing'), { a: 1 });
  assert.ok((await readFile(`${dir}/state/thing.json`, 'utf8')).endsWith('}\n'));
});

test('appendLog prepends newest first and caps the length', async () => {
  const dir = await root();
  await appendLog(dir, 'log', [{ n: 1 }]);
  await appendLog(dir, 'log', [{ n: 2 }, { n: 3 }], { max: 2 });
  assert.deepEqual(await readState(dir, 'log'), [{ n: 2 }, { n: 3 }]);
});
