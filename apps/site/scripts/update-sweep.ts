// Writes src/data/seed-sweep.json: the eleven case shapes from update-cases.ts,
// each drawn from SWEEP_SEEDS seeds in a row starting at SEED, counted with
// o200k_base. One seed shows one draw of the data; the sweep shows how often
// each result holds across draws. A test keeps the committed file equal to a
// fresh run.
//
//   pnpm sweep     rewrite the summary
//
// Counts match `pnpm numbers` exactly: compact JSON, TOON's best of its comma
// and tab forms, and Terset plus its fitted rules line. Every Terset output is
// decoded after UTF-8 transport and compared with its input before it counts.
// Each change is Terset against the other format, signed like the "vs JSON
// compact" column of the sample table: negative means Terset is smaller.
// Wins and ties are counted apart: a win has strictly fewer tokens, a tie
// exactly as many.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { TOON_VERSION } from '../src/data/bench.ts';
import { SeedSweepSchema } from '../src/data/seed-sweep-schema.ts';
import type { SeedSweep, Spread, SweepCase } from '../src/data/seed-sweep-schema.ts';
import { decode, encode, rulesFor } from '../src/lib/format.ts';
import type { JsonRoot } from '../src/lib/format.ts';
import { CASE_NAMES, SEED, buildCases } from './update-cases.ts';

export const SWEEP_SEEDS = 1000;
export const SWEEP_OUTPUT = fileURLToPath(new URL('../src/data/seed-sweep.json', import.meta.url));
const TOKENIZER = 'o200k_base';

export interface SeedCounts {
  readonly json: number;
  readonly toon: number;
  readonly terset: number;
}

const count = (text: string): number => tokens(text).length;

/** One case from one seed, counted the way `pnpm numbers` counts it. */
export function countCase(value: JsonRoot): SeedCounts {
  const json = JSON.stringify(value);
  const encoded = encode(value);
  if (JSON.stringify(decode(Buffer.from(encoded, 'utf8').toString('utf8'))) !== json) throw new Error('Terset round trip failed after UTF-8 transport');
  const toon = Math.min(count(toonEncode(value)), count(toonEncode(value, { delimiter: '\t' })));
  return { json: count(json), toon, terset: count(encoded) + count(rulesFor(encoded)) };
}

/** Percent change from `other` to Terset, one decimal, rounded as the site's pct() rounds. Negative means Terset is smaller. */
function change(terset: number, other: number): number {
  return Math.round(((terset - other) / other) * 1000) / 10;
}

/** The value at a percentile by nearest rank: the smallest value with at least p percent of values at or below it. */
function nearestRank(sorted: readonly number[], percentile: number): number {
  const value = sorted[Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)];
  if (value === undefined) throw new Error('A spread needs at least one value');
  return value;
}

export function spread(values: readonly number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  return { p5: nearestRank(sorted, 5), median: nearestRank(sorted, 50), p95: nearestRank(sorted, 95) };
}

export function summarize(name: string, counts: readonly SeedCounts[]): SweepCase {
  return {
    name,
    underToon: counts.filter((row) => row.terset < row.toon).length,
    tiedToon: counts.filter((row) => row.terset === row.toon).length,
    underJson: counts.filter((row) => row.terset < row.json).length,
    tiedJson: counts.filter((row) => row.terset === row.json).length,
    vsJson: spread(counts.map((row) => change(row.terset, row.json))),
    vsToon: spread(counts.map((row) => change(row.terset, row.toon))),
  };
}

export function buildSweep(firstSeed: number = SEED, seeds: number = SWEEP_SEEDS): SeedSweep {
  const perCase = CASE_NAMES.map((): SeedCounts[] => []);
  for (let offset = 0; offset < seeds; offset += 1) {
    for (const [index, row] of buildCases(firstSeed + offset).entries()) perCase[index]?.push(countCase(row.data));
  }
  return SeedSweepSchema.parse({
    tokenizer: TOKENIZER,
    toonVersion: TOON_VERSION,
    firstSeed,
    seeds,
    cases: CASE_NAMES.map((name, index) => summarize(name, perCase[index] ?? [])),
  });
}

export function sweepText(sweep: SeedSweep): string {
  return `${JSON.stringify(sweep, null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sweep = buildSweep();
  writeFileSync(SWEEP_OUTPUT, sweepText(sweep));
  console.log(`Wrote ${SWEEP_OUTPUT}: ${String(sweep.cases.length)} cases across ${String(sweep.seeds)} seeds from ${String(sweep.firstSeed)}.`);
}
