import { Marked } from 'marked';

const DROP = /^(installation|install|issues?|known issues?|downloads?|support|links?|checksums?|sha-?\d*)\b/i;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Release notes without the sections that are not release notes, and without tables. */
export function trimNotes(markdown) {
  const out = [];
  let dropLevel = 0;
  for (const line of String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      if (dropLevel && level > dropLevel) continue;
      dropLevel = DROP.test(h[2]) ? level : 0;
      if (dropLevel) continue;
    } else if (dropLevel) continue;
    if (/^\s*\|/.test(line)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const parser = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens }) { return `<p class="notes-h"><strong>${this.parser.parseInline(tokens)}</strong></p>\n`; },
    paragraph({ tokens }) { return `<p>${this.parser.parseInline(tokens)}</p>\n`; },
    blockquote({ tokens }) { return this.parser.parse(tokens); },
    code({ text }) { return `<p><code>${esc(text)}</code></p>\n`; },
    hr() { return ''; },
    html({ text }) { return esc(text); },
    image() { return ''; },
    table() { return ''; },
    checkbox() { return ''; },
    del({ tokens }) { return this.parser.parseInline(tokens); },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      return /^https?:\/\//i.test(href) ? `<a href="${esc(href)}" rel="noopener" target="_blank">${label}</a>` : label;
    },
    list(token) {
      const tag = token.ordered ? 'ol' : 'ul';
      return `<${tag}>${token.items.map((item) => this.listitem(item)).join('')}</${tag}>\n`;
    },
    listitem(item) { return `<li>${this.parser.parse(item.tokens, !!item.loose).trim()}</li>`; },
  },
});

/** Safe HTML for release notes and descriptions: paragraphs, lists, emphasis, code and http links only. */
export function renderNotes(markdown) {
  const md = trimNotes(markdown);
  return md ? parser.parse(md).trim() : '';
}
