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

/** "Tie on all 1,000" when every seed ties, "400 of 1,000, 20 tied" when some do, "400 of 1,000" when none do. */
function underCell(sweep: SeedSweep, under: number, tied: number): string {
  if (tied === sweep.seeds) return `Tie on all ${formatCount(sweep.seeds)}`;
  const seeds = `${formatCount(under)} of ${formatCount(sweep.seeds)}`;
  return tied > 0 ? `${seeds}, ${formatCount(tied)} tied` : seeds;
}

export function sweepTableRows(sweep: SeedSweep): readonly SweepTableRow[] {
  return sweep.cases.map((row) => [
    row.name,
    underCell(sweep, row.underJson, row.tiedJson),
    formatChange(row.vsJson.median),
    range(row.vsJson),
    underCell(sweep, row.underToon, row.tiedToon),
    formatChange(row.vsToon.median),
    range(row.vsToon),
  ]);
}

/** One comparison of one case: seeds where Terset is smaller, and seeds where it ties. */
interface Outcome {
  readonly under: number;
  readonly tied: number;
}

const jsonOutcome = (row: SweepCase): Outcome => ({ under: row.underJson, tied: row.tiedJson });
const toonOutcome = (row: SweepCase): Outcome => ({ under: row.underToon, tied: row.tiedToon });

export function sweepTitle(sweep: SeedSweep): string {
  return `Across ${formatCount(sweep.seeds)} seeds`;
}

export function sweepIntro(sweep: SeedSweep): string {
  return `The sample cases are one draw of made-up data, from seed ${String(sweep.firstSeed)}. Here the same ${String(sweep.cases.length)} case shapes are drawn from ${formatCount(sweep.seeds)} seeds, ${String(sweep.firstSeed)} to ${String(lastSeed(sweep))}, and counted with ${sweep.tokenizer} the same way, to show how often each result holds.`;
}

/**
 * "Terset is smaller than X on every seed in A of N cases, on none in B, and on some seeds in C",
 * leaving out empty parts. Cases that tie on every seed are counted apart, so a full tie never reads
 * as a loss: "... in A of N cases and ties on every seed in D", or a second sentence when the list is longer.
 */
function holdLine(sweep: SeedSweep, outcome: (row: SweepCase) => Outcome, other: string): string {
  const outcomes = sweep.cases.map(outcome);
  const every = outcomes.filter(({ under }) => under === sweep.seeds).length;
  const ties = outcomes.filter(({ tied }) => tied === sweep.seeds).length;
  const none = outcomes.filter(({ under, tied }) => under === 0 && tied < sweep.seeds).length;
  const some = outcomes.length - every - ties - none;
  const parts = [`on every seed in ${String(every)} of ${String(outcomes.length)} cases`, ...(none > 0 ? [`on none in ${String(none)}`] : []), ...(some > 0 ? [`on some seeds in ${String(some)}`] : [])];
  const list = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1) ?? ''}`;
  const head = `Terset is smaller than ${other} ${list}`;
  if (ties === 0) return `${head}.`;
  if (parts.length === 1) return `${head} and ties on every seed in ${String(ties)}.`;
  return `${head}. It ties with ${other} on every seed in ${String(ties)}.`;
}

/** How the sample seed compares with most seeds, by case name. */
interface SampleJudgement {
  /** Cases where the sample wins, ties or loses against JSON or TOON the other way from most seeds. */
  readonly odd: readonly string[];
  /** Cases where no result against JSON or TOON holds on more than half the seeds, so there is no "most seeds" to match. */
  readonly even: readonly string[];
}

type Result = 'win' | 'tie' | 'loss';

/** The result on more than half the seeds, or null when there is none. */
function mostSeeds(sweep: SeedSweep, { under, tied }: Outcome): Result | null {
  const counts: readonly (readonly [Result, number])[] = [
    ['win', under],
    ['tie', tied],
    ['loss', sweep.seeds - under - tied],
  ];
  return counts.find(([, count]) => count * 2 > sweep.seeds)?.[0] ?? null;
}

const resultOf = (terset: number, other: number): Result => (terset < other ? 'win' : terset === other ? 'tie' : 'loss');

/** Null while the sample is pending or lacks a row for any sweep case: there is nothing complete to judge. */
function judgeSample(sweep: SeedSweep, sample: CaseSource): SampleJudgement | null {
  if (!('cases' in sample)) return null;
  const odd: string[] = [];
  const even: string[] = [];
  for (const row of sweep.cases) {
    const seed = sample.cases.find((item) => item.name === row.name);
    if (seed === undefined) return null;
    const pairs = [
      [mostSeeds(sweep, jsonOutcome(row)), resultOf(seed.terset, seed.json)],
      [mostSeeds(sweep, toonOutcome(row)), resultOf(seed.terset, seed.toon)],
    ] as const;
    // A clear miss against one format counts even when the other format has no majority.
    if (pairs.some(([most, result]) => most !== null && most !== result)) odd.push(row.name);
    else if (pairs.some(([most]) => most === null)) even.push(row.name);
  }
  return { odd, even };
}

/** How often each result holds, then whether the sample seed is typical. The last line needs a sample row for every case. */
export function sweepLines(sweep: SeedSweep, sample: CaseSource): readonly string[] {
  const holds = [holdLine(sweep, jsonOutcome, 'JSON compact'), holdLine(sweep, toonOutcome, 'TOON')];
  const judged = judgeSample(sweep, sample);
  if (judged === null) return holds;
  const seed = String(sweep.firstSeed);
  const last =
    judged.odd.length > 0
      ? `Seed ${seed} is not typical for ${names(judged.odd)}: it wins, ties or loses against JSON compact or TOON the other way from most seeds.`
      : judged.even.length > 0
        ? `Seed ${seed} wins, ties or loses against JSON compact and TOON the way most seeds do on every case except ${names(judged.even)}, where no result holds on most seeds.`
        : `On every case, seed ${seed} wins, ties or loses against JSON compact and TOON the way most seeds do.`;
  return [...holds, last];
}

/**
 * One README line after the sample results. The sweep counts only JSON compact and TOON,
 * so the line names them: each case wins, ties or loses the same way on every seed, except
 * where the seeds split. It says "ties" only when some case ties on every seed.
 * When the sample seed is not typical, it says that instead.
 */
export function sweepReadmeLine(sweep: SeedSweep, sample: CaseSource): string {
  const head = `Across ${formatCount(sweep.seeds)} seeds of the same ${String(sweep.cases.length)} case shapes, counted with ${sweep.tokenizer},`;
  const odd = judgeSample(sweep, sample)?.odd ?? [];
  if (odd.length > 0) return `${head} seed ${String(sweep.firstSeed)} is not typical for ${names(odd)}: most seeds win, tie or lose against JSON compact or TOON the other way.`;
  const steady = ({ under, tied }: Outcome): boolean => under === sweep.seeds || tied === sweep.seeds || (under === 0 && tied === 0);
  const comparisons = sweep.cases.flatMap((row) =>
    (
      [
        [jsonOutcome(row), 'JSON compact'],
        [toonOutcome(row), 'TOON'],
      ] as const
    ).map(([outcome, other]) => ({ name: row.name, outcome, other })),
  );
  const mixed = comparisons
    .filter(({ outcome }) => !steady(outcome))
    .map(({ name, outcome: { under, tied }, other }) => {
      const ties = tied > 0 ? ` and ties on ${formatCount(tied)}` : '';
      return `${name} against ${other}, where Terset is smaller on ${formatCount(under)} of ${formatCount(sweep.seeds)}${ties}`;
    });
  const verb = comparisons.some(({ outcome }) => outcome.tied === sweep.seeds) ? 'wins, ties or loses' : 'wins or loses';
  const except = mixed.length === 0 ? '' : `, except ${mixed.join('; and ')}`;
  return `${head} Terset ${verb} against JSON compact and TOON the same way on every seed${except}.`;
}

export function sweepMethod(sweep: SeedSweep, withClaude: boolean): string {
  const method = `The seed sweep is \`pnpm sweep\`. It draws each case shape from seeds ${String(sweep.firstSeed)} to ${String(lastSeed(sweep))} with the same generator, counts each draw with ${sweep.tokenizer} as above, and writes \`${SWEEP_FILE}\`. A range is the 5th to the 95th percentile by nearest rank. A tie is not smaller.`;
  return withClaude ? `${method} The Claude counts use seed ${String(sweep.firstSeed)} only.` : method;
}
