// The losses line: one computed sentence group that names every case where TOON's best
// is smaller than Terset, says how much of Terset's total the file lists hold, and gives
// the median saving per case. Each fact comes from the counter's cases, and the line
// throws when the data stops supporting what it says.
import { describe, expect, it } from 'vitest';
import { BENCH_FIXTURE } from './bench-fixture.dev.ts';
import type { CaseRow } from './bench-schema.ts';
import { lossesLine } from './bench.ts';
import { BENCH_FILE, COUNTERS } from './numbers.ts';

function row(name: string, terset: number, json: number, toon: number): CaseRow {
  return { name, terset, json, jsonPretty: json * 2, yaml: json, toon, csv: null, csvExact: null };
}

const FILE_LISTS = [row('File list, short', 600, 1000, 700), row('File list, long', 400, 1000, 500)];

describe('the losses line', () => {
  it('names both o200k_base losses and states the file-list share and the medians from the committed data', () => {
    if (BENCH_FILE.status !== 'ready') throw new Error('the committed bench file should be ready');
    expect(lossesLine(BENCH_FILE)).toBe(
      "TOON's best is smaller than Terset on 2 cases: Translation batch; Reviews, long text. The 2 file-list cases hold 57% of Terset's total. Per case, the median saving is 21.5% against compact JSON and 7.3% against TOON's best.",
    );
  });

  it('names the one Claude loss in the singular', () => {
    const claude = COUNTERS?.claude;
    if (claude === null || claude === undefined) throw new Error('the committed Claude counts should be ready');
    const line = lossesLine(claude);
    expect(line).toMatch(/^TOON's best is smaller than Terset on 1 case: Deep nested config\. /u);
    expect(line).toContain("The 2 file-list cases hold 56% of Terset's total.");
  });

  it('says there are none when TOON is never smaller', () => {
    const line = lossesLine({ cases: [...FILE_LISTS, row('Config', 100, 200, 150)] });
    expect(line).toMatch(/^TOON's best is smaller than Terset on none of the 3 cases\. /u);
  });

  // "Translation batch and Reviews, long text" reads as one case, so a comma in either name means a semicolon.
  it('joins two losses with "and", or with a semicolon when a name holds a comma', () => {
    const wins = ['A', 'B', 'C', 'D'].map((name) => row(name, 10, 20, 15));
    const files = FILE_LISTS;
    expect(lossesLine({ cases: [...files, row('Logs', 90, 100, 80), row('Orders', 90, 100, 80), ...wins] })).toMatch(/^TOON's best is smaller than Terset on 2 cases: Logs and Orders\. /u);
    expect(lossesLine({ cases: [...files, row('Logs', 90, 100, 80), row('Reviews, long text', 90, 100, 80), ...wins] })).toMatch(
      /^TOON's best is smaller than Terset on 2 cases: Logs; Reviews, long text\. /u,
    );
  });

  it('lists three or more losses with semicolons, since case names hold commas', () => {
    const wins = ['A', 'B', 'C', 'D'].map((name) => row(name, 10, 20, 15));
    const cases = [row('File list, short', 600, 1000, 500), row('File list, long', 400, 1000, 300), row('Reviews, long text', 90, 100, 80), ...wins];
    expect(lossesLine({ cases })).toMatch(/^TOON's best is smaller than Terset on 3 cases: File list, short; File list, long; and Reviews, long text\. /u);
  });

  it('uses the singular for one file-list case, and computes its share', () => {
    const line = lossesLine({ cases: [row('File list', 300, 1000, 400), row('Config', 100, 200, 150)] });
    expect(line).toContain("The file-list case holds 75% of Terset's total.");
  });

  it('takes the middle of an even count as the mean of the two middle savings', () => {
    // Savings against compact JSON: 40%, 60%, 10%, 20%. Middle two: 20% and 40%.
    const cases = [row('File list, short', 600, 1000, 700), row('File list, long', 400, 1000, 500), row('A', 90, 100, 100), row('B', 80, 100, 100)];
    expect(lossesLine({ cases })).toContain('the median saving is 30.0% against compact JSON');
  });

  it('throws when no case name starts with "File list" any more', () => {
    expect(() => lossesLine({ cases: [row('Files, short', 600, 1000, 700), row('Config', 100, 200, 150)] })).toThrow(/File list/u);
  });

  it('throws when the median case saves nothing against compact JSON or TOON', () => {
    const noJsonSaving = [...FILE_LISTS.map((item) => ({ ...item, json: item.terset })), row('Config', 100, 100, 150)];
    expect(() => lossesLine({ cases: noJsonSaving })).toThrow(/compact JSON/u);
    const noToonSaving = [...FILE_LISTS.map((item) => ({ ...item, toon: item.terset })), row('Config', 100, 200, 100)];
    expect(() => lossesLine({ cases: noToonSaving })).toThrow(/TOON/u);
  });

  it('builds from the dev fixture too, so `VITE_BENCH_FIXTURE=1 pnpm dev` still renders home', () => {
    if (BENCH_FIXTURE === null) throw new Error('the dev bench fixture is missing');
    expect(lossesLine(BENCH_FIXTURE)).toContain('file-list case');
  });

  it('throws on an empty case set', () => {
    expect(() => lossesLine({ cases: [] })).toThrow(/no cases/u);
  });
});
