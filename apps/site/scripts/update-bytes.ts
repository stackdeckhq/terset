// Writes src/data/bytes-results.json: plain-text size of the benchmark data.
//
//   pnpm bytes
//
// Each benchmark dataset is encoded as Terset, TOON and compact JSON by the same
// code the benchmark uses, then measured as UTF-8 bytes, raw and gzipped at level 9.
// The five structure checks are left out: they are one small table with planted
// errors, not data a sender would ship. No tokenizer is involved.
// Importing this file writes nothing; only running it does.
import { writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { DATASETS } from '../../../bench/src/data.ts';
import { encodeDataset } from '../../../bench/src/formats.ts';
import type { Dataset } from '../../../bench/src/schema.ts';
import { BYTE_FORMATS, BytesFileSchema } from '../src/data/bytes-schema.ts';
import type { ByteCount, ByteFormat, BytesFile } from '../src/data/bytes-schema.ts';

export const OUTPUT = fileURLToPath(new URL('../src/data/bytes-results.json', import.meta.url));
const GZIP_LEVEL = 9;

/** UTF-8 bytes of one text, raw and gzipped. */
export function byteCount(text: string): ByteCount {
  const bytes = Buffer.from(text, 'utf8');
  return { raw: bytes.length, gzip: gzipSync(bytes, { level: GZIP_LEVEL }).length };
}

/** The datasets the line measures: every benchmark dataset except the structure checks. */
export function measuredDatasets(datasets: readonly Dataset[]): readonly Dataset[] {
  return datasets.filter((dataset) => dataset.corruption === undefined);
}

export function buildBytes(datasets: readonly Dataset[]): BytesFile {
  const measured = measuredDatasets(datasets);
  const total = (format: ByteFormat): ByteCount =>
    measured.reduce<ByteCount>((sum, dataset) => {
      const count = byteCount(encodeDataset(format, dataset));
      return { raw: sum.raw + count.raw, gzip: sum.gzip + count.gzip };
    }, { raw: 0, gzip: 0 });
  const [terset, toon, jsonCompact] = BYTE_FORMATS.map(total);
  if (terset === undefined || toon === undefined || jsonCompact === undefined) throw new Error('Missing a byte format');
  return BytesFileSchema.parse({
    datasets: measured.map((dataset) => dataset.name),
    gzipLevel: GZIP_LEVEL,
    totals: { terset, toon, 'json-compact': jsonCompact },
  });
}

export function bytesText(): string {
  return `${JSON.stringify(buildBytes(DATASETS), null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUTPUT, bytesText());
  console.log('Updated plain-text byte sizes from the benchmark datasets.');
}
