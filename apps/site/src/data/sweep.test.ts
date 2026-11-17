// The seed sweep's table and lines, from a small fixture and from the committed file.
import { describe, expect, it } from 'vitest';
import { benchmarkMarkdown, benchmarkMethod } from './benchmark-doc.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import type { SeedSweep } from './seed-sweep-schema.ts';
import { SWEEP, SWEEP_TABLE_HEAD, sweepIntro, sweepLines, sweepMethod, sweepReadmeLine, sweepTableRows, sweepTitle } from './sweep.ts';

const spread = (p5: number, median: number, p95: number) => ({ p5, median, p95 });

const FIXTURE: SeedSweep = {
  tokenizer: 'o200k_base',
  toonVersion: '4.4.0',
  firstSeed: 100,
  seeds: 1000,
  cases: [
    { name: 'Rows', underToon: 1000, tiedToon: 0, underJson: 1000, tiedJson: 0, vsJson: spread(-22.5, -21.2, -19.8), vsToon: spread(-34.9, -33.2, -31.2) },
    { name: 'Text', underToon: 0, tiedToon: 0, underJson: 1000, tiedJson: 0, vsJson: spread(-13.9, -13.3, -12.8), vsToon: spread(1.3, 1.5, 1.7) },
    { name: 'Mixed', underToon: 985, tiedToon: 15, underJson: 0, tiedJson: 1000, vsJson: spread(0, 0, 0), vsToon: spread(-1.2, -1.2, 0) },
  ],
};

/** FIXTURE with one case changed. */
const withCase = (name: string, change: Partial<SeedSweep['cases'][number]>): SeedSweep => ({
  ...FIXTURE,
  cases: FIXTURE.cases.map((row) => (row.name === name ? { ...row, ...change } : row)),
});

const sample = (rows: readonly { name: string; terset: number; json: number; toon: number }[]) => ({
  cases: rows.map((row) => ({ ...row, jsonPretty: 0, yaml: 0, csv: null, csvExact: null })),
});

describe('seed sweep text', () => {
  it('writes one row per case: seeds under, median change and the 5th to 95th percentile range', () => {
    expect(SWEEP_TABLE_HEAD).toEqual(['Case', 'Under JSON', 'vs JSON, median', 'vs JSON, 5th to 95th', 'Under TOON', 'vs TOON, median', 'vs TOON, 5th to 95th']);
    expect(sweepTableRows(FIXTURE)).toEqual([
      ['Rows', '1,000 of 1,000', '−21.2%', '−22.5% to −19.8%', '1,000 of 1,000', '−33.2%', '−34.9% to −31.2%'],
      ['Text', '1,000 of 1,000', '−13.3%', '−13.9% to −12.8%', '0 of 1,000', '+1.5%', '+1.3% to +1.7%'],
      ['Mixed', 'Tie on all 1,000', '0.0%', '0.0%', '985 of 1,000, 15 tied', '−1.2%', '−1.2% to 0.0%'],
    ]);
  });

  it('names ties in a cell only when there are some, and never reads a full tie as a loss', () => {
    const cells = (sweep: SeedSweep) => sweepTableRows(sweep).map((row) => [row[1], row[4]]);
    expect(cells(withCase('Mixed', { underJson: 400, tiedJson: 20 })).at(-1)).toEqual(['400 of 1,000, 20 tied', '985 of 1,000, 15 tied']);
    expect(cells(withCase('Mixed', { underJson: 0, tiedJson: 999 })).at(-1)).toEqual(['0 of 1,000, 999 tied', '985 of 1,000, 15 tied']);
    expect(cells(withCase('Mixed', { underJson: 0, tiedJson: 0 })).at(-1)).toEqual(['0 of 1,000', '985 of 1,000, 15 tied']);
  });

  it('says how often each result holds in every mix of wins, ties and losses', () => {
    const holds = (sweep: SeedSweep) => sweepLines(sweep, { status: 'pending', reason: 'Not measured.' });
    expect(holds(withCase('Text', { underJson: 0 }))).toEqual([
      'Terset is smaller than JSON compact on every seed in 1 of 3 cases and on none in 1. It ties with JSON compact on every seed in 1.',
      'Terset is smaller than TOON on every seed in 1 of 3 cases, on none in 1, and on some seeds in 1.',
    ]);
    expect(holds(withCase('Text', { underToon: 0, tiedToon: 1000 })).at(1)).toBe('Terset is smaller than TOON on every seed in 1 of 3 cases and on some seeds in 1. It ties with TOON on every seed in 1.');
    expect(holds(withCase('Mixed', { tiedJson: 999 })).at(0)).toBe('Terset is smaller than JSON compact on every seed in 2 of 3 cases and on none in 1.');
    expect(holds(withCase('Mixed', { underJson: 600, tiedJson: 400 })).at(0)).toBe('Terset is smaller than JSON compact on every seed in 2 of 3 cases and on some seeds in 1.');
  });

  it('names the seeds, says how often each result holds, and checks the sample seed against most seeds', () => {
    expect(sweepTitle(FIXTURE)).toBe('Across 1,000 seeds');
    expect(sweepIntro(FIXTURE)).toBe(
      'The sample cases are one draw of made-up data, from seed 100. Here the same 3 case shapes are drawn from 1,000 seeds, 100 to 1099, and counted with o200k_base the same way, to show how often each result holds.',
    );
    const typical = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 100, json: 100, toon: 115 },
    ]);
    expect(sweepLines(FIXTURE, typical)).toEqual([
      'Terset is smaller than JSON compact on every seed in 2 of 3 cases and ties on every seed in 1.',
      'Terset is smaller than TOON on every seed in 1 of 3 cases, on none in 1, and on some seeds in 1.',
      'On every case, seed 100 wins, ties or loses against JSON compact and TOON the way most seeds do.',
    ]);
    const lucky = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 95 },
      { name: 'Mixed', terset: 99, json: 100, toon: 115 },
    ]);
    expect(sweepLines(FIXTURE, lucky).at(-1)).toBe('Seed 100 is not typical for Text and Mixed: it wins, ties or loses against JSON compact or TOON the other way from most seeds.');
    expect(sweepLines(FIXTURE, { status: 'pending', reason: 'Not measured.' })).toHaveLength(2);
  });

  it('judges a tie apart from a loss when it checks the sample seed', () => {
    const rows = (mixedTerset: number) =>
      sample([
        { name: 'Rows', terset: 80, json: 100, toon: 120 },
        { name: 'Text', terset: 90, json: 100, toon: 85 },
        { name: 'Mixed', terset: mixedTerset, json: 100, toon: 115 },
      ]);
    const odd = 'Seed 100 is not typical for Mixed: it wins, ties or loses against JSON compact or TOON the other way from most seeds.';
    // Most seeds tie with JSON on Mixed, so a sample that loses there is not typical.
    expect(sweepLines(FIXTURE, rows(110)).at(-1)).toBe(odd);
    expect(sweepLines(withCase('Mixed', { tiedJson: 999 }), rows(110)).at(-1)).toBe(odd);
    // Most seeds lose, so a sample that ties is not typical either.
    expect(sweepLines(withCase('Mixed', { tiedJson: 1 }), rows(100)).at(-1)).toBe(odd);
    // No result holds on more than half the seeds: 400 wins, 300 ties, 300 losses.
    expect(sweepLines(withCase('Mixed', { underJson: 400, tiedJson: 300 }), rows(100)).at(-1)).toBe(
      'Seed 100 wins, ties or loses against JSON compact and TOON the way most seeds do on every case except Mixed, where no result holds on most seeds.',
    );
    // No majority against JSON must not hide a clear miss against TOON: most seeds win there and the sample loses.
    const noMajority = withCase('Mixed', { underJson: 400, tiedJson: 300, underToon: 999, tiedToon: 0 });
    const losesBoth = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 110, json: 100, toon: 105 },
    ]);
    expect(sweepLines(noMajority, losesBoth).at(-1)).toBe(odd);
    expect(sweepReadmeLine(noMajority, losesBoth)).toContain('seed 100 is not typical for Mixed');
    expect(sweepReadmeLine(FIXTURE, rows(110))).toBe(
      'Across 1,000 seeds of the same 3 case shapes, counted with o200k_base, seed 100 is not typical for Mixed: most seeds win, tie or lose against JSON compact or TOON the other way.',
    );
  });

  it('judges the sample seed only when every case has a sample row, and never against an even split', () => {
    const partial = sample([{ name: 'Rows', terset: 80, json: 100, toon: 120 }]);
    expect(sweepLines(FIXTURE, partial)).toHaveLength(2);
    const split: SeedSweep = { ...FIXTURE, cases: FIXTURE.cases.map((row) => (row.name === 'Text' ? { ...row, underToon: 500 } : row)) };
    const textWins = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 95 },
      { name: 'Mixed', terset: 100, json: 100, toon: 115 },
    ]);
    const textLoses = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 100, json: 100, toon: 115 },
    ]);
    const evenLine = 'Seed 100 wins, ties or loses against JSON compact and TOON the way most seeds do on every case except Text, where no result holds on most seeds.';
    expect(sweepLines(split, textWins).at(-1)).toBe(evenLine);
    expect(sweepLines(split, textLoses).at(-1)).toBe(evenLine);
  });

  it('writes the README line: every seed, the cases that win on some seeds, or the atypical cases', () => {
    const typical = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 100, json: 100, toon: 115 },
    ]);
    expect(sweepReadmeLine(FIXTURE, typical)).toBe(
      'Across 1,000 seeds of the same 3 case shapes, counted with o200k_base, Terset wins, ties or loses against JSON compact and TOON the same way on every seed, except Mixed against TOON, where Terset is smaller on 985 of 1,000 and ties on 15.',
    );
    // Most seeds lose to JSON here, so the sample row loses too.
    const mixedLoses = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 110, json: 100, toon: 115 },
    ]);
    expect(sweepReadmeLine(withCase('Mixed', { underJson: 0, tiedJson: 400 }), mixedLoses)).toBe(
      'Across 1,000 seeds of the same 3 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed, except Mixed against JSON compact, where Terset is smaller on 0 of 1,000 and ties on 400; and Mixed against TOON, where Terset is smaller on 985 of 1,000 and ties on 15.',
    );
    const steady: SeedSweep = { ...FIXTURE, cases: FIXTURE.cases.slice(0, 2) };
    expect(sweepReadmeLine(steady, typical)).toBe(
      'Across 1,000 seeds of the same 2 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed.',
    );
    const lucky = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 95 },
      { name: 'Mixed', terset: 100, json: 100, toon: 115 },
    ]);
    expect(sweepReadmeLine(FIXTURE, lucky)).toBe(
      'Across 1,000 seeds of the same 3 case shapes, counted with o200k_base, seed 100 is not typical for Text: most seeds win, tie or lose against JSON compact or TOON the other way.',
    );
  });

  it('states the method with the real command, file and seed range', () => {
    const method =
      'The seed sweep is `pnpm sweep`. It draws each case shape from seeds 100 to 1099 with the same generator, counts each draw with o200k_base as above, and writes `apps/site/src/data/seed-sweep.json`. A range is the 5th to the 95th percentile by nearest rank. A tie is not smaller.';
    expect(sweepMethod(FIXTURE, false)).toBe(method);
    expect(sweepMethod(FIXTURE, true)).toBe(`${method} The Claude counts use seed 100 only.`);
  });

  it('puts the committed sweep in benchmark.md and the method', () => {
    const doc = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    expect(doc).toContain(`## ${sweepTitle(SWEEP)}, ${SWEEP.tokenizer}\n\n${sweepIntro(SWEEP)}`);
    expect(doc).toContain(`| ${SWEEP_TABLE_HEAD.join(' | ')} |`);
    for (const row of sweepTableRows(SWEEP)) expect(doc).toContain(`| ${row.join(' | ')} |`);
    expect(benchmarkMethod(BENCH_FILE, CLAUDE_FILE)).toContain(sweepMethod(SWEEP, CLAUDE_FILE.status === 'ready'));
  });

  it('finds the committed sample seed typical of the sweep on every case', () => {
    expect(SWEEP.firstSeed).toBe(20261117);
    expect(BENCH_FILE.status).toBe('ready');
    if (BENCH_FILE.status !== 'ready') return;
    expect(sweepLines(SWEEP, BENCH_FILE).at(-1)).toBe(`On every case, seed ${String(SWEEP.firstSeed)} wins, ties or loses against JSON compact and TOON the way most seeds do.`);
  });
});
