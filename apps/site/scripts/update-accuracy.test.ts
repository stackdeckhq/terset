// Published rows are recomputed, compared and kept in sync with the site.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OUTPUT, PUBLISHED_RUNS, REQUEST_COUNTS, accuracyText, buildAccuracy, wilson95 } from './update-accuracy.ts';
import type { ClaudeRequestCounts } from '../src/data/claude-request-counts-schema.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

interface MutableRun {
  plannedCalls: number;
  models: { id: string; api: string; temperature: string; outputTokenParameter: string; price: { inputPerMillion: number; outputPerMillion: number; sourceUrl: string; dateRead: string } }[];
  dataHashes: Record<string, string>;
  upstreamSha: string;
  tokenizer: string;
  budgets: { perCallMaxOutputTokens: number };
  rows: { model: string; format: string; dataset: string; questionId: string; correct: boolean; inputTokens: number }[];
  failures: unknown[];
  summary: { model: string; format: string; dataset: string; metrics: { correct: number } }[];
}

function freshRuns(): MutableRun[] {
  return PUBLISHED_RUNS.map((source) => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')) as MutableRun);
}

function freshCounts(): ClaudeRequestCounts {
  return JSON.parse(readFileSync(REQUEST_COUNTS, 'utf8')) as ClaudeRequestCounts;
}

function newer(runs: MutableRun[]): MutableRun {
  const run = runs[1];
  if (run === undefined) throw new Error('no later run');
  return run;
}

function firstModel(run: MutableRun): MutableRun['models'][number] {
  const model = run.models[0];
  if (model === undefined) throw new Error('no model');
  return model;
}

function firstRow(run: MutableRun): MutableRun['rows'][number] {
  const row = run.rows[0];
  if (row === undefined) throw new Error('no row');
  return row;
}

describe('accuracy results', () => {
  it('keeps the committed file equal to both published runs', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(accuracyText());
  });

  it('takes only Terset from the newer run, with row dates and the old compact JSON baseline', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    expect(file.questions).toBe(244);
    expect(file.calls).toBe(1952);
    expect(file.failedCalls).toBe(0);
    expect(file.publishedRuns.map((run) => [run.runOn, run.formats])).toEqual([
      ['2026-11-12', ['json-compact', 'json-pretty', 'toon']],
      ['2026-11-13', ['terset']],
    ]);
    const opus = file.models.find((model) => model.id === 'claude-opus-5-5');
    expect(opus?.rows.map((row) => [row.format, row.correct, row.inputTokens, row.runOn])).toEqual([
      ['terset', 243, 1200640, '2026-11-13'],
      ['json-compact', 241, 1766161, '2026-11-12'],
      ['json-pretty', 239, 2303845, '2026-11-12'],
      ['toon', 242, 1369764, '2026-11-12'],
    ]);
    const sol = file.models.find((model) => model.id === 'gpt-6.1-sol');
    expect(sol?.rows[0]).toMatchObject({ correct: 241, inputTokens: 848844, totalCost: 1.852288, runOn: '2026-11-13' });
    expect(opus?.rows[0]?.totalCost).toBe(5.69084);
  });

  it.each([
    ['model id', (run: MutableRun) => { firstModel(run).id = 'different'; }],
    ['API', (run: MutableRun) => { firstModel(run).api = 'different'; }],
    ['temperature', (run: MutableRun) => { firstModel(run).temperature = 'omit'; }],
    ['output parameter', (run: MutableRun) => { firstModel(run).outputTokenParameter = 'max_tokens'; }],
    ['input price', (run: MutableRun) => { firstModel(run).price.inputPerMillion += 1; }],
    ['output price', (run: MutableRun) => { firstModel(run).price.outputPerMillion += 1; }],
    ['price source', (run: MutableRun) => { firstModel(run).price.sourceUrl = 'https://example.invalid'; }],
    ['price date', (run: MutableRun) => { firstModel(run).price.dateRead = '2026-11-13'; }],
    ['data hash', (run: MutableRun) => { run.dataHashes['datasets.json'] = 'different'; }],
    ['question hash', (run: MutableRun) => { run.dataHashes['questions.json'] = 'different'; }],
    ['upstream commit', (run: MutableRun) => { run.upstreamSha = 'different'; }],
    ['tokenizer', (run: MutableRun) => { run.tokenizer = 'different'; }],
    ['output cap', (run: MutableRun) => { run.budgets.perCallMaxOutputTokens += 1; }],
    ['question id', (run: MutableRun) => { firstRow(run).questionId = 'different'; }],
    ['question dataset', (run: MutableRun) => { firstRow(run).dataset = 'different'; }],
  ])('refuses differing %s', (_field, change) => {
    const runs = freshRuns();
    change(newer(runs));
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/Published runs differ/u);
  });

  it('sums input tokens per data set from the run each format is taken from, one row per structure check', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    expect(file.kinds.map((item) => [item.kind, item.questions])).toEqual([
      ['tabular', 41],
      ['analytics', 30],
      ['github', 33],
      ['event-logs', 30],
      ['nested', 41],
      ['nested-group', 18],
      ['keyed', 17],
      ['nested-config', 29],
      ['structure-control', 1],
      ['structure-truncated', 1],
      ['structure-extra-rows', 1],
      ['structure-width-mismatch', 1],
      ['structure-missing-fields', 1],
    ]);
    const keyed = file.kinds.find((item) => item.kind === 'keyed');
    expect(keyed?.models.map((model) => [model.id, model.inputTokens.terset, model.inputTokens['json-compact'], model.inputTokens.toon])).toEqual([
      // Terset from 2026-11-13; compact JSON and TOON from 2026-11-12.
      ['claude-opus-5-5', 21507, 36892, 22578],
      ['gpt-6.1-sol', 16125, 23401, 17757],
    ]);
    for (const item of file.kinds) expect(item.datasets, item.kind).toHaveLength(1);
    for (const model of file.models) {
      for (const row of model.rows) {
        const summed = file.kinds.reduce((sum, item) => sum + (item.models.find((entry) => entry.id === model.id)?.inputTokens[row.format] ?? 0), 0);
        expect(summed, `${model.id} ${row.format}`).toBe(row.inputTokens);
      }
    }
  });

  it('refuses a dataset with no kind of data', () => {
    const runs = freshRuns();
    // Renamed in both runs, so the question-set check still passes and the kind check is reached.
    for (const run of runs) for (const row of run.rows) if (row.dataset === 'keyed') row.dataset = 'mystery';
    const counts = freshCounts();
    for (const row of counts.rows) if (row.dataset === 'keyed') row.dataset = 'mystery';
    expect(() => buildAccuracy(runs, counts)).toThrow(/No kind of data for dataset mystery/u);
  });

  it('matches the harness Wilson interval', () => {
    const { low, high } = wilson95(241, 244);
    expect(low).toBeCloseTo(0.964481398748853, 12);
    expect(high).toBeCloseTo(0.9958099146273562, 12);
    expect(wilson95(30, 30).high).toBe(1);
    expect(wilson95(0, 30).low).toBe(0);
    expect(() => wilson95(3, 2)).toThrow();
  });

  it('refuses a summary that differs from the raw rows in either run', () => {
    for (let index = 0; index < PUBLISHED_RUNS.length; index += 1) {
      const runs = freshRuns();
      const row = runs[index]?.summary.find((item) => item.format === 'terset' && item.dataset === 'ALL');
      if (row === undefined) throw new Error('no summary row');
      row.metrics.correct += 1;
      expect(() => buildAccuracy(runs, freshCounts())).toThrow(/summary differs/u);
    }
  });

  it('refuses failed or missing calls', () => {
    const runs = freshRuns();
    newer(runs).failures.push({});
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/failed calls/u);
    newer(runs).failures = [];
    newer(runs).plannedCalls += 1;
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/planned calls/u);
    newer(runs).plannedCalls -= 1;
    newer(runs).rows.pop();
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/question set/u);
  });
});

describe('Claude input tokens from the request counts', () => {
  const counts = freshCounts();
  const countedSum = (runId: string, format: string): number =>
    counts.rows.filter((row) => row.runId === runId && row.format === format).reduce((sum, row) => sum + row.inputTokens, 0);

  it('holds one count for every published Claude request, counted after a baseline of 9', () => {
    expect(counts.model).toBe('claude-opus-5-5');
    expect(counts.baseline).toEqual({ text: 'a', inputTokens: 9 });
    expect(counts.rows).toHaveLength(976);
  });

  it('publishes the counted Claude tokens and the reported Sol tokens, with cost from those tokens', () => {
    const file = buildAccuracy(freshRuns(), counts);
    const opus = file.models.find((model) => model.id === 'claude-opus-5-5');
    const sol = file.models.find((model) => model.id === 'gpt-6.1-sol');
    expect(opus?.inputTokensFrom).toBe('anthropic-token-count');
    expect(sol?.inputTokensFrom).toBe('model-report');
    for (const row of opus?.rows ?? []) {
      const runId = file.publishedRuns.find((run) => run.formats.includes(row.format))?.runId ?? '';
      expect(row.inputTokens, row.format).toBe(countedSum(runId, row.format));
      expect(row.totalCost, row.format).toBeCloseTo((row.inputTokens * 4 + row.outputTokens * 20) / 1_000_000, 9);
    }
    expect(sol?.rows[0]?.inputTokens).toBe(848844);
  });

  it('refuses a published Claude request with no count', () => {
    const missing = freshCounts();
    missing.rows.pop();
    expect(() => buildAccuracy(freshRuns(), missing)).toThrow(/No request count for/u);
  });

  it('refuses a count that matches no published request', () => {
    const extra = freshCounts();
    const row = extra.rows[0];
    if (row === undefined) throw new Error('no count');
    extra.rows.push({ ...row, questionId: 'not-asked' });
    expect(() => buildAccuracy(freshRuns(), extra)).toThrow(/1 request counts match no published request/u);
  });

  it('refuses counts for a model that is not Claude', () => {
    expect(() => buildAccuracy(freshRuns(), { ...freshCounts(), model: 'gpt-6.1-sol' })).toThrow(/not a Claude model/u);
  });
});
