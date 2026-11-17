// The committed bench file holds measured counts, the fixture can only be
// picked in dev, and every headline and note is computed from the data.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { describe, expect, it } from 'vitest';
import { RULES } from '../lib/format.ts';
import { BENCH_FIXTURE, FIXTURE_MARKER } from './bench-fixture.dev.ts';
import { BENCH_FIXTURE as SHIP_FIXTURE } from './bench-fixture.ship.ts';
import { parseBench } from './bench-schema.ts';
import type { BenchReady } from './bench-schema.ts';
import type { CaseSet, Counter } from './numbers.ts';
import { benchmarkKeepElse, benchmarkMarkdown } from './benchmark-doc.ts';
import { SIZE_LINE } from './size.ts';
import { SWEEP, sweepReadmeLine } from './sweep.ts';
import {
  BENCH,
  BENCH_FILE,
  CASE_SOURCE_NOTE,
  CLAUDE_FILE,
  COST_TABLE_HEAD,
  COUNTERS,
  PENDING_TITLE,
  PRICES,
  claudeMethod,
  costMethod,
  costTableRows,
  costTotalsRow,
  priceLine,
  toonWinsNote,
  benchHeadline,
  benchSummary,
  benchTotals,
  benchTotalsRow,
  compareTokens,
  csvCell,
  csvNote,
  formatCount,
  jsonWinsNote,
  pct,
  selectBench,
  totalsNote,
  underJson,
  underToon,
} from './numbers.ts';

const SAMPLES: BenchReady['samples'] = { orders: { json: 1, toon: 1, terset: 1 }, servers: { json: 1, toon: 1, terset: 1 }, config: { json: 1, toon: 1, terset: 1 } };

/** The yaml version this site installs, so the file cannot claim another one. */
const YAML_VERSION = (JSON.parse(readFileSync(createRequire(import.meta.url).resolve('yaml/package.json'), 'utf8')) as { version: string }).version;

/** The TOON encoder this site counts with, read from its installed package. */
// Its exports map hides package.json from resolve, so read the site's installed copy directly.
const TOON_INSTALLED = (JSON.parse(readFileSync(new URL('../../node_modules/@toon-format/toon/package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** The README's benchmark table: fewer columns than benchmark.md, a plain hyphen for minus. */
function readmeBenchTable(bench: CaseSet): string {
  const head = '| Case | Terset | JSON compact | YAML | TOON best | Terset vs JSON compact |\n|---|---|---|---|---|---|';
  const rows = bench.cases.map((row) => `| ${[row.name, formatCount(row.terset), formatCount(row.json), formatCount(row.yaml), formatCount(row.toon), pct(row.terset, row.json).replace('−', '-')].join(' | ')} |`);
  const totals = benchTotals(bench);
  const total = `| Total | ${[formatCount(totals.terset), formatCount(totals.json), formatCount(totals.yaml), formatCount(totals.toon), pct(totals.terset, totals.json).replace('−', '-')].join(' | ')} |`;
  return [head, ...rows, total].join('\n');
}

/** The README's cost table for one counter: the site's cost cells, a plain hyphen for minus. */
function readmeCostTable(counter: Counter): string {
  const line = (cells: readonly string[]): string => `| ${cells.map((cell) => cell.replace('−', '-')).join(' | ')} |`;
  return [`${line(COST_TABLE_HEAD)}\n|---|---|---|---|`, ...costTableRows(counter).map(line), line(costTotalsRow(counter))].join('\n');
}

// The Python README carries the same Benchmark section as the npm README, so it is pinned too.
const READMES = ['../../../../README.md', '../../../../packages/terset/README.md', '../../../../packages/terset-py/README.md'] as const;

function readme(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

/** Markdown paragraphs wrap, so compare text with runs of white space made one space. */
function flat(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

describe('bench numbers', () => {
  it('ships the measured file, not the fixture', () => {
    expect(BENCH).toBe(BENCH_FILE);
    expect(BENCH_FILE.status).toBe('ready');
    if (BENCH_FILE.status !== 'ready') return;
    expect(BENCH_FILE.tokenizer).toBe('o200k_base');
    expect(BENCH_FILE.cases.every((row) => !row.name.startsWith('Fake'))).toBe(true);
    expect(benchHeadline(BENCH_FILE)).toBe(`Fewer tokens than TOON in ${String(underToon(BENCH_FILE))} of ${String(BENCH_FILE.cases.length)} cases.`);
  });

  it('counts the RULES line the encoder exports', () => {
    expect(RULES.length).toBeGreaterThan(0);
    if (BENCH_FILE.status !== 'ready') return;
    expect(BENCH_FILE.rulesTokens).toBe(tokens(RULES).length);
  });

  it('uses the fixture only when asked for', () => {
    expect(BENCH_FIXTURE).not.toBeNull();
    if (BENCH_FIXTURE === null) return;
    expect(selectBench(BENCH_FILE, BENCH_FIXTURE, false)).toBe(BENCH_FILE);
    expect(selectBench(BENCH_FILE, BENCH_FIXTURE, true)).toBe(BENCH_FIXTURE);
    expect(selectBench(BENCH_FILE, SHIP_FIXTURE, true)).toBe(BENCH_FILE);
  });

  it('marks the fixture as fake so a build can detect it', () => {
    expect(FIXTURE_MARKER).not.toBe('');
    expect(BENCH_FIXTURE?.tokenizer).toBe(FIXTURE_MARKER);
  });

  it('computes the headline and notes from the data', () => {
    if (BENCH_FIXTURE === null) return;
    expect(underToon(BENCH_FIXTURE)).toBe(3);
    expect(underJson(BENCH_FIXTURE)).toBe(2);
    expect(benchHeadline(BENCH_FIXTURE)).toBe('Fewer tokens than TOON in 3 of 5 cases.');
    expect(benchSummary(BENCH_FIXTURE)).toContain('in 3 of 5 cases and under compact JSON in 2 of 5');
    expect(jsonWinsNote(BENCH_FIXTURE)).toContain('fake case 2, close (1,000 vs 1,010) and fake case 3, tiny (60 vs 100) and fake case 5, nested (400 vs 440)');
    expect(jsonWinsNote(BENCH_FIXTURE)).not.toContain('no list of records');
    expect(csvNote(BENCH_FIXTURE)).toContain('50 to 50 tokens smaller on 1 flat');
  });

  // A tie is not a win, so "Where Terset does not win" lists it next to the cases JSON wins.
  it('lists a tie with compact JSON in the JSON note', () => {
    const bench: BenchReady = {
      status: 'ready',
      tokenizer: 'o200k_base',
      rulesTokens: 40,
      yamlVersion: '2.9.1',
      cases: [
        { name: 'Win', json: 900, jsonPretty: 1500, yaml: 1100, toon: 800, csv: null, csvExact: null, terset: 700 },
        { name: 'Tie', json: 63, jsonPretty: 90, yaml: 89, toon: 99, csv: null, csvExact: null, terset: 63 },
      ],
      samples: SAMPLES,
    };
    expect(jsonWinsNote(bench)).toBe('Compact JSON is smaller than or equal to Terset on tie (63 vs 63).');
  });

  it('names the case where CSV is larger by the most', () => {
    const bench: BenchReady = {
      status: 'ready',
      tokenizer: 'o200k_base',
      rulesTokens: 40,
      yamlVersion: '2.9.1',
      cases: [
        { name: 'Flat', json: 900, jsonPretty: 1500, yaml: 1100, toon: 800, csv: 700, csvExact: true, terset: 730 },
        { name: 'Small gap', json: 500, jsonPretty: 800, yaml: 600, toon: 500, csv: 460, csvExact: false, terset: 450 },
        { name: 'Big gap', json: 900, jsonPretty: 1500, yaml: 1100, toon: 900, csv: 990, csvExact: false, terset: 800 },
      ],
      samples: SAMPLES,
    };
    expect(csvNote(bench)).toContain('On big gap it is larger: 990 vs 800.');
  });

  it('marks CSV that is missing or lost data', () => {
    const row = { name: 'a', json: 1, jsonPretty: 1, yaml: 1, toon: 1, terset: 1 };
    expect(csvCell({ ...row, csv: null, csvExact: null })).toBe('n/a');
    expect(csvCell({ ...row, csv: 1200, csvExact: false })).toBe('1,200 lossy');
    expect(csvCell({ ...row, csv: 1200, csvExact: true })).toBe('1,200');
  });

  it('names the installed TOON version in the method, the READMEs and the size line', () => {
    const line = `TOON is the \`@toon-format/toon\` package, version ${TOON_INSTALLED}, the smaller of its comma and tab forms for each case.`;
    expect(benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE)).toContain(`- ${line}\n`);
    for (const path of READMES) expect(readme(path), path).toContain(`- ${line}\n`);
    expect(SIZE_LINE).toContain(`TOON ${TOON_INSTALLED} encode`);
  });

  it('measures pretty JSON and YAML for every case, and pretty JSON is never smaller than compact JSON', () => {
    expect(BENCH_FILE.status).toBe('ready');
    if (BENCH_FILE.status !== 'ready') return;
    expect(BENCH_FILE.cases).toHaveLength(11);
    expect(BENCH_FILE.yamlVersion).toBe(YAML_VERSION);
    for (const row of BENCH_FILE.cases) {
      expect(Number.isInteger(row.jsonPretty) && row.jsonPretty > 0, row.name).toBe(true);
      expect(Number.isInteger(row.yaml) && row.yaml > 0, row.name).toBe(true);
      expect(row.jsonPretty, row.name).toBeGreaterThanOrEqual(row.json);
    }
  });

  it('rejects a case row without the pretty JSON or YAML count', () => {
    const ready = { status: 'ready', tokenizer: 'o200k_base', rulesTokens: 40, yamlVersion: '2.9.1', samples: SAMPLES };
    const row = { name: 'a', json: 1, jsonPretty: 2, yaml: 1, toon: 1, csv: null, csvExact: null, terset: 1 };
    const without = (value: object, key: string): object => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
    expect(() => parseBench({ ...ready, cases: [row] })).not.toThrow();
    expect(() => parseBench({ ...ready, cases: [without(row, 'jsonPretty')] })).toThrow();
    expect(() => parseBench({ ...ready, cases: [without(row, 'yaml')] })).toThrow();
    expect(() => parseBench({ ...without(ready, 'yamlVersion'), cases: [row] })).toThrow();
  });

  it('sums every count into the totals row and sentence', () => {
    const bench: BenchReady = {
      status: 'ready',
      tokenizer: 'o200k_base',
      rulesTokens: 40,
      yamlVersion: '2.9.1',
      cases: [
        { name: 'One', json: 600, jsonPretty: 1000, yaml: 700, toon: 500, csv: 400, csvExact: true, terset: 450 },
        { name: 'Two', json: 400, jsonPretty: 1000, yaml: 300, toon: 500, csv: null, csvExact: null, terset: 450 },
      ],
      samples: SAMPLES,
    };
    expect(benchTotals(bench)).toEqual({ terset: 900, json: 1000, jsonPretty: 2000, yaml: 1000, toon: 1000 });
    expect(benchTotalsRow(bench)).toEqual(['Total', '900', '1,000', '2,000', '1,000', '1,000', 'n/a', '−10.0%', '−10.0%']);
    expect(totalsNote(bench)).toBe("Over all 2 cases, Terset totals 900 tokens: 10.0% fewer than JSON compact (1,000), 55.0% fewer than JSON pretty (2,000), 10.0% fewer than YAML (1,000), and 10.0% fewer than TOON's best (1,000).");
    expect(totalsNote({ status: 'pending', reason: 'x' })).toBe('');
  });

  it('shows the same totals in benchmark.md as the committed file sums to', () => {
    if (BENCH_FILE.status !== 'ready') return;
    const totals = benchTotals(BENCH_FILE);
    const text = benchmarkMarkdown(BENCH_FILE);
    expect(text).toContain(`| ${benchTotalsRow(BENCH_FILE).join(' | ')} |`);
    expect(text).toContain(totalsNote(BENCH_FILE));
    expect(text).toContain(`version ${BENCH_FILE.yamlVersion}`);
    expect(totals.jsonPretty).toBeGreaterThanOrEqual(totals.json);
  });

  it('keeps the README benchmark table equal to the committed numbers, in both READMEs', () => {
    if (BENCH_FILE.status !== 'ready') return;
    const expected = readmeBenchTable(BENCH_FILE);
    for (const path of READMES) {
      const text = readme(path);
      expect(text, path).toContain(expected);
      expect(flat(text), path).toContain(totalsNote(BENCH_FILE));
      expect(text, path).toContain(`\`yaml\` package, version ${BENCH_FILE.yamlVersion}`);
      expect(text, path).toContain(`- ${CASE_SOURCE_NOTE}\n`);
    }
  });

  it('says where the case inputs come from in the benchmark method', () => {
    expect(benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE)).toContain(`- ${CASE_SOURCE_NOTE}\n`);
  });

  it('keeps the README Claude table, cost tables and method equal to the committed numbers, in both READMEs', () => {
    if (COUNTERS === null || COUNTERS.claude === null) throw new Error('the committed bench and Claude files should both be ready');
    const claude = COUNTERS.claude;
    for (const path of READMES) {
      const text = readme(path);
      expect(text, path).toContain(`### ${claude.label}\n\n${readmeBenchTable(claude)}`);
      expect(flat(text), path).toContain(benchSummary(claude));
      expect(flat(text), path).toContain(totalsNote(claude));
      expect(text, path).toContain(readmeCostTable(claude));
      expect(text, path).toContain(readmeCostTable(COUNTERS.o200k));
      expect(flat(text), path).toContain(`${PRICES.claude.model} at ${priceLine(PRICES.claude)}, on the Claude counts:`);
      expect(flat(text), path).toContain(`${PRICES.o200k.model} at ${priceLine(PRICES.o200k)}, on the \`o200k_base\` counts:`);
      for (const line of [...claudeMethod(CLAUDE_FILE).filter((item) => !item.startsWith('Terset is sent')), ...costMethod(COUNTERS, PRICES.readOn)]) {
        expect(text, path).toContain(`- ${line}\n`);
      }
      expect(text, path).toContain(`- Claude: ${jsonWinsNote(claude)}\n`);
      expect(text, path).toContain(`- Claude: ${toonWinsNote(claude)}\n`);
    }
  });

  // Every line names its counter, CSV included, so a reader never takes one counter's result for the other's.
  it('keeps the README "Where Terset does not win" list equal to the site list, one line per counter', () => {
    const list = benchmarkKeepElse(BENCH_FILE, COUNTERS).map((line) => `- ${line}`).join('\n');
    for (const path of READMES) {
      expect(readme(path), path).toContain(`Where Terset does not win:\n\n${list}\n\n`);
    }
  });

  // One sample seed could be lucky, so the README says how the o200k_base results hold across the seed sweep.
  it('follows the README list with the seed sweep line, from the committed sweep', () => {
    expect(BENCH_FILE.status).toBe('ready');
    if (BENCH_FILE.status !== 'ready') return;
    const line = sweepReadmeLine(SWEEP, BENCH_FILE);
    expect(line).toBe(
      'Across 1,000 seeds of the same 11 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed.',
    );
    const list = benchmarkKeepElse(BENCH_FILE, COUNTERS).map((item) => `- ${item}`).join('\n');
    for (const path of READMES) {
      expect(readme(path), path).toContain(`${list}\n\n${line}\n\n`);
    }
  });

  it('writes a pending benchmark.md with no counts', () => {
    const text = benchmarkMarkdown({ status: 'pending', reason: 'Not measured yet.' });
    expect(text).toContain('Numbers pending');
    // Answer accuracy is a separate, measured run and keeps its tables.
    expect(text).toContain('## Answer accuracy');
    expect(text.slice(0, text.indexOf('## Answer accuracy'))).not.toMatch(/\|\s*\d/u);
    expect(benchHeadline({ status: 'pending', reason: 'x' })).toBe(PENDING_TITLE);
  });

  it('puts Terset first in the benchmark.md table, then JSON compact, JSON pretty, YAML, TOON and CSV, so readers see Terset before the others', () => {
    const bench: BenchReady = {
      status: 'ready',
      tokenizer: 'o200k_base',
      rulesTokens: 40,
      yamlVersion: '2.9.1',
      cases: [{ name: 'Flat', json: 900, jsonPretty: 1500, yaml: 1100, toon: 800, csv: 700, csvExact: true, terset: 730 }],
      samples: SAMPLES,
    };
    const text = benchmarkMarkdown(bench);
    expect(text).toContain('| Case | Terset | JSON compact | JSON pretty | YAML | TOON best | CSV | vs JSON compact | vs TOON |');
    expect(text).toContain(`| Flat | 730 | 900 | 1,500 | 1,100 | 800 | 700 | ${pct(730, 900)} | ${pct(730, 800)} |`);
    expect(text).toContain(`| Total | 730 | 900 | 1,500 | 1,100 | 800 | n/a | ${pct(730, 900)} | ${pct(730, 800)} |`);
  });

  it('rejects a file with stray or missing fields', () => {
    expect(() => parseBench({ status: 'pending' })).toThrow();
    expect(() => parseBench({ status: 'pending', reason: 'x', cases: [] })).toThrow();
  });

  it('prints a signed change with a true minus sign', () => {
    expect(pct(80, 100)).toBe('−20.0%');
    expect(pct(120, 100)).toBe('+20.0%');
    expect(pct(100, 100)).toBe('0.0%');
  });

  it('compares tokens in one plain convention, with no sign', () => {
    expect(compareTokens(325, 356, 'JSON')).toBe('8.7% fewer tokens than JSON');
    expect(compareTokens(120, 100, 'TOON')).toBe('20.0% more tokens than TOON');
    expect(compareTokens(100, 100, 'JSON')).toBe('As many tokens as JSON');
  });
});
