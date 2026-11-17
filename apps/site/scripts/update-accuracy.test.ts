// Published rows are recomputed, compared and kept in sync with the site.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OUTPUT, PUBLISHED_RUNS, REQUEST_COUNTS, accuracyText, buildAccuracy, wilson95 } from './update-accuracy.ts';
import type { ClaudeRequestCounts } from '../src/data/claude-request-counts-schema.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

interface MutableRun {
  fingerprint: string;
  plannedCalls: number;
  models: { id: string; api: string; temperature: string; outputTokenParameter: string; price: { inputPerMillion: number; outputPerMillion: number; sourceUrl: string; dateRead: string } }[];
  dataHashes: Record<string, string>;
  upstreamSha: string;
  tokenizer: string;
  budgets: { perCallMaxOutputTokens: number };
  rows: { model: string; format: string; dataset: string; questionId: string; correct: boolean; inputTokens: number; reservedInputTokens: number }[];
  failures: unknown[];
  summary: { model: string; format: string; dataset: string; metrics: { correct: number } }[];
}

function freshRuns(): MutableRun[] {
  return PUBLISHED_RUNS.map((source) => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')) as MutableRun);
}

function freshCounts(): ClaudeRequestCounts {
  return JSON.parse(readFileSync(REQUEST_COUNTS, 'utf8')) as ClaudeRequestCounts;
}

/** The latest published run. */
function newer(runs: MutableRun[]): MutableRun {
  const run = runs.at(-1);
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

describe('every published Terset run', () => {
  const folder = `${REPO}bench/published/2026-11-17/`;
  const fittedRuns = readdirSync(folder).filter((name) => /^fitted-rules.*\.json$/u.test(name)).sort();

  it('puts every fitted-rules run file in the site data, so no run can be picked', () => {
    expect(fittedRuns.length).toBeGreaterThanOrEqual(2);
    const site = JSON.parse(readFileSync(OUTPUT, 'utf8')) as { publishedRuns: { runId: string; formats: string[] }[] };
    for (const name of fittedRuns) {
      const { runId } = JSON.parse(readFileSync(`${folder}${name}`, 'utf8')) as { runId: string };
      expect(PUBLISHED_RUNS.map((source) => source.path), name).toContain(`bench/published/2026-11-17/${name}`);
      expect(site.publishedRuns.find((run) => run.runId === runId)?.formats, runId).toContain('terset');
    }
  });

  it('shows the Terset score as the mean of its runs, with each run beside it', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    const terset = (id: string) => file.models.find((model) => model.id === id)?.rows.find((row) => row.format === 'terset');
    expect(terset('claude-opus-5-5')).toMatchObject({ correct: 242, total: 244 });
    expect(terset('claude-opus-5-5')?.runs.map((run) => [run.runId, run.correct])).toEqual([
      ['fitted-rules-2026-11-17', 242],
      ['fitted-rules-rerun-2026-11-17', 242],
    ]);
    expect(terset('gpt-6.1-sol')).toMatchObject({ correct: 240, total: 244 });
    expect(terset('gpt-6.1-sol')?.runs.map((run) => [run.runId, run.correct])).toEqual([
      ['fitted-rules-2026-11-17', 238],
      ['fitted-rules-rerun-2026-11-17', 242],
    ]);
    // The other formats have one run each.
    expect(file.models.every((model) => model.rows.filter((row) => row.format !== 'terset').every((row) => row.runs.length === 1))).toBe(true);
  });
});

describe('accuracy results', () => {
  it('keeps the committed file equal to every published run', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(accuracyText());
  });

  it('takes Terset from both later runs and the rest from the first, with run dates and means', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    expect(file.questions).toBe(244);
    expect(file.calls).toBe(2440);
    expect(file.failedCalls).toBe(0);
    expect(file.publishedRuns.map((run) => [run.runOn, run.formats])).toEqual([
      ['2026-11-12', ['json-compact', 'json-pretty', 'toon']],
      ['2026-11-17', ['terset']],
      ['2026-11-17', ['terset']],
    ]);
    const opus = file.models.find((model) => model.id === 'claude-opus-5-5');
    expect(opus?.rows.map((row) => [row.format, row.correct, row.inputTokens, row.runs.map((run) => run.runOn)])).toEqual([
      ['terset', 242, 1188659, ['2026-11-17', '2026-11-17']],
      ['json-compact', 241, 1766161, ['2026-11-12']],
      ['json-pretty', 239, 2303845, ['2026-11-12']],
      ['toon', 242, 1369764, ['2026-11-12']],
    ]);
    const sol = file.models.find((model) => model.id === 'gpt-6.1-sol');
    // Output tokens and cost differ between the runs, so the row carries their mean.
    expect(sol?.rows[0]?.runs.map((run) => [run.outputTokens, run.totalCost])).toEqual([[14979, 1.83431], [15670, 1.84122]]);
    expect(sol?.rows[0]).toMatchObject({ correct: 240, inputTokens: 842260, outputTokens: 15324.5 });
    expect(sol?.rows[0]?.totalCost).toBeCloseTo(1.837765, 9);
    expect(opus?.rows[0]?.totalCost).toBeCloseTo(5.638606, 9);
    // The interval is for the mean score over the 244 questions.
    expect(sol?.rows[0]?.low).toBeCloseTo(wilson95(240, 244).low, 12);
  });

  it('lets a run use another run\'s Claude counts only when it sent the same requests', () => {
    const borrowing = (runs: MutableRun[]): MutableRun => {
      const index = PUBLISHED_RUNS.findIndex((source) => source.claudeCountsFrom !== undefined);
      const run = runs[index];
      if (run === undefined) throw new Error('no run that uses another run\'s counts');
      return run;
    };
    const plan = freshRuns();
    borrowing(plan).fingerprint = 'different';
    expect(() => buildAccuracy(plan, freshCounts())).toThrow(/its plan differs/u);
    const request = freshRuns();
    const row = borrowing(request).rows.find((entry) => entry.model === 'claude-opus-5-5' && entry.format === 'terset');
    if (row === undefined) throw new Error('no Terset row');
    row.reservedInputTokens += 1;
    expect(() => buildAccuracy(request, freshCounts())).toThrow(/a request differs/u);
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
      // Terset from 2026-11-17; compact JSON and TOON from 2026-11-12.
      ['claude-opus-5-5', 20504, 36892, 22578],
      ['gpt-6.1-sol', 15581, 23401, 17757],
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
    const countedAs = (runId: string): string => PUBLISHED_RUNS.find((source) => source.path.endsWith(`/${runId}.json`))?.claudeCountsFrom ?? runId;
    for (const row of opus?.rows ?? []) {
      for (const run of row.runs) expect(run.inputTokens, `${row.format} ${run.runId}`).toBe(countedSum(countedAs(run.runId), row.format));
      expect(row.totalCost, row.format).toBeCloseTo((row.inputTokens * 4 + row.outputTokens * 20) / 1_000_000, 9);
    }
    expect(sol?.rows[0]?.inputTokens).toBe(842260);
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
