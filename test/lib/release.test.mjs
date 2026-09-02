import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishRelease, releaseBase } from '../../src/lib/release.mjs';

const fakeExec = (existing) => {
  const calls = [];
  const exec = async (cmd, args) => { calls.push([cmd, ...args]); if (args[0] === 'release' && args[1] === 'view' && !existing) throw new Error('release not found'); return { stdout: '' }; };
  exec.calls = calls;
  return exec;
};
const files = [{ name: 'manifest.json', path: '/adp/manifest.json' }, { name: 'signature', path: '/adp/signature' }, { name: 'x.ipa', path: '/adp/variant/x.ipa' }];

test('releaseBase', () => {
  assert.equal(releaseBase('o/r', 'v1.6'), 'https://github.com/o/r/releases/download/v1.6');
});

test('publishRelease creates the release when missing and uploads with --clobber', async () => {
  const exec = fakeExec(false);
  const r = await publishRelease({ repo: 'o/r', tag: 'v1', notes: 'n', files, exec });
  assert.equal(r.created, true);
  assert.deepEqual(exec.calls[1], ['gh', 'release', 'create', 'v1', '--repo', 'o/r', '--title', 'v1', '--notes', 'n']);
  assert.deepEqual(exec.calls[2], ['gh', 'release', 'upload', 'v1', '/adp/manifest.json', '/adp/signature', '/adp/variant/x.ipa', '--repo', 'o/r', '--clobber']);
  assert.deepEqual(r.assets, ['https://github.com/o/r/releases/download/v1/manifest.json', 'https://github.com/o/r/releases/download/v1/signature', 'https://github.com/o/r/releases/download/v1/x.ipa']);
});

test('publishRelease only uploads when the release exists', async () => {
  const exec = fakeExec(true);
  const r = await publishRelease({ repo: 'o/r', tag: 'v1', files, exec });
  assert.equal(r.created, false);
  assert.equal(exec.calls.length, 2);
  assert.equal(exec.calls[1][2], 'upload');
});
