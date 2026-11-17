// The real-data counts: the frozen files match their README record, every
// Terset text decodes back to its input, and the committed counts equal a fresh run.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RealDataSchema } from '../src/data/real-data-schema.ts';
import { REAL_DIR, REAL_FILES, REAL_OUTPUT, buildReal, countReal, realText } from './update-real.ts';

const README = new URL('README.md', REAL_DIR);

/** File name to SHA-256, from the table rows in the README record. */
function readmeHashes(): ReadonlyMap<string, string> {
  const rows = [...readFileSync(README, 'utf8').matchAll(/^\| ([\w.-]+) \| \d+ \| ([0-9a-f]{64}) \|$/gmu)];
  return new Map(rows.map((row) => [row[1] ?? '', row[2] ?? '']));
}

describe('real data token counts', () => {
  it('keeps every frozen file equal to the hash in the README record', () => {
    const hashes = readmeHashes();
    const frozen = readdirSync(REAL_DIR).filter((name) => name.endsWith('.json') || name.endsWith('.geojson')).sort();
    expect([...hashes.keys()].sort()).toEqual(frozen);
    for (const name of frozen) {
      const sha = createHash('sha256').update(readFileSync(new URL(name, REAL_DIR))).digest('hex');
      expect(sha, name).toBe(hashes.get(name));
    }
  });

  it('counts every frozen file in the record', () => {
    expect(REAL_FILES.map((file) => file.path.split('/').at(-1)).sort()).toEqual([...readmeHashes().keys()].sort());
  });

  it('decodes every Terset text back to the original value', () => {
    for (const file of REAL_FILES) {
      expect(() => countReal(file), file.name).not.toThrow();
    }
  });

  it('fails when a Terset text does not decode back to its input', () => {
    const file = REAL_FILES[0];
    if (file === undefined) throw new Error('No real files');
    expect(() => countReal(file, () => ({ changed: true }))).toThrow(`Terset round trip failed on ${file.name}`);
  });

  it('keeps the committed file equal to a fresh run', () => {
    expect(readFileSync(REAL_OUTPUT, 'utf8')).toBe(realText(buildReal()));
    expect(RealDataSchema.parse(JSON.parse(readFileSync(REAL_OUTPUT, 'utf8')))).toEqual(buildReal());
  });
});
