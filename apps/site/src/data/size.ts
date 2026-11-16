// Bundle sizes, gzipped. Measured with a minified browser ESM bundle (ES2022)
// and Node's gzipSync at the default level. TOON is @toon-format/toon 4.4.0;
// its "encode plus decode" figure is the whole module.
export const SIZE_BYTES = {
  tersetEncode: 1231,
  tersetAll: 2064,
  toonEncode: 2775,
  toonAll: 8247,
} as const;

const KB = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function kb(bytes: number): string {
  return `${KB.format(bytes / 1000)} kB`;
}

export const SIZE_LINE = `Gzipped: Terset encode ${kb(SIZE_BYTES.tersetEncode)}, encode plus decode ${kb(SIZE_BYTES.tersetAll)}. TOON 4.4.0 encode ${kb(SIZE_BYTES.toonEncode)}, encode plus decode ${kb(SIZE_BYTES.toonAll)}. No dependencies.`;
