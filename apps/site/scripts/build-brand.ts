// Writes the brand files in public/ from the one mark source, src/brand/mark.ts,
// and the share image source, src/brand/og.ts.
// SVG files only. The PNG files (apple-touch-icon.png and the share image named by
// OG_IMAGE_PATH) are rendered from public/brand/terset-mark.svg and public/brand/og.svg
// by a browser outside the repo, the share image at exactly 1200x630.
// Usage: node scripts/build-brand.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INK, PAPER, bareSvg, faviconSvg, tileSvg } from '../src/brand/mark.ts';
import { ogColors, ogSvg } from '../src/brand/og.ts';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const BRAND = `${PUBLIC}brand/`;
const SANS = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif';
const TOKENS_CSS = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/** Places a mark SVG at a position and size inside a larger SVG. */
function place(svg: string, x: number, y: number, size: number): string {
  return svg.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<svg x="${String(x)}" y="${String(y)}" width="${String(size)}" height="${String(size)}"`);
}

/** Mark and wordmark side by side. On light: the tile. On dark: the bare mark in near white. */
function lockup(onDark: boolean): string {
  const ink = onDark ? PAPER : INK;
  const mark = onDark ? bareSvg(PAPER) : tileSvg();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 32" width="132" height="32">${place(mark, 0, 2, 28)}<text x="37" y="23" font-family="${SANS}" font-size="21" font-weight="700" letter-spacing="-0.5" fill="${ink}">terset</text></svg>\n`;
}

mkdirSync(BRAND, { recursive: true });
const files: Readonly<Record<string, string>> = {
  [`${PUBLIC}favicon.svg`]: `${faviconSvg()}\n`,
  [`${BRAND}terset-mark.svg`]: `${tileSvg()}\n`,
  [`${BRAND}terset-mark-mono-dark.svg`]: `${bareSvg(INK)}\n`,
  [`${BRAND}terset-mark-mono-light.svg`]: `${bareSvg(PAPER)}\n`,
  [`${BRAND}terset-lockup.svg`]: lockup(false),
  [`${BRAND}terset-lockup-on-dark.svg`]: lockup(true),
  [`${BRAND}og.svg`]: ogSvg(ogColors(TOKENS_CSS)),
};
for (const [path, text] of Object.entries(files)) writeFileSync(path, text);
console.log(`Wrote ${String(Object.keys(files).length)} brand files to public/.`);
