// The share image (og:image and twitter:image): one text constant, one layout and the
// SVG built from both. scripts/build-brand.ts writes public/brand/og.svg from ogSvg(),
// and a browser renders that file to the PNG named by OG_IMAGE_PATH, at 1200x630.
// The numbers repeat figures the README states, so og.test.ts fails when they drift from the data.
import { THEME_COLORS } from '../theme.ts';
import { GRID, HEADER, bareSvg } from './mark.ts';

/** Every word in the image. The test reads the data and checks each number here. */
export const OG_TEXT = {
  name: 'terset',
  headline: ['Same data.', 'Fewer tokens.'],
  sub: 'Open source. On npm and PyPI.',
  stats: [
    { value: '26.4%', label: 'fewer tokens than JSON', win: true },
    { value: '8 of 11', label: 'cases smaller than TOON', win: false },
    // Overlapping ranges do not prove equal accuracy, so the label states only the overlap.
    { value: '242 of 244', label: 'Right in 1.1. Ranges overlap.', win: false },
  ],
} as const;

/** The file name changes with the content, so link previews never show a cached old image. */
export const OG_IMAGE_PATH = '/og-v9.png';

export const OG_IMAGE_ALT = [
  `${OG_TEXT.name.charAt(0).toUpperCase()}${OG_TEXT.name.slice(1)}.`,
  ...OG_TEXT.headline,
  ...OG_TEXT.stats.map((stat) => `${stat.value} ${stat.label}${stat.label.endsWith('.') ? '' : '.'}`),
].join(' ');

/**
 * Positions in image pixels; text y values are baselines. The content block runs from
 * y=131 to y=499, centered on y=315, with 96 px margins left and right. Nothing sits
 * below y=500, so the bottom-left corner stays clear for the label X puts over it.
 */
export const OG_LAYOUT = {
  width: 1200,
  height: 630,
  font: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
  /** The mark's visible top-left corner and visible size, not its padded 32-unit box. */
  mark: { x: 96, y: 131, size: 72 },
  name: { x: 188, y: 185, size: 52 },
  headline: { x: 96, ys: [352, 432], size: 70 },
  sub: { x: 96, y: 492, size: 26 },
  /** Set from a rendered measurement: the middle of the gap between the two columns. */
  divider: { x: 630, top: 131, bottom: 499 },
  /** x puts the widest label's right edge on x=1104, a 96 px right margin. */
  stats: { x: 743, valueYs: [180, 316, 452], labelYs: [220, 356, 492], valueSize: 68, labelSize: 26 },
} as const;

export interface OgColors {
  readonly ground: string;
  readonly text: string;
  readonly muted: string;
  readonly line: string;
  readonly accent: string;
}

/** The share image's accent: a lighter blue than the site's, for a small preview on a dark ground. */
export const OG_ACCENT = '#5cb4ff';

/** The dark value of a `--name: light-dark(light, dark);` token in tokens.css. */
export function darkToken(css: string, name: string): string {
  const match = new RegExp(String.raw`(?:^|[\s;{])${name}:\s*light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)`, 'u').exec(css);
  if (match?.[2] === undefined) throw new Error(`tokens.css has no light-dark() value for ${name}`);
  return match[2];
}

/** The site's dark mode: the page ground from the theme, text and labels from tokens.css. */
export function ogColors(tokensCss: string): OgColors {
  return {
    ground: THEME_COLORS.dark,
    text: darkToken(tokensCss, '--fg'),
    muted: darkToken(tokensCss, '--muted-fg'),
    line: darkToken(tokensCss, '--border-strong'),
    accent: OG_ACCENT,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

interface TextSpec {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly weight: number;
  readonly fill: string;
  readonly spacing?: number;
}

function text(content: string, spec: TextSpec): string {
  const spacing = spec.spacing === undefined ? '' : ` letter-spacing="${String(spec.spacing)}"`;
  return `<text x="${String(spec.x)}" y="${String(spec.y)}" font-family="${OG_LAYOUT.font}" font-size="${String(spec.size)}" font-weight="${String(spec.weight)}"${spacing} fill="${spec.fill}">${escapeXml(content)}</text>`;
}

/** The share image as SVG. */
export function ogSvg(colors: OgColors): string {
  const { width, height, mark, name, headline, sub, divider, stats } = OG_LAYOUT;
  // The drawn part of the mark spans HEADER.x to HEADER.x + HEADER.w on both axes of the 32-unit grid.
  const scale = mark.size / HEADER.w;
  const box = (value: number): string => String(Math.round(value * 100) / 100);
  const markSvg = bareSvg(colors.text).replace(
    '<svg xmlns="http://www.w3.org/2000/svg"',
    `<svg x="${box(mark.x - HEADER.x * scale)}" y="${box(mark.y - HEADER.y * scale)}" width="${box(GRID * scale)}" height="${box(GRID * scale)}"`,
  );
  const lines = [
    `<rect width="${String(width)}" height="${String(height)}" fill="${colors.ground}"/>`,
    markSvg,
    text(OG_TEXT.name, { x: name.x, y: name.y, size: name.size, weight: 700, fill: colors.text, spacing: -1.5 }),
    ...OG_TEXT.headline.map((line, i) => text(line, { x: headline.x, y: headline.ys[i] ?? 0, size: headline.size, weight: 780, fill: i === 0 ? colors.text : colors.accent, spacing: -2.5 })),
    text(OG_TEXT.sub, { x: sub.x, y: sub.y, size: sub.size, weight: 500, fill: colors.muted }),
    `<line x1="${String(divider.x)}" y1="${String(divider.top)}" x2="${String(divider.x)}" y2="${String(divider.bottom)}" stroke="${colors.line}" stroke-width="2"/>`,
    ...OG_TEXT.stats.flatMap((stat, i) => [
      text(stat.value, { x: stats.x, y: stats.valueYs[i] ?? 0, size: stats.valueSize, weight: 780, fill: stat.win ? colors.accent : colors.text, spacing: -2 }),
      text(stat.label, { x: stats.x, y: stats.labelYs[i] ?? 0, size: stats.labelSize, weight: 600, fill: colors.muted }),
    ]),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(width)} ${String(height)}" width="${String(width)}" height="${String(height)}">\n${lines.join('\n')}\n</svg>\n`;
}
