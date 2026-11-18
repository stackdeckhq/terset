// Pairing the Claude counts with the bench file, and the cost at list price.
// A pending Claude file degrades to the o200k_base view. A ready file that does
// not match the bench file case for case stops the build with a clear error.
import { describe, expect, it } from 'vitest';
import { benchmarkMarkdown, benchmarkSampleTotals, benchmarkSummary, sampleTotalsLine } from './benchmark-doc.ts';
import type { BenchReady } from './bench-schema.ts';
import type { ClaudeReady } from './claude-counts-schema.ts';
import { STRESS, stressKeepElse } from './stress.ts';
import {
  BENCH_FILE,
  CLAUDE_FILE,
  COUNTERS,
  PRICES,
  buildCounters,
  claudeMethod,
  centsDelta,
  centsPerThousand,
  costTableRows,
  costTotalsRow,
  counterSummary,
  counterTotals,
  countersHeadline,
  countersNote,
  countersPageNote,
  formatCents,
  QUALITY_NOTE,
  totalsNote,
  underJson,
} from './numbers.ts';
import { PricesSchema } from './prices-schema.ts';

function bench(): BenchReady {
  if (BENCH_FILE.status !== 'ready') throw new Error('the committed bench file should be ready');
  return BENCH_FILE;
}

function claude(): ClaudeReady {
  if (CLAUDE_FILE.status !== 'ready') throw new Error('the committed Claude file should be ready');
  return CLAUDE_FILE;
}

/** The committed Claude file with its rows changed. */
function withRows(change: (rows: ClaudeReady['rows']) => ClaudeReady['rows']): ClaudeReady {
  const file = claude();
  return { ...file, rows: change(file.rows) };
}

const benchRows = (rows: ClaudeReady['rows']): ClaudeReady['rows'] => rows.filter((row) => row.source === 'benchmark');

describe('Claude counts paired with the bench file', () => {
  it('describes the rules actually used by the saved measurement', () => {
    expect(claudeMethod(claude()).join('\n')).toContain('rulesFor(text)');
    expect(claudeMethod({ ...claude(), rulesMode: 'full' }).join('\n')).toContain('full RULES line');
  });
  it('pairs the committed files: 11 Claude cases in bench order, and all three samples', () => {
    expect(COUNTERS).not.toBeNull();
    const claudeCounter = COUNTERS?.claude;
    if (claudeCounter === null || claudeCounter === undefined) throw new Error('the committed Claude file should pair');
    expect(claudeCounter.cases.map((row) => row.name)).toEqual(bench().cases.map((row) => row.name));
    expect(claudeCounter.cases).toHaveLength(11);
    expect(claude().model).toBe(PRICES.claude.counter);
    const orders = claude().rows.find((row) => row.id === 'sample:orders');
    expect(claudeCounter.samples.orders).toEqual({ json: orders?.json, toon: orders?.toon, terset: orders?.terset });
  });

  it('degrades to o200k_base only when the Claude file is pending', () => {
    const counters = buildCounters(bench(), { status: 'pending' }, PRICES);
    expect(counters?.claude).toBeNull();
    expect(counters?.o200k.cases).toBe(bench().cases);
    const full = benchmarkMarkdown(bench(), { status: 'pending' });
    // Answer accuracy is a separate run that names its models, Claude included.
    const start = full.indexOf('## Answer accuracy');
    const end = full.indexOf('## Method');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // So is the stress test, whose lowest score is on Claude Haiku 5.5 and is listed under "When to keep something else".
    const stressLine = stressKeepElse(STRESS);
    expect(full).toContain(stressLine);
    const text = (full.slice(0, start) + full.slice(end)).replace(stressLine, '');
    expect(text).not.toContain('Claude');
    expect(text.match(/^\| Case \| Terset \| Compact JSON \| Pretty JSON/gmu)).toHaveLength(1);
    expect(countersHeadline(bench(), counters)).toBe(`Fewer tokens than TOON in 9 of 11 cases.`);
  });

  it('fails clearly on a missing case row', () => {
    const missing = withRows((rows) => rows.filter((row) => row.name !== 'Mixed-type array'));
    expect(() => buildCounters(bench(), missing, PRICES)).toThrow('Claude counts have no row for the bench case "Mixed-type array"');
  });

  it('fails clearly on a renamed case', () => {
    const renamed = withRows((rows) => rows.map((row) => (row.name === '200 users' ? { ...row, name: '200 people' } : row)));
    expect(() => buildCounters(bench(), renamed, PRICES)).toThrow('Claude counts have cases the bench file does not: 200 people');
  });

  it('fails clearly on a duplicate case row', () => {
    const doubled = withRows((rows) => {
      const first = benchRows(rows)[0];
      return first === undefined ? rows : [...rows, { ...first, id: 'benchmark:copy' }];
    });
    expect(() => buildCounters(bench(), doubled, PRICES)).toThrow('Claude counts have 2 rows for the bench case "UI text, uneven rows"');
  });

  it('fails clearly when the Claude case was made from other input', () => {
    const other = withRows((rows) => rows.map((row) => (row.name === 'Translation batch' ? { ...row, o200kJson: (row.o200kJson ?? 0) + 1 } : row)));
    expect(() => buildCounters(bench(), other, PRICES)).toThrow('Claude counts were made from other input data for the bench case "Translation batch"');
  });

  it('fails clearly on a missing sample', () => {
    const noSample = withRows((rows) => rows.filter((row) => row.id !== 'sample:servers'));
    expect(() => buildCounters(bench(), noSample, PRICES)).toThrow('Claude counts have no row for the sample "servers"');
  });

  it('fails clearly when the price belongs to another model', () => {
    const prices = { ...PRICES, claude: { ...PRICES.claude, counter: 'another-model' } };
    expect(() => buildCounters(bench(), claude(), prices)).toThrow('The Claude price is for another-model, but the counts are from claude-opus-5-5');
  });

  it('claims in the headline only what holds on both counters', () => {
    const counters = buildCounters(bench(), claude(), PRICES);
    if (counters === null || counters.claude === null) throw new Error('should pair');
    expect(underJson(counters.o200k)).toBe(10);
    expect(underJson(counters.claude)).toBe(10);
    expect(countersHeadline(bench(), counters)).toBe('Fewer tokens than compact JSON in 10 of 11 cases, on both counters.');
    const lost = withRows((rows) => rows.map((row) => (row.name === 'UI text, uneven rows' ? { ...row, terset: row.json + 1 } : row)));
    const split = buildCounters(bench(), lost, PRICES);
    expect(countersHeadline(bench(), split)).toBe('Fewer tokens than compact JSON in 10 of 11 cases on o200k_base and 9 on Claude.');
  });

  it('says beside every headline count that Terset carries the rules line fitted to each text', () => {
    const counters = buildCounters(bench(), claude(), PRICES);
    if (counters === null || counters.claude === null) throw new Error('should pair');
    const fitted = 'Each Terset count includes rulesFor(text), the rules line fitted to that text.';
    expect(countersNote(bench(), counters)).toContain(fitted);
    expect(countersNote(bench(), null)).toContain(fitted);
    expect(countersPageNote(bench(), counters)).toContain(fitted);
    // The benchmark page names Compact JSON in every head, so its lead drops the gloss the home page keeps.
    expect(countersNote(bench(), counters)).toContain('JSON means compact JSON');
    expect(countersPageNote(bench(), counters)).not.toContain('JSON means');
    expect(counterSummary(counters.o200k)).toContain('Terset, fitted rules line included,');
    expect(counterSummary(counters.claude)).toContain('Terset, fitted rules line included,');
  });

  it('writes both token tables and both cost tables in benchmark.md', () => {
    const text = benchmarkMarkdown(bench(), claude());
    expect(text).toContain('## Tokens, o200k_base');
    expect(text).toContain('## Tokens, Claude');
    expect(text).toContain('## Input cost at list price');
    expect(text.match(/^\| Case \| Terset \| Compact JSON \| Terset vs compact JSON \|$/gmu)).toHaveLength(2);
    expect(text).toContain(PRICES.claude.source);
    expect(text).toContain(PRICES.o200k.source);
    expect(text).toContain('assumes that tokenizer');
  });
});

describe('/benchmark lines under the sample cases card', () => {
  it('puts the full totals per counter in the fold, and leaves the summary and the quality note out', () => {
    const counters = buildCounters(bench(), claude(), PRICES);
    if (counters === null || counters.claude === null) throw new Error('should pair');
    const lines = benchmarkSampleTotals(bench(), counters);
    expect(lines).toEqual([counterTotals(counters.o200k), counterTotals(counters.claude)]);
    expect(lines.join(' ')).not.toContain("is under TOON's best");
    expect(lines).not.toContain(QUALITY_NOTE);
    expect(benchmarkSummary(bench(), counters)).toContain(counterSummary(counters.o200k));
  });

  it('drops the plain summary with one counter, and shows nothing extra while pending', () => {
    const single = buildCounters(bench(), { status: 'pending' }, PRICES);
    expect(benchmarkSampleTotals(bench(), single)).toEqual([totalsNote(bench())]);
    expect(benchmarkSampleTotals({ status: 'pending', reason: 'Not run yet.' }, null)).toEqual([]);
  });

  it('states the total saving against compact JSON and TOON in one open sentence, read from the totals', () => {
    const counters = buildCounters(bench(), claude(), PRICES);
    if (counters === null || counters.claude === null) throw new Error('should pair');
    const line = sampleTotalsLine(bench(), counters);
    expect(line).toBe("Over all 11 cases, Terset totals 26.8% fewer tokens than compact JSON and 6.6% fewer than TOON's best on o200k_base, and 32.0% and 4.5% fewer on Claude.");
    // The same rounding as the full totals in the fold.
    expect(counterTotals(counters.o200k)).toContain('26.8% fewer than compact JSON');
    expect(counterTotals(counters.o200k)).toContain("6.6% fewer than TOON's best");
    expect(counterTotals(counters.claude)).toContain('32.0% fewer than compact JSON');
    expect(counterTotals(counters.claude)).toContain("4.5% fewer than TOON's best");
    expect(sampleTotalsLine({ status: 'pending', reason: 'Not run yet.' }, null)).toBe('');
  });

  it('refuses the sample line once Terset totals more than TOON', () => {
    const counters = buildCounters(bench(), claude(), PRICES);
    if (counters === null) throw new Error('should pair');
    const heavy = { ...counters, o200k: { ...counters.o200k, cases: counters.o200k.cases.map((row) => ({ ...row, toon: Math.floor(row.terset / 2) })) } };
    expect(() => sampleTotalsLine(bench(), heavy)).toThrow(/fewer tokens than TOON's best/u);
  });
});

describe('input cost at list price', () => {
  it('rejects a price file with a stray field, a bad date or a plain http source', () => {
    const raw = { readOn: PRICES.readOn, o200k: PRICES.o200k, claude: PRICES.claude };
    expect(() => PricesSchema.parse(raw)).not.toThrow();
    expect(() => PricesSchema.parse({ ...raw, extra: 1 })).toThrow();
    expect(() => PricesSchema.parse({ ...raw, readOn: '12 Nov 2026' })).toThrow();
    expect(() => PricesSchema.parse({ ...raw, claude: { ...PRICES.claude, source: 'http://example.com' } })).toThrow();
    expect(() => PricesSchema.parse({ ...raw, claude: { ...PRICES.claude, usdPerMillionInput: 0 } })).toThrow();
  });

  it('prices 1,000 requests in whole cents', () => {
    // 1,062 tokens at $4 per million, 1,000 times: $4.248, shown as $4.25.
    expect(centsPerThousand(1062, PRICES.claude)).toBe(425);
    expect(centsPerThousand(504, PRICES.o200k)).toBe(101);
    expect(formatCents(34287)).toBe('$342.87');
  });

  it('prints a dollar change in words, never as a signed price', () => {
    expect(centsDelta(425, 585)).toBe('$1.60 less');
    expect(centsDelta(273, 244)).toBe('$0.29 more');
    expect(centsDelta(5, 5)).toBe('the same');
  });

  it('computes every shown change from the shown values, and the total from summed tokens', () => {
    const counters = buildCounters(bench(), claude(), PRICES);
    if (counters === null || counters.claude === null) throw new Error('should pair');
    for (const counter of [counters.o200k, counters.claude]) {
      const cents = (value: string): number => Math.round(Number(value.replace(/[^\d.]/gu, '')) * 100);
      for (const [, terset, json, delta] of [...costTableRows(counter), costTotalsRow(counter)]) {
        expect(centsDelta(cents(terset), cents(json))).toBe(delta);
      }
    }
    expect(costTotalsRow(counters.claude)).toEqual(['Total', '$234.33', '$344.41', '$110.08 less']);
    expect(costTotalsRow(counters.o200k)).toEqual(['Total', '$86.09', '$117.62', '$31.53 less']);
  });
});
