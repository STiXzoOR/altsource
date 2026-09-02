const HEX = /^#?([0-9a-fA-F]{6})$/;
const DARK_BG = '#1c1c1e';

export function normalizeTint(value, fallback = '#007aff') {
  const m = typeof value === 'string' ? HEX.exec(value.trim()) : null;
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(normalizeTint(h).slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

function luminance(h) {
  const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Black or white text for a solid background of the given colour. */
export function onTint(h) {
  const [r, g, b] = rgb(h);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#000' : '#fff';
}

const mix = (h, target, t) => { const a = rgb(h); const b = rgb(target); return hex(a.map((v, i) => v + (b[i] - v) * t)); };

/** The tint, darkened (light mode) or lightened (dark mode) just enough to reach 4.5:1 on the page background. */
export function readableTint(h, dark = false) {
  const bg = dark ? DARK_BG : '#ffffff';
  const towards = dark ? '#ffffff' : '#000000';
  let out = normalizeTint(h);
  for (let t = 0; t <= 1 && contrast(out, bg) < 4.5; t += 0.05) out = mix(h, towards, t);
  return out;
}
