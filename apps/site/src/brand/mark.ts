// The Terset mark: a T inside a table. The lit header row and the lit middle
// column draw the T; the four faint cells finish the table around it.
// Drawn on a 32 px grid. This file is the one source: the React mark and the
// icon files in public/ (scripts/build-brand.ts) are both built from it.
// One color only: no gradient, no dot.

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
}

export const GRID = 32;
export const TILE_RADIUS = 7;
/** The site's darkest ink, the same value as --fg in light mode. */
export const INK = '#0b1730';
/** The site's near white, the same value as --bg in light mode. */
export const PAPER = '#f3f7fc';
/** The tile: a neutral near black, the same value as --mark-tile in light mode. */
export const TILE = '#16181d';
/** The tile on dark surfaces: a lifted charcoal, the same value as --mark-tile in dark mode. */
export const TILE_DARK = '#22252c';
export const FAINT_OPACITY = 0.22;

const R = 1.2;
const cell = (x: number, y: number): Box => ({ x, y, w: 6, h: 6, r: R });

/** The lit header row: the top of the T. */
export const HEADER: Box = { x: 5, y: 5, w: 22, h: 6, r: R };
/** The two lit middle cells: the stem of the T. */
export const LIT: readonly Box[] = [cell(13, 13), cell(13, 21)];
/** The four faint cells around the stem. */
export const FAINT: readonly Box[] = [cell(5, 13), cell(21, 13), cell(5, 21), cell(21, 21)];

function rect(box: Box): string {
  return `<rect x="${String(box.x)}" y="${String(box.y)}" width="${String(box.w)}" height="${String(box.h)}" rx="${String(box.r)}"/>`;
}

/** The mark's shapes in one color, with no tile. */
export function markShapes(fill: string): string {
  return `<g fill="${fill}">${[HEADER, ...LIT].map(rect).join('')}<g opacity="${String(FAINT_OPACITY)}">${FAINT.map(rect).join('')}</g></g>`;
}

const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(GRID)} ${String(GRID)}"`;

/** The tile version: a dark tile with the mark in near white. */
export function tileSvg(tile = TILE, mark = PAPER): string {
  return `${open}><rect width="${String(GRID)}" height="${String(GRID)}" rx="${String(TILE_RADIUS)}" fill="${tile}"/>${markShapes(mark)}</svg>`;
}

/** The bare version: the mark alone in currentColor. The color attribute sets currentColor for a standalone file. */
export function bareSvg(color?: string): string {
  return `${open}${color === undefined ? '' : ` color="${color}"`}>${markShapes('currentColor')}</svg>`;
}

/** How much the favicon enlarges the mark, about the tile's center. At tab size the mark's margin drops from 5 to 3 units. */
export const FAVICON_MARK_SCALE = 1.18;

/**
 * The favicon: the mark drawn larger than in the logo, because a tab icon is 16 px.
 * It is the dark tile with a light mark in every browser theme.
 */
export function faviconSvg(): string {
  const size = String(GRID);
  const center = String(GRID / 2);
  const grow = `translate(${center} ${center}) scale(${String(FAVICON_MARK_SCALE)}) translate(-${center} -${center})`;
  return `${open}><style>.t{fill:${TILE}}.m{fill:${PAPER}}</style><rect class="t" width="${size}" height="${size}" rx="${String(TILE_RADIUS)}"/><g class="m" transform="${grow}">${[HEADER, ...LIT].map(rect).join('')}<g opacity="${String(FAINT_OPACITY)}">${FAINT.map(rect).join('')}</g></g></svg>`;
}
