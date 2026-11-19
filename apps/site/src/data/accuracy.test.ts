// The accuracy copy states only what the data supports, checked on a small fixture file.
// The README blocks and /benchmark.md must match the committed file.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCURACY_FIXTURE } from './accuracy-fixtures.ts';
import {
  ACCURACY,
  ACCURACY_FORMAT_NOTE,
  ACCURACY_KIND_NOTE,
  ACCURACY_RUNS_HEAD,
  ACCURACY_TABLE_HEAD,
  accuracyHomeLine,
  accuracyKindLine,
  accuracyLines,
  accuracyMarkdownTable,
  accuracyMethod,
  accuracyReadmeBlock,
  accuracyRunsNote,
  accuracySummary,
  accuracyTableMarks,
  accuracyTableRows,
  costLessCell,
  failedCallsLine,
  intervalsOverlap,
  kindMarkdownHead,
  kindMarkdownTable,
  kindTableRows,
  overTersetMark,
  publishedRunsMarkdownTable,
  publishedRunsRows,
  signMark,
  wholePct,
} from './accuracy.ts';
import type { AccuracyFile, AccuracyModel } from './accuracy.ts';
import type { AccuracyFormat } from './accuracy-schema.ts';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';

const READMES = ['../../../../README.md', '../../../../packages/terset/README.md'] as const;

type MutableRow = AccuracyModel['rows'][number];
type MutableFile = AccuracyFile & { models: (AccuracyModel & { rows: MutableRow[] })[] };

const FIXTURE = ACCURACY_FIXTURE;

function model(file: AccuracyFile, id: string): AccuracyModel {
  const found = file.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no model ${id}`);
  return found;
}

const OPUS = model(FIXTURE, 'claude-opus-5-5');

/** A copy of the fixture with the first model's rows changed. */
function withRows(change: (rows: MutableRow[]) => void): MutableFile {
  const copy = structuredClone(FIXTURE) as MutableFile;
  const first = copy.models[0];
  if (first === undefined) throw new Error('no models');
  change(first.rows);
  return copy;
}

function rowOf(rows: readonly MutableRow[], format: AccuracyFormat): MutableRow {
  const row = rows.find((item) => item.format === format);
  if (row === undefined) throw new Error(`missing ${format} row`);
  return row;
}

describe('accuracy', () => {
  it('shows every format with its score, interval, tokens and cost, Terset first', () => {
    expect(ACCURACY_TABLE_HEAD).toEqual(['Format', 'Correct', 'Accuracy', '95% interval', 'Input tokens', 'Cost', 'Terset costs less by']);
    expect(accuracyTableRows(OPUS)).toEqual([
      ['Terset', '243 of 244', '99.6%', '97.7% to 99.9%', '1,000,000', '$4.80', '-'],
      ['Compact JSON', '241 of 244', '98.8%', '96.4% to 99.6%', '1,500,000', '$6.80', '29.4%'],
      ['Pretty JSON', '241 of 244', '98.8%', '96.4% to 99.6%', '2,000,000', '$8.80', '45.5%'],
      ['TOON', '242 of 244', '99.2%', '97.1% to 99.8%', '1,200,000', '$5.60', '14.3%'],
    ]);
  });

  it('gives the table the same cost saving as the summary line, on the same base', () => {
    const summary = accuracySummary(FIXTURE).join(' ');
    for (const item of FIXTURE.models) {
      const compact = accuracyTableRows(item).find((row) => row[0] === 'Compact JSON')?.[6];
      expect(summary).toContain(`${compact ?? 'missing'} less on ${item.name}`);
    }
  });

  it('says each model ran once, and throws once a model has more runs or none', () => {
    expect(accuracyRunsNote(FIXTURE)).toBe('Each model ran once, with every format, on 2099-01-01. Each table shows that one run.');
    const [first, second] = FIXTURE.publishedRuns;
    if (first === undefined || second === undefined) throw new Error('no runs');
    expect(() => accuracyRunsNote({ ...FIXTURE, publishedRuns: [first, { ...first, runId: 'again' }, second] })).toThrow(/ran once/u);
    expect(() => accuracyRunsNote({ ...FIXTURE, publishedRuns: [first] })).toThrow(/ran once/u);
  });

  it('lists the one published run of each model', () => {
    expect(ACCURACY_RUNS_HEAD).toEqual(['Run', 'Date', 'Model', 'Failed attempts']);
    expect(publishedRunsRows(FIXTURE)).toEqual([
      ['fixture-opus', '2099-01-01', 'Claude Opus 5.5', '0'],
      ['fixture-sol', '2099-01-01', 'GPT 6.1 Sol', '2, retried'],
    ]);
  });

  it('says how many attempts failed and that they stay in the run files', () => {
    expect(failedCallsLine(FIXTURE)).toBe('Two attempts failed and were retried in the same run. Each stays in its run file.');
    expect(failedCallsLine({ ...FIXTURE, failedCalls: 0 })).toBe('None failed.');
    expect(failedCallsLine({ ...FIXTURE, failedCalls: 1 })).toBe('One attempt failed and was retried in the same run. It stays in the run file.');
  });

  it('works out what Terset saves from the unrounded costs, and says so in words when a format is cheaper', () => {
    expect(costLessCell(8, 6)).toBe('25.0%');
    expect(costLessCell(4, 5)).toBe('Costs 25.0% more');
    expect(costLessCell(5, 5)).toBe('0.0%');
    // $6.12 and $6.13 round apart on the page; the cell still comes from the full costs.
    expect(costLessCell(6.1249, 6.1251)).toBe('0.0%');
  });

  it('marks the lowest input tokens and cost, and every format Terset cost less than, never the scores', () => {
    expect(accuracyTableMarks(OPUS)).toEqual([
      [null, null, null, 'is-less', 'is-less', null],
      [null, null, null, null, null, 'terset-cheaper'],
      [null, null, null, null, null, 'terset-cheaper'],
      [null, null, null, null, null, 'terset-cheaper'],
    ]);
  });

  it('shows a format cheaper than Terset in words, plain and muted', () => {
    const toonCheaper = withRows((rows) => {
      rowOf(rows, 'toon').totalCost = rowOf(rows, 'terset').totalCost * 0.9;
    });
    const first = toonCheaper.models[0];
    if (first === undefined) throw new Error('no models');
    expect(accuracyTableRows(first).map((row) => row[6])).toEqual(['-', '29.4%', '45.5%', 'Costs 11.1% more']);
    expect(accuracyTableMarks(first).map((row) => row[5])).toEqual([null, 'terset-cheaper', 'terset-cheaper', 'terset-pricier']);
    expect([overTersetMark(10.01, 10), overTersetMark(10, 10.01), overTersetMark(10, 10)]).toEqual(['terset-cheaper', 'terset-pricier', null]);
  });

  it('finds the lowest values from the data, not from a fixed row', () => {
    const toonCheapest = withRows((rows) => {
      const toon = rowOf(rows, 'toon');
      toon.inputTokens = 1;
      toon.totalCost = 0.01;
    });
    const first = toonCheapest.models[0];
    if (first === undefined) throw new Error('no models');
    const marks = accuracyTableMarks(first);
    expect(marks.map((row) => row[3])).toEqual([null, null, null, 'is-less']);
    expect(marks.map((row) => row[4])).toEqual([null, null, null, 'is-less']);
  });

  it('marks every row that ties for the lowest value', () => {
    const tied = withRows((rows) => {
      rowOf(rows, 'toon').inputTokens = rowOf(rows, 'terset').inputTokens;
    });
    const first = tied.models[0];
    if (first === undefined) throw new Error('no models');
    expect(accuracyTableMarks(first).map((row) => row[3])).toEqual(['is-less', null, null, 'is-less']);
  });

  it('marks a signed change by its sign only', () => {
    expect([signMark('−25.0%'), signMark('+26.4%'), signMark('Baseline'), signMark('0.0%')]).toEqual(['is-less', 'is-more', null, null]);
  });

  it('says the accuracy ranges overlap only while every interval overlaps', () => {
    expect(FIXTURE.models.every(intervalsOverlap)).toBe(true);
    const apart = withRows((rows) => {
      rowOf(rows, 'toon').low = rowOf(rows, 'terset').high + 0.001;
    });
    expect(() => accuracySummary(apart)).toThrow(/every interval overlaps/u);
    expect(() => accuracyHomeLine(apart)).toThrow(/every interval overlaps/u);
  });

  it('claims fewer tokens and a lower cost only while the data says so', () => {
    const pricier = withRows((rows) => {
      rowOf(rows, 'terset').totalCost = 100;
    });
    expect(() => accuracySummary(pricier)).toThrow(/cost less than compact JSON/u);
    const longer = withRows((rows) => {
      rowOf(rows, 'terset').inputTokens = 10_000_000;
    });
    expect(() => accuracyHomeLine(longer)).toThrow(/fewer input tokens/u);
  });

  it('puts the token result first on the home line, then the overlap sentence', () => {
    expect(accuracyHomeLine(FIXTURE)).toBe('On 244 questions and two models, Terset used fewer input tokens than compact JSON. The 95% accuracy ranges of all four formats overlap on both models.');
  });

  it('keeps the result to two lines under the tables', () => {
    expect(accuracySummary(FIXTURE)).toEqual([
      'The 95% accuracy ranges of all four formats overlap on both models. That does not prove the formats are equally accurate.',
      'Against compact JSON, Terset cost 29.4% less on Claude Opus 5.5 and 25.0% less on GPT 6.1 Sol.',
    ]);
  });

  it('shows Terset input tokens against compact JSON and TOON per kind of data, losses included', () => {
    expect(kindMarkdownHead(FIXTURE)).toEqual(['Data', 'Questions', 'vs compact JSON, Opus', 'vs compact JSON, Sol', 'vs TOON, Opus', 'vs TOON, Sol']);
    expect(kindTableRows(FIXTURE)).toEqual([
      ['Flat tables', '41', '−40%', '−40%', '−8%', '−8%'],
      ['Nested groups', '18', '−40%', '−40%', '−6%', '−6%'],
      ['Keyed objects', '17', '−44%', '−44%', '−9%', '−9%'],
    ]);
    expect(wholePct(100, 100)).toBe('0%');
    expect(wholePct(99.6, 100)).toBe('0%');
  });

  it('adds a third line only for kinds where TOON used fewer tokens on both models', () => {
    // Terset is under TOON on every kind for both models, so no kind qualifies.
    expect(accuracyKindLine(FIXTURE)).toBeNull();
    expect(accuracyLines(FIXTURE)).toEqual(accuracySummary(FIXTURE));
    const copy = structuredClone(FIXTURE);
    const set = (kind: string, modelIndex: number, toon: number): void => {
      const entry = copy.kinds.find((item) => item.kind === kind)?.models[modelIndex];
      if (entry === undefined) throw new Error(`no ${kind}`);
      entry.inputTokens = { ...entry.inputTokens, toon };
    };
    set('keyed', 0, 1);
    expect(accuracyKindLine(copy)).toBeNull();
    set('keyed', 1, 1);
    expect(accuracyKindLine(copy)).toBe('TOON used fewer tokens than Terset on keyed objects.');
    set('nested-group', 0, 1);
    set('nested-group', 1, 1);
    // Largest gap first: nested groups have more Terset tokens over the same TOON count.
    expect(accuracyLines(copy)).toEqual([...accuracySummary(FIXTURE), 'TOON used fewer tokens than Terset on nested groups and keyed objects.']);
  });

  it('never says the layout gives better answers', () => {
    const text = [...accuracyLines(FIXTURE), ACCURACY_KIND_NOTE, accuracyHomeLine(FIXTURE), ...accuracyMethod(FIXTURE)].join(' ');
    expect(text).not.toMatch(/\b(better|improves?|more accurate|higher accuracy)\b/iu);
    expect(text).not.toMatch(/[–—]/u);
  });

  it('names the runs, the upstream commit, how tokens were counted and the published results in at most five lines', () => {
    const lines = accuracyMethod(FIXTURE);
    expect(lines.length).toBeLessThanOrEqual(5);
    const method = lines.join('\n');
    expect(method).toContain('[2099-01-01](https://github.com/stackdeckhq/terset/tree/main/bench/published/2099-01-01)');
    // A 40-character hash cannot fit a 390 px column, so the text shows the short hash
    // and the link carries the full one.
    expect(method).toContain(`commit [0123456](https://github.com/toon-format/toon/commit/${FIXTURE.upstreamSha})`);
    expect(method).toContain('Cost is at API list price: input and output tokens times list prices read on 2026-11-17. Input tokens are as each model reported them.');
    expect(method).toContain('Tables use 1,952 answered calls from runs on 2099-01-01. Two attempts failed and were retried in the same run.');
    expect(method).toContain('no model judge');
    // A reader can rerun it: the harness folder holds the frozen questions and the commands.
    expect(method).toContain('The questions and the steps to run it yourself: [bench](https://github.com/stackdeckhq/terset/tree/main/bench).');
  });

  it('says nothing about how the answers were paid for, and subtracts nothing', () => {
    const text = [...accuracyMethod(FIXTURE), accuracyReadmeBlock(FIXTURE), ACCURACY_KIND_NOTE].join('\n');
    expect(text).not.toMatch(/subscription|\broute\b|API-equivalent|what was paid|\b127\b/iu);
    expect(text).not.toMatch(/[–—]/u);
  });

  it('keeps the kind table and its line out of the READMEs', () => {
    const block = accuracyReadmeBlock(FIXTURE);
    expect(block).not.toContain('By data set');
    expect(block).not.toContain('TOON used fewer tokens than Terset');
  });

  it('names the two JSON rows Compact JSON and Pretty JSON and says what each one means', () => {
    const labels = FIXTURE.models.flatMap((item) => accuracyTableRows(item).map(([label]) => label));
    expect(new Set(labels)).toEqual(new Set(['Terset', 'Compact JSON', 'Pretty JSON', 'TOON']));
    expect(labels).not.toContain('JSON');
    expect(ACCURACY_FORMAT_NOTE).toBe('Pretty JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.');
    expect(accuracyReadmeBlock(FIXTURE)).toContain(ACCURACY_FORMAT_NOTE);
  });

  it('puts the committed accuracy tables in benchmark.md', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    expect(text).toContain('## Answer accuracy');
    for (const item of ACCURACY.models) expect(text).toContain(accuracyMarkdownTable(item));
    expect(text).toContain(publishedRunsMarkdownTable(ACCURACY));
    expect(text).toContain(accuracyRunsNote(ACCURACY));
    expect(text).toContain(ACCURACY_FORMAT_NOTE);
    expect(text).toContain('### By data set');
    expect(text).toContain(kindMarkdownTable(ACCURACY));
    expect(text).toContain(ACCURACY_KIND_NOTE);
    expect(text).not.toContain('Cost vs compact JSON');
  });

  it('keeps the README accuracy block equal to the committed data, in both READMEs', () => {
    const block = accuracyReadmeBlock(ACCURACY);
    for (const path of [...READMES, '../../../../packages/terset-py/README.md']) {
      const text = readFileSync(new URL(path, import.meta.url), 'utf8');
      if (path.includes('terset-py') && !text.includes('### Answer accuracy')) continue;
      const actual = text.match(/### Answer accuracy\n[\s\S]*?(?=\n## |\n### |$)/u)?.[0].trim();
      expect(actual, path).toBe(block);
    }
  });
});
