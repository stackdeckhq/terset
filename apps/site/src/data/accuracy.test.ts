// The accuracy copy states only what the data supports, the tables come from the
// committed file, and both READMEs carry the same block word for word.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACCURACY,
  ACCURACY_FORMAT_NOTE,
  ACCURACY_KIND_NOTE,
  ACCURACY_TABLE_HEAD,
  accuracyHomeLine,
  accuracyKindLine,
  accuracyLines,
  accuracyMethod,
  accuracyReadmeBlock,
  accuracySummary,
  accuracyTableMarks,
  accuracyTableRows,
  costOverTerset,
  intervalsOverlap,
  kindMarkdownHead,
  kindTableRows,
  overTersetMark,
  signMark,
  wholePct,
} from './accuracy.ts';
import type { AccuracyFile, AccuracyModel } from './accuracy.ts';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';

const READMES = ['../../../../README.md', '../../../../packages/terset/README.md'] as const;

function model(id: string): AccuracyModel {
  const found = ACCURACY.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no model ${id}`);
  return found;
}

/** A copy of the committed file with one model's rows changed. */
function withRows(change: (rows: AccuracyModel['rows'][number][]) => void): AccuracyFile {
  const copy = structuredClone(ACCURACY) as AccuracyFile & { models: (AccuracyModel & { rows: AccuracyModel['rows'][number][] })[] };
  const first = copy.models[0];
  if (first === undefined) throw new Error('no models');
  change(first.rows);
  return copy;
}

describe('accuracy', () => {
  it('shows every format with its score, interval, tokens and cost, Terset first', () => {
    expect(ACCURACY_TABLE_HEAD.slice(-2)).toEqual(['Costs more than Terset', 'Run date']);
    expect(accuracyTableRows(model('claude-opus-5-5'))).toEqual([
      ['Terset', '243 of 244', '99.6%', '97.7% to 99.9%', '1,200,640', '$5.69', 'Reference', '2026-11-13'],
      ['Compact JSON', '241 of 244', '98.8%', '96.4% to 99.6%', '1,766,161', '$8.04', '+41.3%', '2026-11-12'],
      ['JSON', '239 of 244', '98.0%', '95.3% to 99.1%', '2,303,845', '$10.20', '+79.2%', '2026-11-12'],
      ['TOON', '242 of 244', '99.2%', '97.1% to 99.8%', '1,369,764', '$6.35', '+11.6%', '2026-11-12'],
    ]);
    expect(accuracyTableRows(model('gpt-6.1-sol')).map((row) => row[6])).toEqual(['Reference', '+34.8%', '+92.2%', '+18.3%']);
  });

  it('works out the cost over Terset from the unrounded costs, with a minus when a format is cheaper', () => {
    expect(costOverTerset(8.161284, 6.12266)).toBe('+33.3%');
    expect(costOverTerset(4, 5)).toBe('−20.0%');
    expect(costOverTerset(5, 5)).toBe('0.0%');
    // $6.12 and $6.13 round apart on the page; the cell still comes from the full costs.
    expect(costOverTerset(6.1249, 6.1251)).toBe('0.0%');
  });

  it('marks the lowest input tokens and cost, and every format Terset cost less than, never the scores', () => {
    expect(accuracyTableMarks(model('claude-opus-5-5'))).toEqual([
      [null, null, null, 'is-less', 'is-less', null, null],
      [null, null, null, null, null, 'terset-cheaper', null],
      [null, null, null, null, null, 'terset-cheaper', null],
      [null, null, null, null, null, 'terset-cheaper', null],
    ]);
  });

  it('shows a format cheaper than Terset with a minus, plain and muted', () => {
    const toonCheaper = withRows((rows) => {
      const terset = rows.find((row) => row.format === 'terset');
      const toon = rows.find((row) => row.format === 'toon');
      if (terset === undefined || toon === undefined) throw new Error('missing rows');
      toon.totalCost = terset.totalCost * 0.9;
    });
    const first = toonCheaper.models[0];
    if (first === undefined) throw new Error('no models');
    expect(accuracyTableRows(first).map((row) => row[6])).toEqual(['Reference', '+41.3%', '+79.2%', '−10.0%']);
    expect(accuracyTableMarks(first).map((row) => row[5])).toEqual([null, 'terset-cheaper', 'terset-cheaper', 'terset-pricier']);
    expect([overTersetMark('+0.1%'), overTersetMark('−0.1%'), overTersetMark('0.0%'), overTersetMark('Reference')]).toEqual(['terset-cheaper', 'terset-pricier', null, null]);
  });

  it('finds the lowest values from the data, not from a fixed row', () => {
    const toonCheapest = withRows((rows) => {
      const toon = rows.find((row) => row.format === 'toon');
      if (toon === undefined) throw new Error('missing row');
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
      const terset = rows.find((row) => row.format === 'terset');
      const toon = rows.find((row) => row.format === 'toon');
      if (terset === undefined || toon === undefined) throw new Error('missing rows');
      toon.inputTokens = terset.inputTokens;
    });
    const first = tied.models[0];
    if (first === undefined) throw new Error('no models');
    expect(accuracyTableMarks(first).map((row) => row[3])).toEqual(['is-less', null, null, 'is-less']);
  });

  it('marks a signed change by its sign only', () => {
    expect([signMark('−25.0%'), signMark('+26.4%'), signMark('Baseline'), signMark('0.0%')]).toEqual(['is-less', 'is-more', null, null]);
  });

  it('calls accuracy a tie only because every interval overlaps', () => {
    expect(ACCURACY.models.every(intervalsOverlap)).toBe(true);
    const apart = withRows((rows) => {
      const toon = rows.find((row) => row.format === 'toon');
      const terset = rows.find((row) => row.format === 'terset');
      if (toon === undefined || terset === undefined) throw new Error('missing rows');
      toon.low = terset.high + 0.001;
    });
    expect(() => accuracySummary(apart)).toThrow(/every interval overlaps/u);
    expect(() => accuracyHomeLine(apart)).toThrow(/every interval overlaps/u);
  });

  it('claims fewer tokens and a lower cost only while the data says so', () => {
    const pricier = withRows((rows) => {
      const terset = rows.find((row) => row.format === 'terset');
      if (terset === undefined) throw new Error('missing row');
      terset.totalCost = 100;
    });
    expect(() => accuracySummary(pricier)).toThrow(/cost less than compact JSON/u);
    const longer = withRows((rows) => {
      const terset = rows.find((row) => row.format === 'terset');
      if (terset === undefined) throw new Error('missing row');
      terset.inputTokens = 10_000_000;
    });
    expect(() => accuracyHomeLine(longer)).toThrow(/fewer input tokens/u);
  });

  it('keeps the result to two sentences under the tables', () => {
    expect(accuracySummary(ACCURACY)).toEqual([
      "Accuracy is a tie. On 244 questions, every format's 95% interval overlaps every other format's, on both models.",
      'Against compact JSON, Terset cost 29.2% less on Claude Opus 5.5 and 25.8% less on GPT 6.1 Sol.',
    ]);
  });

  it('shows Terset input tokens against compact JSON and TOON per kind of data, losses included', () => {
    expect(kindMarkdownHead(ACCURACY)).toEqual(['Data', 'Questions', 'vs compact JSON, Opus', 'vs compact JSON, Sol', 'vs TOON, Opus', 'vs TOON, Sol']);
    expect(kindTableRows(ACCURACY)).toEqual([
      ['Flat tables', '41', '−41%', '−40%', '−4%', '−10%'],
      ['Analytics', '30', '−51%', '−37%', '−6%', '−10%'],
      ['GitHub repos', '33', '−33%', '−25%', '−2%', '−4%'],
      ['Event logs', '30', '−33%', '−26%', '−37%', '−39%'],
      ['Nested orders', '41', '−22%', '−18%', '−15%', '−23%'],
      ['Nested groups', '18', '−39%', '−41%', '−3%', '−6%'],
      ['Keyed objects', '17', '−42%', '−31%', '−5%', '−9%'],
      ['Nested config', '29', '+5%', '+9%', '0%', '−6%'],
      ['Structure: control', '1', '−33%', '−33%', '−6%', '−12%'],
      ['Structure: truncated', '1', '−32%', '−31%', '−7%', '−13%'],
      ['Structure: extra rows', '1', '−34%', '−34%', '−6%', '−12%'],
      ['Structure: width mismatch', '1', '−33%', '−33%', '−6%', '−12%'],
      ['Structure: missing fields', '1', '−34%', '−34%', '−7%', '−13%'],
    ]);
    expect(wholePct(100, 100)).toBe('0%');
    expect(wholePct(99.6, 100)).toBe('0%');
  });

  it('adds a third line only for kinds where TOON used fewer tokens on both models', () => {
    // Opus is 29 tokens over TOON on nested config, but Sol is under, so no kind qualifies.
    expect(accuracyKindLine(ACCURACY)).toBeNull();
    expect(accuracyLines(ACCURACY)).toEqual(accuracySummary(ACCURACY));
    const copy = structuredClone(ACCURACY);
    const set = (kind: string, modelIndex: number, toon: number): void => {
      const entry = copy.kinds.find((item) => item.kind === kind)?.models[modelIndex];
      if (entry === undefined) throw new Error(`no ${kind}`);
      entry.inputTokens.toon = toon;
    };
    set('keyed', 0, 1);
    expect(accuracyKindLine(copy)).toBeNull();
    set('keyed', 1, 1);
    expect(accuracyKindLine(copy)).toBe('TOON used fewer tokens than Terset on keyed objects.');
    set('nested-group', 0, 1);
    set('nested-group', 1, 1);
    // Largest gap first: nested groups have more Terset tokens over the same TOON count.
    expect(accuracyLines(copy)).toEqual([...accuracySummary(ACCURACY), 'TOON used fewer tokens than Terset on nested groups and keyed objects.']);
  });

  it('never says the layout gives better answers', () => {
    const text = [...accuracyLines(ACCURACY), ACCURACY_KIND_NOTE, accuracyHomeLine(ACCURACY), ...accuracyMethod(ACCURACY)].join(' ');
    expect(text).not.toMatch(/\b(better|improves?|more accurate|higher accuracy)\b/iu);
    expect(text).not.toMatch(/[–—]/u);
  });

  it('names the run, the upstream commit, how tokens were counted and the published results in at most five lines', () => {
    const lines = accuracyMethod(ACCURACY);
    expect(lines.length).toBeLessThanOrEqual(5);
    const method = lines.join('\n');
    for (const run of ACCURACY.publishedRuns) {
      expect(method).toContain(run.runOn);
      expect(method).toContain(`https://github.com/stackdeckhq/terset/tree/main/${run.publishedPath}`);
    }
    expect(method).toContain(ACCURACY.upstreamSha);
    // A 40-character hash cannot fit a 390 px column, so the text shows the short hash
    // and the link carries the full one.
    expect(method).toContain(`commit [${ACCURACY.upstreamSha.slice(0, 7)}](https://github.com/toon-format/toon/commit/${ACCURACY.upstreamSha})`);
    expect(method).toContain('Cost is at API list price: input and output tokens times list prices read on 2026-11-12.');
    expect(method).toContain("Claude Opus 5.5 input tokens were counted with Anthropic's token counting endpoint over the exact request; GPT 6.1 Sol input tokens are as the model reported them.");
    expect(method).toContain('no model judge');
  });

  it('says nothing about how the answers were paid for, and subtracts nothing', () => {
    const text = [...accuracyMethod(ACCURACY), accuracyReadmeBlock(ACCURACY), ACCURACY_KIND_NOTE].join('\n');
    expect(text).not.toMatch(/subscription|\broute\b|API-equivalent|what was paid|\b127\b/iu);
    expect(text).not.toMatch(/[–—]/u);
  });

  it('puts the accuracy tables in benchmark.md', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    expect(text).toContain('## Answer accuracy');
    expect(text).toContain('| Format | Correct | Accuracy | 95% interval | Input tokens | Cost | Costs more than Terset | Run date |');
    expect(text).toContain('| Terset | 243 of 244 | 99.6% | 97.7% to 99.9% | 1,200,640 | $5.69 | Reference | 2026-11-13 |');
    expect(text).toContain('| JSON | 239 of 244 | 98.0% | 95.3% to 99.1% | 2,303,845 | $10.20 | +79.2% | 2026-11-12 |');
    expect(text).not.toContain('Cost vs compact JSON');
    expect(text).toContain(ACCURACY_FORMAT_NOTE);
    expect(text).toContain('### By data set');
    expect(text).toContain('| Structure: missing fields | 1 | −34% | −34% | −7% | −13% |');
    expect(text).toContain('| Data | Questions | vs compact JSON, Opus | vs compact JSON, Sol | vs TOON, Opus | vs TOON, Sol |');
    expect(text).toContain('| Nested config | 29 | +5% | +9% | 0% | −6% |');
    expect(text).toContain(ACCURACY_KIND_NOTE);
    expect(text).toContain('Input tokens, primers included, counted the same way as the tables. Minus means Terset used fewer tokens.');
    expect(text).not.toContain('TOON used fewer tokens than Terset');
  });

  it('keeps the kind table and its line out of the READMEs', () => {
    const block = accuracyReadmeBlock(ACCURACY);
    expect(block).not.toContain('By data set');
    expect(block).not.toContain('TOON used fewer tokens than Terset');
  });

  it('labels the indented JSON row plain JSON and says what each JSON row means', () => {
    const labels = ACCURACY.models.flatMap((item) => accuracyTableRows(item).map(([label]) => label));
    expect(labels).not.toContain('Pretty JSON');
    expect(ACCURACY_FORMAT_NOTE).toBe('JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.');
    expect(accuracyReadmeBlock(ACCURACY)).toContain(ACCURACY_FORMAT_NOTE);
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
