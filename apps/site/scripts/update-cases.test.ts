// The committed token-count inputs match a fresh run of the seeded generator.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CASE_SOURCE_NOTE } from '../src/data/bench.ts';
import { parseNeutralInputs } from './claude-inputs.ts';
import { CASE_NAMES, OUTPUT, SEED, buildCases, casesText } from './update-cases.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('token-count case inputs', () => {
  it('keeps the committed file equal to a fresh run of the generator', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(casesText());
  });

  it('builds the published cases from SEED, and other data with the same names from another seed', () => {
    expect(`${JSON.stringify({ cases: buildCases(SEED) }, null, 2)}\n`).toBe(casesText());
    const other = buildCases(SEED + 1);
    expect(other.map((row) => row.name)).toEqual([...CASE_NAMES]);
    for (const [index, row] of other.entries()) {
      expect(JSON.stringify(row.data), row.name).not.toBe(JSON.stringify(buildCases(SEED)[index]?.data));
    }
    expect(JSON.stringify(buildCases(SEED + 1))).toBe(JSON.stringify(other));
  });

  it('writes the eleven named cases in a fixed order, in the shape both counters read', () => {
    expect(parseNeutralInputs(casesText()).map((row) => row.name)).toEqual([...CASE_NAMES]);
    expect(CASE_NAMES).toHaveLength(11);
  });

  it('names the real seed and file in the published case-source note', () => {
    expect(CASE_SOURCE_NOTE).toContain(`seed ${String(SEED)}`);
    expect(CASE_SOURCE_NOTE).toContain(`\`${relative(ROOT, OUTPUT)}\``);
    expect(CASE_SOURCE_NOTE).toContain(`All ${String(CASE_NAMES.length)} case inputs`);
  });
});
