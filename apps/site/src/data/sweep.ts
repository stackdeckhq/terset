// The seed sweep the site shows: the sample case shapes, each drawn from many
// seeds and counted with o200k_base. `pnpm sweep` writes seed-sweep.json.
// The file is typed without zod, so the browser skips it. data-check.ts proves
// it against SeedSweepSchema.
import raw from './seed-sweep.json' with { type: 'json' };
import { formatChange, formatCount } from './bench.ts';
import type { CaseSource } from './bench.ts';
import type { SeedSweep, Spread, SweepCase } from './seed-sweep-schema.ts';

/** The committed sweep. */
export const SWEEP: SeedSweep = raw;

const SWEEP_FILE = 'apps/site/src/data/seed-sweep.json';

export const SWEEP_TABLE_HEAD = ['Case', 'Under JSON', 'vs JSON, median', 'vs JSON, 5th to 95th', 'Under TOON', 'vs TOON, median', 'vs TOON, 5th to 95th'] as const;

/** One cell per SWEEP_TABLE_HEAD column, in the same order. */
export type SweepTableRow = readonly [name: string, underJson: string, jsonMedian: string, jsonRange: string, underToon: string, toonMedian: string, toonRange: string];

const lastSeed = (sweep: SeedSweep): number => sweep.firstSeed + sweep.seeds - 1;

function range({ p5, p95 }: Spread): string {
  return p5 === p95 ? formatChange(p5) : `${formatChange(p5)} to ${formatChange(p95)}`;
}

function names(list: readonly string[]): string {
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`;
}

export function sweepTableRows(sweep: SeedSweep): readonly SweepTableRow[] {
  const seeds = (count: number): string => `${formatCount(count)} of ${formatCount(sweep.seeds)}`;
  return sweep.cases.map((row) => [row.name, seeds(row.underJson), formatChange(row.vsJson.median), range(row.vsJson), seeds(row.underToon), formatChange(row.vsToon.median), range(row.vsToon)]);
}

export function sweepTitle(sweep: SeedSweep): string {
  return `Across ${formatCount(sweep.seeds)} seeds`;
}

export function sweepIntro(sweep: SeedSweep): string {
  return `The sample cases are one draw of made-up data, from seed ${String(sweep.firstSeed)}. Here the same ${String(sweep.cases.length)} case shapes are drawn from ${formatCount(sweep.seeds)} seeds, ${String(sweep.firstSeed)} to ${String(lastSeed(sweep))}, and counted with ${sweep.tokenizer} the same way, to show how often each result holds.`;
}

/** "Terset is smaller than X on every seed in A of N cases, on none in B, and on some seeds in C", leaving out empty parts. */
function holdLine(sweep: SeedSweep, under: (row: SweepCase) => number, other: string): string {
  const counts = sweep.cases.map(under);
  const every = counts.filter((count) => count === sweep.seeds).length;
  const none = counts.filter((count) => count === 0).length;
  const some = counts.length - every - none;
  const parts = [`on every seed in ${String(every)} of ${String(counts.length)} cases`, ...(none > 0 ? [`on none in ${String(none)}`] : []), ...(some > 0 ? [`on some seeds in ${String(some)}`] : [])];
  const list = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1) ?? ''}`;
  return `Terset is smaller than ${other} ${list}.`;
}

/** How the sample seed compares with most seeds, by case name. */
interface SampleJudgement {
  /** Cases where the sample wins or loses against JSON or TOON the other way from most seeds. */
  readonly odd: readonly string[];
  /** Cases where exactly half the seeds win against JSON or TOON, so there is no "most seeds" to match. */
  readonly even: readonly string[];
}

/** Null while the sample is pending or lacks a row for any sweep case: there is nothing complete to judge. */
function judgeSample(sweep: SeedSweep, sample: CaseSource): SampleJudgement | null {
  if (!('cases' in sample)) return null;
  const odd: string[] = [];
  const even: string[] = [];
  for (const row of sweep.cases) {
    const seed = sample.cases.find((item) => item.name === row.name);
    if (seed === undefined) return null;
    const pairs = [
      [row.underJson, seed.terset < seed.json],
      [row.underToon, seed.terset < seed.toon],
    ] as const;
    if (pairs.some(([under]) => under * 2 === sweep.seeds)) even.push(row.name);
    else if (pairs.some(([under, wins]) => under * 2 > sweep.seeds !== wins)) odd.push(row.name);
  }
  return { odd, even };
}

/** How often each result holds, then whether the sample seed is typical. The last line needs a sample row for every case. */
export function sweepLines(sweep: SeedSweep, sample: CaseSource): readonly string[] {
  const holds = [holdLine(sweep, (row) => row.underJson, 'JSON compact'), holdLine(sweep, (row) => row.underToon, 'TOON')];
  const judged = judgeSample(sweep, sample);
  if (judged === null) return holds;
  const seed = String(sweep.firstSeed);
  const last =
    judged.odd.length > 0
      ? `Seed ${seed} is not typical for ${names(judged.odd)}: it wins or loses against JSON compact or TOON the other way from most seeds.`
      : judged.even.length > 0
        ? `Seed ${seed} wins or loses against JSON compact and TOON the way most seeds do on every case except ${names(judged.even)}, where the seeds split evenly.`
        : `On every case, seed ${seed} wins or loses against JSON compact and TOON the way most seeds do.`;
  return [...holds, last];
}

/**
 * One README line after the sample results. The sweep counts only JSON compact and TOON,
 * so the line names them: each case wins or loses the same way on every seed, except
 * where Terset wins on only some seeds. When the sample seed is not typical, it says that instead.
 */
export function sweepReadmeLine(sweep: SeedSweep, sample: CaseSource): string {
  const head = `Across ${formatCount(sweep.seeds)} seeds of the same ${String(sweep.cases.length)} case shapes, counted with ${sweep.tokenizer},`;
  const odd = judgeSample(sweep, sample)?.odd ?? [];
  if (odd.length > 0) return `${head} seed ${String(sweep.firstSeed)} is not typical for ${names(odd)}: most seeds win or lose against JSON compact or TOON the other way.`;
  const some = (under: number): boolean => under > 0 && under < sweep.seeds;
  const mixed = sweep.cases.flatMap((row) =>
    (
      [
        [row.underJson, 'JSON compact'],
        [row.underToon, 'TOON'],
      ] as const
    )
      .filter(([under]) => some(under))
      .map(([under, other]) => `${row.name} against ${other}, where Terset is smaller on ${formatCount(under)} of ${formatCount(sweep.seeds)}`),
  );
  const except = mixed.length === 0 ? '' : `, except ${mixed.join('; and ')}`;
  return `${head} Terset wins or loses against JSON compact and TOON the same way on every seed${except}.`;
}

export function sweepMethod(sweep: SeedSweep, withClaude: boolean): string {
  const method = `The seed sweep is \`pnpm sweep\`. It draws each case shape from seeds ${String(sweep.firstSeed)} to ${String(lastSeed(sweep))} with the same generator, counts each draw with ${sweep.tokenizer} as above, and writes \`${SWEEP_FILE}\`. A range is the 5th to the 95th percentile by nearest rank. A tie is not smaller.`;
  return withClaude ? `${method} The Claude counts use seed ${String(sweep.firstSeed)} only.` : method;
}
