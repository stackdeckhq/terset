// The seed sweep: its summary math, its parity with the published single-seed
// counts, and the committed file equal to a fresh run.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SeedSweepSchema } from '../src/data/seed-sweep-schema.ts';
import { SEED, buildCases } from './update-cases.ts';
import { SWEEP_OUTPUT, buildSweep, countCase, summarize, sweepText } from './update-sweep.ts';

const BENCH = JSON.parse(readFileSync(new URL('../src/data/bench-results.json', import.meta.url), 'utf8')) as {
  cases: readonly { name: string; json: number; toon: number; terset: number }[];
};

describe('seed sweep', () => {
  it('counts strict wins and nearest-rank spreads of the one-decimal signed changes', () => {
    const row = summarize('Fixture', [
      { json: 100, toon: 80, terset: 90 },
      { json: 100, toon: 100, terset: 100 },
      { json: 200, toon: 150, terset: 120 },
      { json: 3, toon: 3, terset: 2 },
    ]);
    expect(row).toEqual({
      name: 'Fixture',
      underToon: 2,
      underJson: 3,
      vsJson: { p5: -40, median: -33.3, p95: 0 },
      vsToon: { p5: -33.3, median: -20, p95: 12.5 },
    });
  });

  it('counts the published seed exactly as the published o200k table does', () => {
    const counted = buildCases(SEED).map((row) => ({ name: row.name, ...countCase(row.data) }));
    expect(counted).toEqual(BENCH.cases.map(({ name, json, toon, terset }) => ({ name, json, toon, terset })));
  });

  it('keeps the committed file equal to a fresh run of all seeds', () => {
    const committed = readFileSync(SWEEP_OUTPUT, 'utf8');
    expect(() => SeedSweepSchema.parse(JSON.parse(committed))).not.toThrow();
    expect(committed).toBe(sweepText(buildSweep()));
  }, 180_000);
});
