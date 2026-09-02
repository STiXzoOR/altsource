import bplist from 'bplist-parser';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e]);

const OPEN = /<([a-zA-Z]+)(?:\s[^>]*)?(\/)?>/y;
const KEY = /<key>([\s\S]*?)<\/key>/y;
const WS = /\s*/y;

function skip(text, i) {
  for (;;) {
    WS.lastIndex = i; WS.exec(text); i = WS.lastIndex;
    if (!text.startsWith('<!--', i)) return i;
    const end = text.indexOf('-->', i);
    if (end < 0) throw new Error('plist: unterminated comment');
    i = end + 3;
  }
}

function parseValue(text, i) {
  i = skip(text, i);
  OPEN.lastIndex = i;
  const m = OPEN.exec(text);
  if (!m) throw new Error(`plist: unexpected content at offset ${i}`);
  const tag = m[1];
  i = OPEN.lastIndex;
  if (m[2]) {
    const empty = { true: true, false: false, dict: {}, array: [], string: '', data: Buffer.alloc(0) };
    if (!(tag in empty)) throw new Error(`plist: unexpected <${tag}/>`);
    return { value: empty[tag], i };
  }
  if (tag === 'dict') {
    const obj = {};
    for (;;) {
      i = skip(text, i);
      if (text.startsWith('</dict>', i)) return { value: obj, i: i + 7 };
      KEY.lastIndex = i;
      const k = KEY.exec(text);
      if (!k) throw new Error(`plist: expected <key> at offset ${i}`);
      const v = parseValue(text, KEY.lastIndex);
      obj[decode(k[1])] = v.value;
      i = v.i;
    }
  }
  if (tag === 'array') {
    const arr = [];
    for (;;) {
      i = skip(text, i);
      if (text.startsWith('</array>', i)) return { value: arr, i: i + 8 };
      const v = parseValue(text, i);
      arr.push(v.value);
      i = v.i;
    }
  }
  const close = `</${tag}>`;
  const end = text.indexOf(close, i);
  if (end < 0) throw new Error(`plist: missing ${close}`);
  const raw = text.slice(i, end);
  i = end + close.length;
  switch (tag) {
    case 'string': return { value: decode(raw), i };
    case 'integer': case 'real': return { value: Number(raw.trim()), i };
    case 'date': return { value: new Date(raw.trim()), i };
    case 'data': return { value: Buffer.from(raw.replace(/\s+/g, ''), 'base64'), i };
    default: throw new Error(`plist: unsupported tag <${tag}>`);
  }
}

export function parseXMLPlist(text) {
  const start = text.indexOf('<plist');
  if (start < 0) throw new Error('plist: no <plist> element');
  return parseValue(text, text.indexOf('>', start) + 1).value;
}

/** Binary (bplist00) or XML property list → plain object. */
export function parsePlist(buffer) {
  if (buffer.subarray(0, 8).toString('ascii') === 'bplist00') return bplist.parseBuffer(buffer)[0];
  return parseXMLPlist(buffer.toString('utf8'));
}
