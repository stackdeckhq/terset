// The data modules type their JSON without parsing it. These tests prove the
// typed values match their schemas, and that no data import skips the check.
import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BENCH_FILE } from './numbers.ts';
import { DATA_CHECKS, checkSiteData } from './data-check.ts';

const DATA_DIR = new URL('./', import.meta.url);

describe('site data check', () => {
  it('passes for the committed data', () => {
    expect(() => {
      checkSiteData();
    }).not.toThrow();
  });

  it.each(DATA_CHECKS.map((item) => [item.source, item] as const))('%s parses to the same value it is typed as', (_source, { schema, value }) => {
    expect(schema.parse(value)).toStrictEqual(value);
  });

  it('names the file and the field when a value is wrong', () => {
    const bad = DATA_CHECKS.map((item) => (item.value === BENCH_FILE ? { ...item, value: { ...BENCH_FILE, status: 'done' } } : item));
    expect(() => {
      checkSiteData(bad);
    }).toThrow(/^src\/data\/bench-results\.json does not match its schema: status /u);
  });

  it('covers every JSON file a data module imports', () => {
    const sources = new Set(DATA_CHECKS.map((item) => item.source));
    const modules = readdirSync(DATA_DIR).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    const imported = modules.flatMap((name) => {
      const text = readFileSync(new URL(name, DATA_DIR), 'utf8');
      return [...text.matchAll(/from '(\.{1,2}\/[^']+\.json)'/gu)].map((match) => posix.join('src/data', match[1] ?? ''));
    });
    expect(imported.length).toBeGreaterThan(0);
    for (const path of imported) expect(sources, path).toContain(path);
  });
});
