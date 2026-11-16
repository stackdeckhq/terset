// Plain-text size of the benchmark data, for one short line on /benchmark.
// Every figure comes from bytes-results.json, which `pnpm bytes` writes.
import raw from './bytes-results.json' with { type: 'json' };
import type { BytesFile } from './bytes-schema.ts';
import { formatCount } from './bench.ts';

/** Typed without zod, so the browser skips it. data-check.ts proves it against BytesFileSchema. */
export const BYTES = raw as BytesFile;

/** One line, inline Markdown: Terset first and bold, then TOON and compact JSON, raw then gzipped. */
export function bytesLine(file: BytesFile): string {
  const { terset, toon } = file.totals;
  const json = file.totals['json-compact'];
  return [
    `In plain bytes, with no tokenizer, the ${String(file.datasets.length)} benchmark data sets take **${formatCount(terset.raw)}** as Terset, ${formatCount(toon.raw)} as TOON and ${formatCount(json.raw)} as compact JSON.`,
    `Gzipped: **${formatCount(terset.gzip)}**, ${formatCount(toon.gzip)} and ${formatCount(json.gzip)}.`,
  ].join(' ');
}
