// Writes src/data/real-data.json: token counts for the real public files frozen
// in bench/data/real. Nothing was tuned on them. A test keeps the committed file
// equal to a fresh run, and the frozen files equal to their README hashes.
//
//   pnpm real     recount the frozen files
//
// Counts follow `pnpm numbers` exactly, with o200k_base run locally: compact
// JSON, pretty JSON with a 2-space indent, TOON's best of its comma and tab
// forms, and Terset plus its fitted rules line, rulesFor(text). TOON with
// default options alone is kept too. Every Terset text is decoded after UTF-8
// transport and compared with its input before it counts; the run stops if not.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { TOON_VERSION } from '../src/data/bench.ts';
import { RealDataSchema } from '../src/data/real-data-schema.ts';
import type { RealData, RealFile } from '../src/data/real-data-schema.ts';
import { decode, encode, rulesFor } from '../src/lib/format.ts';
import type { JsonRoot } from '../src/lib/format.ts';

export const REAL_DIR = new URL('../../../bench/data/real/', import.meta.url);
export const REAL_OUTPUT = fileURLToPath(new URL('../src/data/real-data.json', import.meta.url));
const TOKENIZER = 'o200k_base';

/** One frozen file and where it came from. bench/data/real/README.md holds the full record. */
export interface RealSource {
  readonly name: string;
  readonly path: string;
  readonly source: string;
  readonly fetched: string;
}

export const REAL_FILES: readonly RealSource[] = [
  {
    name: 'USGS earthquakes, one day',
    path: 'bench/data/real/usgs-earthquakes-all-day.geojson',
    source: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    fetched: '2026-11-17',
  },
  {
    name: 'NWS forecast grid, nested',
    path: 'bench/data/real/nws-gridpoint-lwx-97-71.json',
    source: 'https://api.weather.gov/gridpoints/LWX/97,71',
    fetched: '2026-11-17',
  },
];

const count = (text: string): number => tokens(text).length;

function readRoot(bytes: Buffer, name: string): JsonRoot {
  const value: unknown = JSON.parse(bytes.toString('utf8'));
  if (value === null || typeof value !== 'object') throw new Error(`${name} is not a JSON object or array`);
  return value as JsonRoot;
}

/**
 * Counts one frozen file in every format. `decodeText` is the decoder; a test
 * swaps it to prove a failed round trip stops the run.
 */
export function countReal(file: RealSource, decodeText: (text: string) => unknown = decode): RealFile {
  const bytes = readFileSync(fileURLToPath(new URL(file.path.split('/').at(-1) ?? '', REAL_DIR)));
  const value = readRoot(bytes, file.name);
  const json = JSON.stringify(value);
  const encoded = encode(value);
  if (JSON.stringify(decodeText(Buffer.from(encoded, 'utf8').toString('utf8'))) !== json) {
    throw new Error(`Terset round trip failed on ${file.name}`);
  }
  const toonDefault = count(toonEncode(value));
  return {
    ...file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    json: count(json),
    jsonPretty: count(JSON.stringify(value, null, 2)),
    toon: Math.min(toonDefault, count(toonEncode(value, { delimiter: '\t' }))),
    toonDefault,
    terset: count(encoded) + count(rulesFor(encoded)),
  };
}

export function buildReal(): RealData {
  return RealDataSchema.parse({ tokenizer: TOKENIZER, toonVersion: TOON_VERSION, files: REAL_FILES.map((file) => countReal(file)) });
}

export function realText(data: RealData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = buildReal();
  writeFileSync(REAL_OUTPUT, realText(data));
  console.log(`Wrote ${REAL_OUTPUT}: ${String(data.files.length)} real files.`);
}
