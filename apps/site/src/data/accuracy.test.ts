// The accuracy copy states only what the data supports, the tables come from the
// committed file, and both READMEs carry the same block word for word.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACCURACY,
  ACCURACY_FORMAT_NOTE,
  ACCURACY_KIND_NOTE,
  ACCURACY_RUNS_HEAD,
  ACCURACY_TABLE_HEAD,
  accuracyHomeLine,
  accuracyKindLine,
  accuracyLines,
  accuracyMethod,
  accuracyReadmeBlock,
  accuracyRunsNote,
  accuracySummary,
  accuracyTableMarks,
  accuracyTableRows,
  costOverTerset,
  failedCallsLine,
  intervalsOverlap,
  kindMarkdownHead,
  kindTableRows,
  overTersetMark,
  publishedRunsRows,
  runsCellLines,
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
    expect(ACCURACY_TABLE_HEAD.slice(1, 3)).toEqual(['Correct', 'Runs']);
    expect(ACCURACY_TABLE_HEAD.slice(-2)).toEqual(['Costs more than Terset', 'Run date']);
    expect(accuracyTableRows(model('claude-opus-5-5'))).toEqual([
      ['Terset', '242 of 244', 'Mean of 2 runs: 242, 242', '99.2%', '97.1% to 99.8%', '1,188,659', '$5.64', 'Reference', '2026-11-17'],
      ['Compact JSON', '241 of 244', '1 run', '98.8%', '96.4% to 99.6%', '1,766,161', '$8.04', '+42.6%', '2026-11-12'],
      ['JSON', '239 of 244', '1 run', '98.0%', '95.3% to 99.1%', '2,303,845', '$10.20', '+80.8%', '2026-11-12'],
      ['TOON', '242 of 244', '1 run', '99.2%', '97.1% to 99.8%', '1,369,764', '$6.35', '+12.6%', '2026-11-12'],
    ]);
    // Sol comes from its matched batch: every format is the mean of three runs on one day.
    expect(accuracyTableRows(model('gpt-6.1-sol'))).toEqual([
      ['Terset', '242 of 244', 'Mean of 3 runs: 242, 241, 243 (241 to 243)', '99.2%', '97.1% to 99.8%', '842,260', '$1.84', 'Reference', '2026-11-17'],
      ['Compact JSON', '235.3 of 244', 'Mean of 3 runs: 236, 234, 236 (234 to 236)', '96.4%', '93.3% to 98.1%', '1,158,229', '$2.49', '+35.3%', '2026-11-17'],
      ['JSON', '237.3 of 244', 'Mean of 3 runs: 237, 238, 237 (237 to 238)', '97.3%', '94.4% to 98.7%', '1,696,152', '$3.56', '+93.0%', '2026-11-17'],
      ['TOON', '242 of 244', 'Mean of 3 runs: 242, 242, 242', '99.2%', '97.1% to 99.8%', '1,020,628', '$2.20', '+19.2%', '2026-11-17'],
    ]);
  });

  it('shows a mean with a fraction to one decimal, and a whole mean as a count', () => {
    const half = withRows((rows) => {
      const terset = rows.find((row) => row.format === 'terset');
      if (terset === undefined) throw new Error('missing row');
      terset.correct = 240.5;
    });
    expect(accuracyTableRows(half.models[0] ?? model('claude-opus-5-5'))[0]?.[1]).toBe('240.5 of 244');
  });

  it('splits the runs cell into the mean line and the scores line, so the page column stays narrow', () => {
    const lines = (id: string, format: string): readonly string[] => {
      const row = model(id).rows.find((item) => item.format === format);
      if (row === undefined) throw new Error(`no ${format} row`);
      return runsCellLines(row);
    };
    expect(lines('gpt-6.1-sol', 'terset')).toEqual(['Mean of 3 runs', '242, 241, 243 (241 to 243)']);
    expect(lines('gpt-6.1-sol', 'toon')).toEqual(['Mean of 3 runs', '242, 242, 242']);
    expect(lines('claude-opus-5-5', 'terset')).toEqual(['Mean of 2 runs', '242, 242']);
    expect(lines('claude-opus-5-5', 'toon')).toEqual(['1 run']);
  });

  it('says how many runs each format has, and throws once that no longer holds', () => {
    expect(accuracyRunsNote(ACCURACY)).toBe(
      'Claude Opus 5.5: Terset has two runs, both on 2026-11-17, and the other formats have one run each, on 2026-11-12. Its matched batch is not published yet, so these rows use the earlier runs. ' +
        'GPT 6.1 Sol: every format ran three times on 2026-11-17, in one matched batch with the same setup. ' +
        "No run is picked. Each row shows the mean of its runs, and the Runs column lists each run's score.",
    );
    const oneRun = withRows((rows) => {
      const terset = rows.find((row) => row.format === 'terset');
      if (terset === undefined) throw new Error('missing row');
      terset.runs = terset.runs.slice(0, 1);
    });
    expect(() => accuracyRunsNote(oneRun)).toThrow(/more than one run on Claude Opus 5\.5/u);
    const repeated = withRows((rows) => {
      const toon = rows.find((row) => row.format === 'toon');
      const run = toon?.runs[0];
      if (toon === undefined || run === undefined) throw new Error('missing row');
      toon.runs = [run, { ...run, runId: 'again' }];
    });
    expect(() => accuracyRunsNote(repeated)).toThrow(/one run each/u);
  });

  it('says a matched batch ran every format the same number of times on one day, and throws once that no longer holds', () => {
    const solRows = (change: (rows: AccuracyModel['rows'][number][]) => void): AccuracyFile => {
      const copy = structuredClone(ACCURACY) as AccuracyFile & { models: (AccuracyModel & { rows: AccuracyModel['rows'][number][] })[] };
      const sol = copy.models.find((item) => item.id === 'gpt-6.1-sol');
      if (sol === undefined) throw new Error('no Sol');
      change(sol.rows);
      return copy;
    };
    const uneven = solRows((rows) => {
      const toon = rows.find((row) => row.format === 'toon');
      if (toon === undefined) throw new Error('missing row');
      toon.runs = toon.runs.slice(0, 2);
    });
    expect(() => accuracyRunsNote(uneven)).toThrow(/same repeats/u);
    const twoDays = solRows((rows) => {
      const toon = rows.find((row) => row.format === 'toon');
      const run = toon?.runs[0];
      if (toon === undefined || run === undefined) throw new Error('missing row');
      toon.runs = [{ ...run, runOn: '2026-11-18' }, ...toon.runs.slice(1)];
    });
    expect(() => accuracyRunsNote(twoDays)).toThrow(/ran on one day/u);
  });

  it('lists every published run with what the tables take from it, older runs as history', () => {
    expect(ACCURACY_RUNS_HEAD).toEqual(['Run', 'Date', 'Models', 'Formats', 'In the tables', 'Failed requests']);
    expect(publishedRunsRows(ACCURACY)).toEqual([
      ['p4-2026-11-12', '2026-11-12', 'Opus and Sol', 'All four', 'Opus: Compact JSON, JSON and TOON', '0'],
      ['v2-final-2026-11-13', '2026-11-13', 'Opus and Sol', 'Terset', 'History only', '0'],
      ['fitted-rules-2026-11-17', '2026-11-17', 'Opus and Sol', 'Terset', 'Opus: Terset', '0'],
      ['fitted-rules-rerun-2026-11-17', '2026-11-17', 'Opus and Sol', 'Terset', 'Opus: Terset', '0'],
      ['matched-sol-2026-11-17-r1', '2026-11-17', 'Sol', 'All four', 'Sol: All four', '2, retried'],
      ['matched-sol-2026-11-17-r2', '2026-11-17', 'Sol', 'All four', 'Sol: All four', '0'],
      ['matched-sol-2026-11-17-r3', '2026-11-17', 'Sol', 'All four', 'Sol: All four', '0'],
    ]);
  });

  it('says how many requests failed and that they stay in the run file', () => {
    expect(failedCallsLine(ACCURACY)).toBe('Two requests failed and were retried in the same run. Both stay in the run file.');
    expect(failedCallsLine({ ...ACCURACY, failedCalls: 0 })).toBe('None failed.');
    expect(failedCallsLine({ ...ACCURACY, failedCalls: 1 })).toBe('One request failed and was retried in the same run. It stays in the run file.');
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
      [null, null, null, null, 'is-less', 'is-less', null, null],
      [null, null, null, null, null, null, 'terset-cheaper', null],
      [null, null, null, null, null, null, 'terset-cheaper', null],
      [null, null, null, null, null, null, 'terset-cheaper', null],
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
    expect(accuracyTableRows(first).map((row) => row[7])).toEqual(['Reference', '+42.6%', '+80.8%', '−10.0%']);
    expect(accuracyTableMarks(first).map((row) => row[6])).toEqual([null, 'terset-cheaper', 'terset-cheaper', 'terset-pricier']);
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
    expect(marks.map((row) => row[4])).toEqual([null, null, null, 'is-less']);
    expect(marks.map((row) => row[5])).toEqual([null, null, null, 'is-less']);
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
    expect(accuracyTableMarks(first).map((row) => row[4])).toEqual(['is-less', null, null, 'is-less']);
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
      'Against compact JSON, Terset cost 29.9% less on Claude Opus 5.5 and 26.1% less on GPT 6.1 Sol.',
    ]);
  });

  it('shows Terset input tokens against compact JSON and TOON per kind of data, losses included', () => {
    expect(kindMarkdownHead(ACCURACY)).toEqual(['Data', 'Questions', 'vs compact JSON, Opus', 'vs compact JSON, Sol', 'vs TOON, Opus', 'vs TOON, Sol']);
    expect(kindTableRows(ACCURACY)).toEqual([
      ['Flat tables', '41', '−42%', '−41%', '−5%', '−11%'],
      ['Analytics', '30', '−52%', '−39%', '−10%', '−11%'],
      ['GitHub repos', '33', '−33%', '−25%', '−2%', '−4%'],
      ['Event logs', '30', '−33%', '−26%', '−38%', '−39%'],
      ['Nested orders', '41', '−22%', '−19%', '−15%', '−23%'],
      ['Nested groups', '18', '−40%', '−42%', '−5%', '−8%'],
      ['Keyed objects', '17', '−44%', '−33%', '−9%', '−12%'],
      ['Nested config', '29', '+1%', '+5%', '−3%', '−9%'],
      ['Structure: control', '1', '−37%', '−37%', '−12%', '−17%'],
      ['Structure: truncated', '1', '−36%', '−36%', '−13%', '−18%'],
      ['Structure: extra rows', '1', '−38%', '−37%', '−11%', '−16%'],
      ['Structure: width mismatch', '1', '−37%', '−37%', '−12%', '−17%'],
      ['Structure: missing fields', '1', '−38%', '−37%', '−13%', '−18%'],
    ]);
    expect(wholePct(100, 100)).toBe('0%');
    expect(wholePct(99.6, 100)).toBe('0%');
  });

  it('adds a third line only for kinds where TOON used fewer tokens on both models', () => {
    // Terset is under TOON on every kind for both models, so no kind qualifies.
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
    expect(method).toContain('Cost is at API list price: input and output tokens times list prices read on 2026-11-12 and 2026-11-17.');
    expect(method).toContain('Tables use 4,148 answered calls from runs on 2026-11-12 and 2026-11-17. Two requests failed and were retried in the same run.');
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
    expect(text).toContain('| Format | Correct | Runs | Accuracy | 95% interval | Input tokens | Cost | Costs more than Terset | Run date |');
    expect(text).toContain('| Terset | 242 of 244 | Mean of 2 runs: 242, 242 | 99.2% | 97.1% to 99.8% | 1,188,659 | $5.64 | Reference | 2026-11-17 |');
    expect(text).toContain('| Terset | 242 of 244 | Mean of 3 runs: 242, 241, 243 (241 to 243) | 99.2% | 97.1% to 99.8% | 842,260 | $1.84 | Reference | 2026-11-17 |');
    expect(text).toContain('| matched-sol-2026-11-17-r1 | 2026-11-17 | Sol | All four | Sol: All four | 2, retried |');
    expect(text).toContain('| v2-final-2026-11-13 | 2026-11-13 | Opus and Sol | Terset | History only | 0 |');
    expect(text).toContain('| JSON | 239 of 244 | 1 run | 98.0% | 95.3% to 99.1% | 2,303,845 | $10.20 | +80.8% | 2026-11-12 |');
    expect(text).toContain(accuracyRunsNote(ACCURACY));
    expect(text).not.toContain('Cost vs compact JSON');
    expect(text).toContain(ACCURACY_FORMAT_NOTE);
    expect(text).toContain('### By data set');
    expect(text).toContain('| Structure: missing fields | 1 | −38% | −37% | −13% | −18% |');
    expect(text).toContain('| Data | Questions | vs compact JSON, Opus | vs compact JSON, Sol | vs TOON, Opus | vs TOON, Sol |');
    expect(text).toContain('| Nested config | 29 | +1% | +5% | −3% | −9% |');
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
