import { TOON_VERSION } from './bench.ts';
import measured from './bundle-sizes.json' with { type: 'json' };
import type { BundleSizes } from './bundle-sizes-schema.ts';

// Refresh with pnpm bundle:sizes. The test checks the committed bytes against a fresh build.
/** Typed without zod, so the browser skips it. data-check.ts proves it against BundleSizesSchema. */
export const SIZE_BYTES: Readonly<BundleSizes> = measured;

const KB = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function kb(bytes: number): string {
  return `${KB.format(bytes / 1000)} kB`;
}

export const SIZE_LINE = `Minified ES2022 browser bundles built with esbuild, then gzipped. Terset encode ${kb(SIZE_BYTES.tersetEncode)}, encode plus decode ${kb(SIZE_BYTES.tersetAll)}. TOON ${TOON_VERSION} encode ${kb(SIZE_BYTES.toonEncode)}, encode plus decode ${kb(SIZE_BYTES.toonAll)}. Terset has no dependencies.`;
