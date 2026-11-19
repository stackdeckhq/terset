// Published rows are recomputed from small fixture runs, compared and kept in sync with the site.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KIND_DATASETS, OUTPUT, PUBLISHED_RUNS, accuracyText, buildAccuracy, wilson95 } from './update-accuracy.ts';
import type { PublishedSource } from './update-accuracy.ts';
import { STRESS_OUTPUT, STRESS_PUBLISHED_RUNS } from './accuracy-stress.ts';
import type { RunFile } from './accuracy-runs.ts';
import { StressAccuracyFileSchema } from '../src/data/accuracy-stress-schema.ts';
import { ACCURACY_FORMATS } from '../src/data/accuracy-schema.ts';
import type { AccuracyFile } from '../src/data/accuracy-schema.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const OPUS = 'claude-opus-5-5';
const SOL = 'gpt-6.1-sol';
const PRICES: Readonly<Record<string, readonly [number, number]>> = { [OPUS]: [4, 20], [SOL]: [2, 10] };
const DATASETS = Object.values(KIND_DATASETS).flat();

/** The overall summary row of each format, as the harness writes it. */
function summaryOf(run: Pick<RunFile, 'rows' | 'models'>): RunFile['summary'] {
  return run.models.flatMap((model) => ACCURACY_FORMATS.map((format) => {
    const rows = run.rows.filter((row) => row.model === model.id && row.format === format);
    const correct = rows.filter((row) => row.correct).length;
    const inputTokens = rows.reduce((sum, row) => sum + row.inputTokens, 0);
    const outputTokens = rows.reduce((sum, row) => sum + row.outputTokens, 0);
    const { low, high } = wilson95(correct, rows.length);
    const totalCost = (inputTokens * model.price.inputPerMillion + outputTokens * model.price.outputPerMillion) / 1_000_000;
    return { model: model.id, format, dataset: 'ALL', metrics: { correct, total: rows.length, inputTokens, outputTokens, totalCost, wilson95: { lower: low, upper: high } } };
  }));
}

/**
 * One question per dataset, so 13 questions in each of the four formats. Format f misses the
 * question of dataset f, and input tokens grow with the format and the dataset.
 */
function fixtureRun(source: PublishedSource): RunFile {
  const [inputPerMillion, outputPerMillion] = PRICES[source.model] ?? [1, 1];
  const rows = ACCURACY_FORMATS.flatMap((format, f) => DATASETS.map((dataset, d) => ({
    model: source.model, format, dataset, questionId: `q${String(d)}`, correct: d !== f,
    inputTokens: 100 + 10 * f + d, outputTokens: 5 + f, reservedInputTokens: 200,
  })));
  const models = [{ id: source.model, api: 'fixture', temperature: 'default', outputTokenParameter: 'max_tokens', price: { inputPerMillion, outputPerMillion, sourceUrl: 'https://example.invalid/prices', dateRead: '2026-11-17' } }];
  return {
    runId: basename(source.path, '.json'), fingerprint: 'fixture-plan', mode: 'http', status: 'complete',
    plannedCalls: rows.length, rows, failures: [], inputReservation: { margin: 1.25, allowance: 64 }, models,
    upstreamSha: 'a'.repeat(40), dataHashes: { 'datasets.json': 'd', 'questions.json': 'q' }, tokenizer: 'o200k_base',
    budgets: { perCallMaxOutputTokens: 2048 }, summary: summaryOf({ rows, models }),
  };
}

const SOURCES: readonly PublishedSource[] = [
  { path: 'bench/published/2099-01-01/fixture-opus.json', model: OPUS },
  { path: 'bench/published/2099-01-01/fixture-sol.json', model: SOL },
];

function freshRuns(): [RunFile, RunFile] {
  const [opus, sol] = SOURCES;
  if (opus === undefined || sol === undefined) throw new Error('no sources');
  return [fixtureRun(opus), fixtureRun(sol)];
}

function build(runs: readonly RunFile[]): AccuracyFile {
  return buildAccuracy(runs, SOURCES);
}

function firstRow(run: RunFile): RunFile['rows'][number] {
  const row = run.rows[0];
  if (row === undefined) throw new Error('no row');
  return row;
}

describe('every published run', () => {
  const published = `${REPO}bench/published/`;
  // A missing folder lists no files, so the tests below fail on the comparison, not on loading the file.
  const runFiles = (existsSync(published) ? readdirSync(published, { recursive: true, encoding: 'utf8' }) : [])
    .filter((name) => name.endsWith('.json'))
    .map((name) => `bench/published/${name}`)
    .sort();

  it('lists one main run and one stress run per model', () => {
    expect(PUBLISHED_RUNS.map((source) => source.model)).toEqual([OPUS, SOL]);
    expect(STRESS_PUBLISHED_RUNS.map((source) => source.model)).toEqual([OPUS, SOL, 'claude-haiku-5-5']);
  });

  it('lists every run file in bench/published in the script, so none is left out', () => {
    expect([...PUBLISHED_RUNS, ...STRESS_PUBLISHED_RUNS].map((source) => source.path).sort()).toEqual(runFiles);
  });

  it('lists every run file in bench/published in the site data', () => {
    const site = JSON.parse(readFileSync(OUTPUT, 'utf8')) as AccuracyFile;
    const stress = StressAccuracyFileSchema.parse(JSON.parse(readFileSync(STRESS_OUTPUT, 'utf8')));
    expect([...site.publishedRuns, ...stress.publishedRuns].map((run) => `${run.publishedPath}/${run.runId}.json`).sort()).toEqual(runFiles);
  });
});

describe('accuracy results', () => {
  it('keeps the committed file equal to the published runs', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(accuracyText());
  });

  it('takes each model from its one run, with every number recomputed from the raw rows', () => {
    const file = build(freshRuns());
    expect(file.questions).toBe(13);
    expect(file.datasets).toBe(13);
    expect(file.calls).toBe(13 * 4 * 2);
    expect(file.failedCalls).toBe(0);
    expect(file.publishedRuns).toEqual([
      { runId: 'fixture-opus', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: OPUS, failedRequests: 0 },
      { runId: 'fixture-sol', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: SOL, failedRequests: 0 },
    ]);
    expect(file.models.map((model) => [model.id, model.inputTokensFrom, model.inputPerMillion, model.outputPerMillion])).toEqual([
      [OPUS, 'model-report', 4, 20],
      [SOL, 'model-report', 2, 10],
    ]);
    // Input tokens per format: 13 questions at 100 + 10f + d, d from 0 to 12.
    const tokens = (f: number): number => 13 * (100 + 10 * f) + 78;
    for (const model of file.models) {
      const [inputPerMillion, outputPerMillion] = PRICES[model.id] ?? [0, 0];
      expect(model.rows.map((row) => [row.format, row.correct, row.total, row.inputTokens, row.outputTokens])).toEqual(
        ACCURACY_FORMATS.map((format, f) => [format, 12, 13, tokens(f), 13 * (5 + f)]),
      );
      for (const row of model.rows) {
        expect(row.totalCost, `${model.id} ${row.format}`).toBeCloseTo((row.inputTokens * inputPerMillion + row.outputTokens * outputPerMillion) / 1_000_000, 12);
        expect([row.low, row.high]).toEqual(Object.values(wilson95(12, 13)));
      }
    }
  });

  it('sums input tokens per data set, one row per kind, adding up to each row', () => {
    const file = build(freshRuns());
    expect(file.kinds.map((item) => [item.kind, item.datasets, item.questions])).toEqual(Object.entries(KIND_DATASETS).map(([kind, datasets]) => [kind, datasets, 1]));
    const keyed = file.kinds.find((item) => item.kind === 'keyed');
    expect(keyed?.models.map((model) => [model.id, model.inputTokens.terset, model.inputTokens['json-compact']])).toEqual([[OPUS, 106, 116], [SOL, 106, 116]]);
    for (const model of file.models) {
      for (const row of model.rows) {
        const summed = file.kinds.reduce((sum, item) => sum + (item.models.find((entry) => entry.id === model.id)?.inputTokens[row.format] ?? 0), 0);
        expect(summed, `${model.id} ${row.format}`).toBe(row.inputTokens);
      }
    }
  });

  it('keeps every failed request that was retried, and counts them', () => {
    const runs = freshRuns();
    const row = firstRow(runs[1]);
    runs[1].failures.push({ model: row.model, format: row.format, dataset: row.dataset, questionId: row.questionId, status: 'failed' });
    const file = build(runs);
    expect(file.failedCalls).toBe(1);
    expect(file.publishedRuns.map((run) => run.failedRequests)).toEqual([0, 1]);
  });

  it('refuses a failed request that was never answered', () => {
    const runs = freshRuns();
    runs[1].failures.push({ model: SOL, format: 'toon', dataset: 'keyed', questionId: 'not-asked', status: 'failed' });
    expect(() => build(runs)).toThrow(/a failed request was never answered/u);
  });

  it('refuses a run that holds another model too', () => {
    const runs = freshRuns();
    runs[1].models.push(...structuredClone(runs[0].models));
    expect(() => build(runs)).toThrow(/the run must hold only gpt-6.1-sol/u);
  });

  it('refuses models out of order, a missing run and a file that holds another run', () => {
    const [opus, sol] = freshRuns();
    expect(() => buildAccuracy([sol, opus], [...SOURCES].reverse())).toThrow(/model list/u);
    expect(() => buildAccuracy([opus], SOURCES)).toThrow(/Expected every published run/u);
    sol.runId = 'other';
    expect(() => build([opus, sol])).toThrow(/fixture-sol.json holds run other, not fixture-sol/u);
  });

  it('refuses a run published twice', () => {
    const twice = SOURCES.map((source) => ({ ...source, path: source.path.replace(/fixture-\w+/u, 'fixture-same') }));
    const runs = freshRuns();
    for (const run of runs) run.runId = 'fixture-same';
    expect(() => buildAccuracy(runs, twice)).toThrow(/A run is published twice/u);
  });

  it.each([
    ['data hash', (run: RunFile) => { run.dataHashes['datasets.json'] = 'different'; }],
    ['question hash', (run: RunFile) => { run.dataHashes['questions.json'] = 'different'; }],
    ['upstream commit', (run: RunFile) => { run.upstreamSha = 'different'; }],
    ['tokenizer', (run: RunFile) => { run.tokenizer = 'different'; }],
    ['output cap', (run: RunFile) => { run.budgets.perCallMaxOutputTokens += 1; }],
    ['input reservation', (run: RunFile) => { run.inputReservation.allowance += 1; }],
    ['question id', (run: RunFile) => { firstRow(run).questionId = 'different'; }],
    ['question dataset', (run: RunFile) => { firstRow(run).dataset = 'different'; }],
  ])('refuses differing %s', (_field, change) => {
    const runs = freshRuns();
    change(runs[1]);
    expect(() => build(runs)).toThrow(/Published runs differ/u);
  });

  it('refuses a summary that differs from the raw rows', () => {
    for (const index of [0, 1] as const) {
      const runs = freshRuns();
      const row = runs[index].summary.find((item) => item.format === 'terset' && item.dataset === 'ALL');
      if (row === undefined) throw new Error('no summary row');
      row.metrics.correct += 1;
      expect(() => build(runs), String(index)).toThrow(/summary differs/u);
    }
  });

  it('refuses missing calls', () => {
    const runs = freshRuns();
    runs[1].plannedCalls += 1;
    expect(() => build(runs)).toThrow(/planned calls/u);
  });

  it('refuses a dataset with no kind of data', () => {
    const runs = freshRuns();
    // Renamed in every run, so the question-set check still passes and the kind check is reached.
    for (const run of runs) for (const row of run.rows) if (row.dataset === 'keyed') row.dataset = 'mystery';
    expect(() => build(runs)).toThrow(/No kind of data for dataset mystery/u);
  });

  it('matches the harness Wilson interval', () => {
    const { low, high } = wilson95(241, 244);
    expect(low).toBeCloseTo(0.964481398748853, 12);
    expect(high).toBeCloseTo(0.9958099146273562, 12);
    expect(wilson95(30, 30).high).toBe(1);
    expect(wilson95(0, 30).low).toBe(0);
    expect(() => wilson95(3, 2)).toThrow();
  });
});
