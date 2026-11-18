// The real-data section reads the committed counts and shows every loss as measured.
import { describe, expect, it } from 'vitest';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import { HISTORY_NOTE } from './history.ts';
import { REAL, REAL_TABLE_HEAD, realChange, realLines, realMethod, realTableRows } from './real.ts';
import type { RealData } from './real-data-schema.ts';

const ONE = (terset: number, json: number, toon: number): RealData => ({
  tokenizer: 'o200k_base',
  toonVersion: '4.4.0',
  files: [{ name: 'One file', path: 'bench/data/real/one.json', source: 'https://example.com/one.json', fetched: '2026-11-17', sha256: '0'.repeat(64), bytes: 10, json, jsonPretty: json + 10, toon, toonDefault: toon, terset }],
});

describe('real data section', () => {
  it('gives one row per file, Terset first, in the head order', () => {
    expect(REAL_TABLE_HEAD).toEqual(['File', 'Terset', 'Compact JSON', 'Pretty JSON', 'TOON best', 'Terset vs compact JSON', 'Terset vs TOON']);
    expect(realTableRows(REAL).map((row) => row[0])).toEqual(REAL.files.map((file) => file.name));
    expect(realTableRows(ONE(90, 100, 80))).toEqual([['One file', '90', '100', '110', '80', '−10.0%', '+12.5%']]);
  });

  it('shows a loss too small to round as tokens, never as no change', () => {
    expect(realChange(34_068, 34_067)).toBe('+1 token');
    expect(realChange(34_065, 34_067)).toBe('−2 tokens');
    expect(realChange(100, 100)).toBe('0.0%');
    expect(realLines(ONE(34_068, 34_067, 30_000))).toEqual(['One file: Terset has 1 more token than compact JSON and 13.6% more tokens than TOON.']);
    expect(realLines(ONE(90, 100, 90))).toEqual(['One file: Terset has 10.0% fewer tokens than compact JSON and as many tokens as TOON.']);
  });

  it('says where the data comes from, when it was frozen and that nothing was tuned on it', () => {
    const method = realMethod(REAL);
    expect(method).toContain('2026-11-17');
    expect(method).toContain('nothing was tuned on them');
    expect(method).toContain('`bench/data/real/README.md`');
    expect(method).toContain('rulesFor(text)');
  });

  it('puts the section in benchmark.md, and the history note points at it without a date', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    expect(text).toContain(`## Real data, ${REAL.tokenizer}`);
    expect(text).toContain(`| ${REAL_TABLE_HEAD.join(' | ')} |`);
    for (const line of realLines(REAL)) expect(text).toContain(line);
    expect(text.indexOf('## Real data')).toBeLessThan(text.indexOf('## Number history'));
    expect(HISTORY_NOTE).toContain('Real data');
    expect(HISTORY_NOTE).not.toContain('real-world data are in progress');
  });
});
