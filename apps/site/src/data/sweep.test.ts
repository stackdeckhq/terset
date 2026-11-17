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
    { name: 'Rows', underToon: 1000, underJson: 1000, vsJson: spread(-22.5, -21.2, -19.8), vsToon: spread(-34.9, -33.2, -31.2) },
    { name: 'Text', underToon: 0, underJson: 1000, vsJson: spread(-13.9, -13.3, -12.8), vsToon: spread(1.3, 1.5, 1.7) },
    { name: 'Mixed', underToon: 985, underJson: 0, vsJson: spread(15.5, 15.5, 15.5), vsToon: spread(-1.2, -1.2, 0) },
  ],
};

const sample = (rows: readonly { name: string; terset: number; json: number; toon: number }[]) => ({
  cases: rows.map((row) => ({ ...row, jsonPretty: 0, yaml: 0, csv: null, csvExact: null })),
});

describe('seed sweep text', () => {
  it('writes one row per case: seeds under, median change and the 5th to 95th percentile range', () => {
    expect(SWEEP_TABLE_HEAD).toEqual(['Case', 'Under JSON', 'vs JSON, median', 'vs JSON, 5th to 95th', 'Under TOON', 'vs TOON, median', 'vs TOON, 5th to 95th']);
    expect(sweepTableRows(FIXTURE)).toEqual([
      ['Rows', '1,000 of 1,000', '−21.2%', '−22.5% to −19.8%', '1,000 of 1,000', '−33.2%', '−34.9% to −31.2%'],
      ['Text', '1,000 of 1,000', '−13.3%', '−13.9% to −12.8%', '0 of 1,000', '+1.5%', '+1.3% to +1.7%'],
      ['Mixed', '0 of 1,000', '+15.5%', '+15.5%', '985 of 1,000', '−1.2%', '−1.2% to 0.0%'],
    ]);
  });

  it('names the seeds, says how often each result holds, and checks the sample seed against most seeds', () => {
    expect(sweepTitle(FIXTURE)).toBe('Across 1,000 seeds');
    expect(sweepIntro(FIXTURE)).toBe(
      'The sample cases are one draw of made-up data, from seed 100. Here the same 3 case shapes are drawn from 1,000 seeds, 100 to 1099, and counted with o200k_base the same way, to show how often each result holds.',
    );
    const typical = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 110, json: 100, toon: 115 },
    ]);
    expect(sweepLines(FIXTURE, typical)).toEqual([
      'Terset is smaller than JSON compact on every seed in 2 of 3 cases and on none in 1.',
      'Terset is smaller than TOON on every seed in 1 of 3 cases, on none in 1, and on some seeds in 1.',
      'On every case, seed 100 wins or loses against JSON compact and TOON the way most seeds do.',
    ]);
    const lucky = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 95 },
      { name: 'Mixed', terset: 99, json: 100, toon: 115 },
    ]);
    expect(sweepLines(FIXTURE, lucky).at(-1)).toBe('Seed 100 is not typical for Text and Mixed: it wins or loses against JSON compact or TOON the other way from most seeds.');
    expect(sweepLines(FIXTURE, { status: 'pending', reason: 'Not measured.' })).toHaveLength(2);
  });

  it('judges the sample seed only when every case has a sample row, and never against an even split', () => {
    const partial = sample([{ name: 'Rows', terset: 80, json: 100, toon: 120 }]);
    expect(sweepLines(FIXTURE, partial)).toHaveLength(2);
    const split: SeedSweep = { ...FIXTURE, cases: FIXTURE.cases.map((row) => (row.name === 'Text' ? { ...row, underToon: 500 } : row)) };
    const textWins = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 95 },
      { name: 'Mixed', terset: 110, json: 100, toon: 115 },
    ]);
    const textLoses = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 110, json: 100, toon: 115 },
    ]);
    const evenLine = 'Seed 100 wins or loses against JSON compact and TOON the way most seeds do on every case except Text, where the seeds split evenly.';
    expect(sweepLines(split, textWins).at(-1)).toBe(evenLine);
    expect(sweepLines(split, textLoses).at(-1)).toBe(evenLine);
  });

  it('writes the README line: every seed, the cases that win on some seeds, or the atypical cases', () => {
    const typical = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 85 },
      { name: 'Mixed', terset: 110, json: 100, toon: 115 },
    ]);
    expect(sweepReadmeLine(FIXTURE, typical)).toBe(
      'Across 1,000 seeds of the same 3 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed, except Mixed against TOON, where Terset is smaller on 985 of 1,000.',
    );
    const steady: SeedSweep = { ...FIXTURE, cases: FIXTURE.cases.slice(0, 2) };
    expect(sweepReadmeLine(steady, typical)).toBe(
      'Across 1,000 seeds of the same 2 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed.',
    );
    const lucky = sample([
      { name: 'Rows', terset: 80, json: 100, toon: 120 },
      { name: 'Text', terset: 90, json: 100, toon: 95 },
      { name: 'Mixed', terset: 110, json: 100, toon: 115 },
    ]);
    expect(sweepReadmeLine(FIXTURE, lucky)).toBe(
      'Across 1,000 seeds of the same 3 case shapes, counted with o200k_base, seed 100 is not typical for Text: most seeds win or lose against JSON compact or TOON the other way.',
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
    expect(sweepLines(SWEEP, BENCH_FILE).at(-1)).toBe(`On every case, seed ${String(SWEEP.firstSeed)} wins or loses against JSON compact and TOON the way most seeds do.`);
  });
});
