// Published rows are recomputed, compared and kept in sync with the site.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OPUS_COUNTS_FROM, OUTPUT, PUBLISHED_RUNS, REQUEST_COUNTS, accuracyText, buildAccuracy, claudeCountedFormats, headlineFormats, sourceRunId, wilson95 } from './update-accuracy.ts';
import type { PublishedSource } from './update-accuracy.ts';
import type { AccuracyFile, AccuracyFormat } from '../src/data/accuracy-schema.ts';
import type { ClaudeRequestCounts } from '../src/data/claude-request-counts-schema.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

interface MutableRun {
  runId: string;
  fingerprint: string;
  plannedCalls: number;
  models: { id: string; api: string; temperature: string; outputTokenParameter: string; price: { inputPerMillion: number; outputPerMillion: number; sourceUrl: string; dateRead: string } }[];
  inputReservation: { margin: number; allowance: number };
  dataHashes: Record<string, string>;
  upstreamSha: string;
  tokenizer: string;
  budgets: { perCallMaxOutputTokens: number };
  rows: { model: string; format: string; dataset: string; questionId: string; correct: boolean; inputTokens: number; reservedInputTokens: number }[];
  failures: { model: string; format: string; dataset: string; questionId: string; status: string }[];
  summary: { model: string; format: string; dataset: string; metrics: { correct: number } }[];
}

function freshRuns(): MutableRun[] {
  return PUBLISHED_RUNS.map((source) => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')) as MutableRun);
}

function freshCounts(): ClaudeRequestCounts {
  return JSON.parse(readFileSync(REQUEST_COUNTS, 'utf8')) as ClaudeRequestCounts;
}

function runNamed(runs: MutableRun[], runId: string): MutableRun {
  const run = runs.find((item) => item.runId === runId);
  if (run === undefined) throw new Error(`no run ${runId}`);
  return run;
}

/** The last matched Sol repeat. */
function newer(runs: MutableRun[]): MutableRun {
  return runNamed(runs, 'matched-sol-2026-11-17-r3');
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

function modelOf(file: AccuracyFile, id: string): AccuracyFile['models'][number] {
  const model = file.models.find((item) => item.id === id);
  if (model === undefined) throw new Error(`no model ${id}`);
  return model;
}

const SOL_BATCH = ['matched-sol-2026-11-17-r1', 'matched-sol-2026-11-17-r2', 'matched-sol-2026-11-17-r3'];
const OPUS_BATCH = ['matched-opus-2026-11-17-r1', 'matched-opus-2026-11-17-r2', 'matched-opus-2026-11-17-r3'];
const OPUS = 'claude-opus-5-5';

/**
 * A stand-in for an Opus matched repeat, built from the Opus rows the earlier runs recorded:
 * compact JSON, JSON and TOON from 2026-11-12 and Terset from the fitted-rules rerun. It holds
 * only Opus and has its own plan fingerprint, like the real files will.
 */
function opusRepeat(runs: MutableRun[], runId: string): MutableRun {
  const p4 = runNamed(runs, 'p4-2026-11-12');
  const rerun = runNamed(runs, 'fitted-rules-rerun-2026-11-17');
  const opusOf = <T extends { model: string; format: string }>(items: readonly T[], formats: readonly string[]): T[] =>
    items.filter((item) => item.model === OPUS && formats.includes(item.format));
  const older = ['json-compact', 'json-pretty', 'toon'];
  const rows = [...opusOf(p4.rows, older), ...opusOf(rerun.rows, ['terset'])];
  return {
    ...structuredClone(p4),
    runId,
    fingerprint: 'opus-batch',
    plannedCalls: rows.length,
    models: p4.models.filter((model) => model.id === OPUS),
    rows: structuredClone(rows),
    failures: [],
    summary: structuredClone([...opusOf(p4.summary, older), ...opusOf(rerun.summary, ['terset'])]),
  };
}

const opusSources: readonly PublishedSource[] = OPUS_BATCH.map((runId): PublishedSource => ({
  kind: 'matched', path: `bench/published/2026-11-17/${runId}.json`, model: OPUS, claudeCountsFrom: OPUS_COUNTS_FROM,
}));

/** Every published run, plus three stand-in Opus matched repeats. */
function withOpusBatch(): { readonly runs: MutableRun[]; readonly sources: readonly PublishedSource[] } {
  const runs = freshRuns();
  return { runs: [...runs, ...OPUS_BATCH.map((runId) => opusRepeat(runs, runId))], sources: [...PUBLISHED_RUNS, ...opusSources] };
}

describe('every published run', () => {
  const published = `${REPO}bench/published/`;
  const runFiles = readdirSync(published, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.json'))
    .map((name) => `bench/published/${name}`)
    .sort();
  const site = JSON.parse(readFileSync(OUTPUT, 'utf8')) as AccuracyFile;

  it('lists every run file in bench/published, in the script and in the site data, so none is left out', () => {
    expect(runFiles.length).toBeGreaterThanOrEqual(7);
    expect([...PUBLISHED_RUNS.map((source) => source.path)].sort()).toEqual(runFiles);
    expect(site.publishedRuns.map((run) => `${run.publishedPath}/${run.runId}.json`).sort()).toEqual(runFiles);
  });

  it('feeds every matched run file into the tables, for its model and every format', () => {
    const matched = runFiles.filter((path) => /\/matched-/u.test(path));
    expect(matched.length).toBeGreaterThanOrEqual(3);
    for (const path of matched) {
      const runId = path.replace(/^.*\/|\.json$/gu, '');
      const entry = site.publishedRuns.find((run) => run.runId === runId);
      expect(entry?.inTables, runId).toEqual([{ model: entry?.models[0], formats: ['terset', 'json-compact', 'json-pretty', 'toon'] }]);
    }
  });

  it('takes no format for a model with matched runs from an older run, in the build and in the committed file', () => {
    for (const file of [buildAccuracy(freshRuns(), freshCounts()), site]) {
      const sol = modelOf(file, 'gpt-6.1-sol');
      expect(sol.runsFrom).toBe('matched-batch');
      for (const row of sol.rows) {
        expect(row.runs.map((run) => [run.runId, run.runOn]), row.format).toEqual(SOL_BATCH.map((runId) => [runId, '2026-11-17']));
      }
      for (const run of file.publishedRuns.filter((item) => !SOL_BATCH.includes(item.runId))) {
        expect(run.inTables.map((entry) => entry.model), run.runId).not.toContain('gpt-6.1-sol');
      }
    }
  });

  it('shows each score as the mean of its runs, with each run beside it', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    const scores = (id: string) => modelOf(file, id).rows.map((row) => [row.format, row.correct, row.runs.map((run) => run.correct)]);
    expect(scores('gpt-6.1-sol')).toEqual([
      ['terset', 242, [242, 241, 243]],
      ['json-compact', 706 / 3, [236, 234, 236]],
      ['json-pretty', 712 / 3, [237, 238, 237]],
      ['toon', 242, [242, 242, 242]],
    ]);
    // Opus has no matched runs yet, so it keeps the earlier runs.
    expect(modelOf(file, OPUS).runsFrom).toBe('earlier-runs');
    expect(modelOf(file, OPUS).rows.map((row) => [row.format, row.runs.map((run) => [run.runId, run.correct])])).toEqual([
      ['terset', [['fitted-rules-2026-11-17', 242], ['fitted-rules-rerun-2026-11-17', 242]]],
      ['json-compact', [['p4-2026-11-12', 241]]],
      ['json-pretty', [['p4-2026-11-12', 239]]],
      ['toon', [['p4-2026-11-12', 242]]],
    ]);
  });

  it('keeps the 2026-11-13 full-rules run as history only', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    expect(file.publishedRuns.find((run) => run.runId === 'v2-final-2026-11-13')?.inTables).toEqual([]);
  });
});

describe('the Opus matched batch, once its files land', () => {
  it('switches Opus to its three repeats for every format, with the same counted tokens as before', () => {
    const before = buildAccuracy(freshRuns(), freshCounts());
    const { runs, sources } = withOpusBatch();
    const file = buildAccuracy(runs, freshCounts(), sources);
    const opus = modelOf(file, OPUS);
    expect(opus.runsFrom).toBe('matched-batch');
    for (const row of opus.rows) {
      expect(row.runs.map((run) => run.runId), row.format).toEqual(OPUS_BATCH);
      expect(row.inputTokens, row.format).toBe(modelOf(before, OPUS).rows.find((item) => item.format === row.format)?.inputTokens);
    }
    // Every earlier run is now history.
    for (const id of ['p4-2026-11-12', 'v2-final-2026-11-13', 'fitted-rules-2026-11-17', 'fitted-rules-rerun-2026-11-17']) {
      expect(file.publishedRuns.find((run) => run.runId === id)?.inTables, id).toEqual([]);
    }
    expect(file.calls).toBe(244 * 4 * 6);
  });

  it('counts the same Claude requests as before: the older runs still lend their counts', () => {
    const { sources } = withOpusBatch();
    const counted = (list: readonly PublishedSource[]): readonly (readonly [string, readonly string[]])[] =>
      list.map((source) => [sourceRunId(source), claudeCountedFormats(list, source)] as const).filter(([, formats]) => formats.length > 0);
    const expected = [['p4-2026-11-12', ['json-compact', 'json-pretty', 'toon']], ['fitted-rules-rerun-2026-11-17', ['terset']]];
    expect(counted(PUBLISHED_RUNS)).toEqual(expected);
    expect(counted(sources)).toEqual(expected);
    for (const source of opusSources) expect(headlineFormats(sources, source, 'gpt-6.1-sol')).toEqual([]);
  });

  it('refuses the borrowed counts when an Opus request differs, or its setup does', () => {
    const request = withOpusBatch();
    const row = request.runs.at(-1)?.rows.find((entry) => entry.format === 'toon');
    if (row === undefined) throw new Error('no TOON row');
    row.reservedInputTokens += 1;
    expect(() => buildAccuracy(request.runs, freshCounts(), request.sources)).toThrow(/a request differs from p4-2026-11-12/u);
    const setup = withOpusBatch();
    const last = setup.runs.at(-1);
    if (last === undefined) throw new Error('no run');
    last.inputReservation.allowance += 1;
    expect(() => buildAccuracy(setup.runs, freshCounts(), setup.sources)).toThrow(/its Claude setup differs/u);
  });

  it('refuses repeats of one batch with different plans', () => {
    const { runs, sources } = withOpusBatch();
    const last = runs.at(-1);
    if (last === undefined) throw new Error('no run');
    last.fingerprint = 'another-plan';
    expect(() => buildAccuracy(runs, freshCounts(), sources)).toThrow(/matched batch plan/u);
  });
});

describe('matched runs', () => {
  it('refuses a matched run that holds another model too', () => {
    const runs = freshRuns();
    const p4 = runNamed(runs, 'p4-2026-11-12');
    newer(runs).models = structuredClone(p4.models);
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/a matched run must hold only gpt-6.1-sol/u);
  });

  it('keeps the two failed Sol requests that were retried, and counts them', () => {
    const runs = freshRuns();
    expect(runNamed(runs, 'matched-sol-2026-11-17-r1').failures.map((failure) => [failure.format, failure.questionId])).toEqual([['toon', 'q188'], ['json-compact', 'q194']]);
    const file = buildAccuracy(runs, freshCounts());
    expect(file.failedCalls).toBe(2);
    expect(file.publishedRuns.map((run) => [run.runId, run.failedRequests]).filter(([, failed]) => failed !== 0)).toEqual([['matched-sol-2026-11-17-r1', 2]]);
  });

  it('refuses a failed request that was never answered', () => {
    const runs = freshRuns();
    newer(runs).failures.push({ model: 'gpt-6.1-sol', format: 'toon', dataset: 'keyed', questionId: 'not-asked', status: 'failed' });
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/a failed request was never answered/u);
  });
});

describe('accuracy results', () => {
  it('keeps the committed file equal to every published run', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(accuracyText());
  });

  it('takes Sol from its matched batch and Opus from the earlier runs, with run dates and means', () => {
    const file = buildAccuracy(freshRuns(), freshCounts());
    expect(file.questions).toBe(244);
    // Opus: 244 questions in three formats once and in Terset twice. Sol: four formats three times.
    expect(file.calls).toBe(244 * 5 + 244 * 4 * 3);
    expect(file.publishedRuns.map((run) => [run.runId, run.runOn, run.inTables])).toEqual([
      ['p4-2026-11-12', '2026-11-12', [{ model: OPUS, formats: ['json-compact', 'json-pretty', 'toon'] }]],
      ['v2-final-2026-11-13', '2026-11-13', []],
      ['fitted-rules-2026-11-17', '2026-11-17', [{ model: OPUS, formats: ['terset'] }]],
      ['fitted-rules-rerun-2026-11-17', '2026-11-17', [{ model: OPUS, formats: ['terset'] }]],
      ...SOL_BATCH.map((runId) => [runId, '2026-11-17', [{ model: 'gpt-6.1-sol', formats: ['terset', 'json-compact', 'json-pretty', 'toon'] }]]),
    ]);
    const opus = file.models.find((model) => model.id === 'claude-opus-5-5');
    expect(opus?.rows.map((row) => [row.format, row.correct, row.inputTokens, row.runs.map((run) => run.runOn)])).toEqual([
      ['terset', 242, 1188659, ['2026-11-17', '2026-11-17']],
      ['json-compact', 241, 1766161, ['2026-11-12']],
      ['json-pretty', 239, 2303845, ['2026-11-12']],
      ['toon', 242, 1369764, ['2026-11-12']],
    ]);
    const sol = modelOf(file, 'gpt-6.1-sol');
    expect(sol.rows.map((row) => [row.format, row.inputTokens, row.runs.map((run) => run.runOn)])).toEqual([
      ['terset', 842260, ['2026-11-17', '2026-11-17', '2026-11-17']],
      ['json-compact', 1158229, ['2026-11-17', '2026-11-17', '2026-11-17']],
      ['json-pretty', 1696152, ['2026-11-17', '2026-11-17', '2026-11-17']],
      ['toon', 1020628, ['2026-11-17', '2026-11-17', '2026-11-17']],
    ]);
    // Output tokens and cost differ between the runs, so the row carries their mean.
    expect(sol.rows[0]?.runs.map((run) => [run.outputTokens, run.totalCost])).toEqual([[15342, 1.83794], [15968, 1.8442], [16091, 1.84543]]);
    expect(sol.rows[0]).toMatchObject({ correct: 242, inputTokens: 842260, outputTokens: 15800.333333333334 });
    expect(sol.rows[0]?.totalCost).toBeCloseTo(1.8425233333333333, 9);
    expect(sol.rows[1]?.totalCost).toBeCloseTo(2.4934213333333335, 9);
    expect(opus?.rows[0]?.totalCost).toBeCloseTo(5.638606, 9);
    // The interval is for the mean score over the 244 questions.
    expect(sol.rows[1]?.low).toBeCloseTo(wilson95(706 / 3, 244).low, 12);
  });

  it('lets a run use another run\'s Claude counts only when it sent the same requests', () => {
    const borrowing = (runs: MutableRun[]): MutableRun => runNamed(runs, 'fitted-rules-2026-11-17');
    const setup = freshRuns();
    borrowing(setup).inputReservation.margin += 1;
    expect(() => buildAccuracy(setup, freshCounts())).toThrow(/its Claude setup differs/u);
    const request = freshRuns();
    const row = borrowing(request).rows.find((entry) => entry.model === OPUS && entry.format === 'terset');
    if (row === undefined) throw new Error('no Terset row');
    row.reservedInputTokens += 1;
    expect(() => buildAccuracy(request, freshCounts())).toThrow(/a request differs/u);
  });

  it.each([
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
      // Opus: Terset from 2026-11-17, compact JSON and TOON from 2026-11-12. Sol: its matched batch.
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
    for (const run of runs) for (const row of [...run.rows, ...run.failures]) if (row.dataset === 'keyed') row.dataset = 'mystery';
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

  it('refuses a summary that differs from the raw rows in any run with Terset in the tables', () => {
    const withTerset = PUBLISHED_RUNS.filter((source) => headlineFormats(PUBLISHED_RUNS, source, OPUS).includes('terset') || headlineFormats(PUBLISHED_RUNS, source, 'gpt-6.1-sol').includes('terset'));
    expect(withTerset).toHaveLength(5);
    for (const source of withTerset) {
      const runs = freshRuns();
      const row = runNamed(runs, sourceRunId(source)).summary.find((item) => item.format === 'terset' && item.dataset === 'ALL');
      if (row === undefined) throw new Error('no summary row');
      row.metrics.correct += 1;
      expect(() => buildAccuracy(runs, freshCounts()), sourceRunId(source)).toThrow(/summary differs/u);
    }
  });

  it('refuses missing calls', () => {
    const runs = freshRuns();
    newer(runs).plannedCalls += 1;
    expect(() => buildAccuracy(runs, freshCounts())).toThrow(/planned calls/u);
    // A run planned with one question fewer is complete, but not comparable.
    newer(runs).plannedCalls -= 2;
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
    const countedAs = (runId: string, format: AccuracyFormat): string => PUBLISHED_RUNS.find((source) => sourceRunId(source) === runId)?.claudeCountsFrom?.[format] ?? runId;
    for (const row of opus?.rows ?? []) {
      for (const run of row.runs) expect(run.inputTokens, `${row.format} ${run.runId}`).toBe(countedSum(countedAs(run.runId, row.format), row.format));
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
