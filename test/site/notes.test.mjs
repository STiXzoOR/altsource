import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimNotes, renderNotes } from '../../site/src/lib/notes.mjs';

const utm = '## Highlights\r\n* **QEMU v10**: faster.\r\n* Liquid Glass.\r\n\r\n## Changes (v4.7.5)\r\n* Fixed a crash (#7546) (thanks @cnnn)\r\n\r\n## Issues\r\nPlease report on [GitHub](https://github.com/x/y/issues).\r\n\r\n## Installation\r\n\r\n### iOS\r\nsee docs\r\n\r\n| File | Description |\r\n|------|-------------|\r\n| UTM.ipa | sideload |\r\n';

test('trimNotes normalises CRLF, drops installation/issues sections to the next same-level heading and drops tables', () => {
  const t = trimNotes(utm);
  assert.equal(t, '## Highlights\n* **QEMU v10**: faster.\n* Liquid Glass.\n\n## Changes (v4.7.5)\n* Fixed a crash (#7546) (thanks @cnnn)');
  assert.equal(trimNotes('## Install\nfoo\n### sub\nbar\n## Notes\nkeep'), '## Notes\nkeep');
  assert.equal(trimNotes('intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nend'), 'intro\n\nend');
});

test('renderNotes emits only the allowed elements', () => {
  const html = renderNotes(utm);
  assert.match(html, /^<p class="notes-h"><strong>Highlights<\/strong><\/p>/);
  assert.match(html, /<ul><li><strong>QEMU v10<\/strong>: faster\.<\/li><li>Liquid Glass\.<\/li><\/ul>/);
  assert.doesNotMatch(html, /<h[1-6]|<table|Installation|Issues|UTM\.ipa/);
});

test('renderNotes keeps http links with noopener, escapes raw HTML, drops images and rules, renders code', () => {
  assert.equal(renderNotes('See [docs](https://d.example/a) and [mail](mailto:x@y.z).'), '<p>See <a href="https://d.example/a" rel="noopener" target="_blank">docs</a> and mail.</p>');
  assert.equal(renderNotes('a <script>alert(1)</script> b'), '<p>a &lt;script&gt;alert(1)&lt;/script&gt; b</p>');
  assert.equal(renderNotes('![shot](https://i/x.png)\n\n---\n\nend'), '<p></p>\n<p>end</p>');
  assert.equal(renderNotes('run `foo --bar`\n\n```\nls -la\n```'), '<p>run <code>foo --bar</code></p>\n<p><code>ls -la</code></p>');
  assert.equal(renderNotes('1. one\n2. two'), '<ol><li>one</li><li>two</li></ol>');
  assert.equal(renderNotes('bare https://x.y/z here'), '<p>bare <a href="https://x.y/z" rel="noopener" target="_blank">https://x.y/z</a> here</p>');
  assert.equal(renderNotes(''), '');
  assert.equal(renderNotes(undefined), '');
});
