/**
 * STiX Apps brand: the "Obsidian" woven-sticks icon, the wordmark wrapper and the header image.
 * Pure string builders — rasterizing and font outlining live in scripts/make-brand-assets.mjs.
 */
export const ICON_SIZE = 1024;
export const HEADER_SIZE = { width: 1200, height: 800 };

const C = ICON_SIZE / 2;
const STICK = { w: 124, gap: 24, long: { ang: 52, L: 600 }, short: { ang: -38, L: 480 } };
const COLOR = {
  tileTop: '#0B1220', tileBottom: '#17233F', glow: '#3B82F6', halo: '#2563EB',
  stickTop: '#FFFFFF', stickBottom: '#93C5FD',
  headerTop: '#070B14', headerBottom: '#101A33',
};

/** A stick along the x axis, centred on the origin, with Chakra Petch-style chamfered ends. */
function chamferedStick(L, w) {
  const l = L / 2, h = w / 2, c = w * 0.32;
  return `M${-l + c} ${-h}H${l - c}L${l} ${-h + c}V${h - c}L${l - c} ${h}H${-l + c}L${-l} ${h - c}V${-h + c}Z`;
}
const stick = ({ ang, L }, w, attrs = '') => `<path d="${chamferedStick(L, w)}" transform="translate(${C} ${C}) rotate(${-ang})"${attrs ? ` ${attrs}` : ''}/>`;
const full = (fill, extra = '') => `<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;

/** Icon content in a 1024×1024 user space; ids are prefixed so several copies can share a document. */
export function iconBody({ idPrefix = 'b' } = {}) {
  const id = (n) => `${idPrefix}-${n}`;
  const { w, gap, long, short } = STICK;
  return [
    '<defs>',
    `<linearGradient id="${id('tile')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLOR.tileTop}"/><stop offset="1" stop-color="${COLOR.tileBottom}"/></linearGradient>`,
    `<radialGradient id="${id('glow')}" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="${COLOR.glow}" stop-opacity="0.65"/><stop offset="1" stop-color="${COLOR.glow}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${id('ice')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLOR.stickTop}"/><stop offset="1" stop-color="${COLOR.stickBottom}"/></linearGradient>`,
    `<filter id="${id('halo')}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="28"/></filter>`,
    `<mask id="${id('gap')}" maskUnits="userSpaceOnUse" x="0" y="0" width="${ICON_SIZE}" height="${ICON_SIZE}">${full('#fff')}${stick(long, w + 2 * gap, 'fill="#000"')}</mask>`,
    `<clipPath id="${id('short')}">${stick(short, w)}</clipPath>`,
    `<clipPath id="${id('long')}">${stick(long, w)}</clipPath>`,
    '</defs>',
    full(`url(#${id('tile')})`),
    full(`url(#${id('glow')})`),
    `<g filter="url(#${id('halo')})" opacity="0.85">${stick(short, w, `fill="${COLOR.halo}"`)}${stick(long, w, `fill="${COLOR.halo}"`)}</g>`,
    `<g mask="url(#${id('gap')})">${full(`url(#${id('ice')})`, `clip-path="url(#${id('short')})"`)}</g>`,
    full(`url(#${id('ice')})`, `clip-path="url(#${id('long')})"`),
  ].join('');
}

export function iconSVG(opts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">${iconBody(opts)}</svg>`;
}

/** Outlined wordmark (path data already positioned at the origin) that takes its colour from CSS. */
export function wordmarkSVG({ d, width, height, label = 'STiX' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><path d="${d}" fill="currentColor"/></svg>`;
}

/** The midnight header: outlined wordmark, "Apps", tagline and the icon tile. Text arrives as path data. */
export function headerSVG({ wordmark, apps, tagline }) {
  const { width, height } = HEADER_SIZE;
  const tile = { x: 880, y: 210, size: 260 };
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<defs>',
    `<linearGradient id="hdr-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLOR.headerTop}"/><stop offset="1" stop-color="${COLOR.headerBottom}"/></linearGradient>`,
    `<radialGradient id="hdr-glow" cx="0.72" cy="0.4" r="0.5"><stop offset="0" stop-color="${COLOR.glow}" stop-opacity="0.5"/><stop offset="1" stop-color="${COLOR.glow}" stop-opacity="0"/></radialGradient>`,
    `<clipPath id="hdr-tile"><rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${ICON_SIZE * 0.22}"/></clipPath>`,
    '</defs>',
    `<rect width="${width}" height="${height}" fill="url(#hdr-bg)"/><rect width="${width}" height="${height}" fill="url(#hdr-glow)"/>`,
    `<g fill="#fff"><path d="${wordmark}"/><path d="${apps}" fill-opacity="0.92"/><path d="${tagline}" fill-opacity="0.72"/></g>`,
    `<g transform="translate(${tile.x} ${tile.y}) scale(${tile.size / ICON_SIZE})" clip-path="url(#hdr-tile)">${iconBody({ idPrefix: 'hdr' })}</g>`,
    '</svg>',
  ].join('');
}
