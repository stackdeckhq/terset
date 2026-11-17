// Writes src/data/accuracy-results.json and README tables from published runs.
//
//   pnpm accuracy
//
// The runs live in bench/published/<run date>/ as the benchmark harness wrote them.
// Every number is recomputed here from the raw rows: correct answers, Wilson 95%
// intervals, input tokens and list-price dollars, overall and per kind of data
// for input tokens. PUBLISHED_RUNS lists every run and the formats taken from it.
// A format with more than one run is shown with each run and the mean over them;
// no run is ever picked. Each run's own summary is checked against the recomputed
// figures, and any difference stops the script.
// Claude input tokens come from claude-request-counts.json: Anthropic's token count
// for each published request body. Every published Claude row needs exactly one count,
// and every count must match a published row. A run with the same plan as a counted
// run sends the same request bodies, so it uses that run's counts, after a check.
// Other tokens are as each model reported. Importing this file writes nothing; only running it does.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { ACCURACY_FORMATS, ACCURACY_KINDS, AccuracyFileSchema } from '../src/data/accuracy-schema.ts';
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel, AccuracyRow } from '../src/data/accuracy-schema.ts';
import { ClaudeRequestCountsSchema, requestCountKey } from '../src/data/claude-request-counts-schema.ts';
import type { ClaudeRequestCounts } from '../src/data/claude-request-counts-schema.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

/** One published run and the formats the site takes from it. */
export interface PublishedSource {
  readonly path: string;
  readonly formats: readonly AccuracyFormat[];
  /**
   * The run whose Claude request counts this run uses. Set only for a run with the same
   * plan fingerprint as that run, so every request body is the same and so is its count.
   */
  readonly claudeCountsFrom?: string;
}

/** Every published run, in the order the site lists them. Each format is shown with all of its runs. */
export const PUBLISHED_RUNS: readonly PublishedSource[] = [
  { path: 'bench/published/2026-11-12/p4-2026-11-12.json', formats: ['json-compact', 'json-pretty', 'toon'] },
  { path: 'bench/published/2026-11-17/fitted-rules-2026-11-17.json', formats: ['terset'], claudeCountsFrom: 'fitted-rules-rerun-2026-11-17' },
  { path: 'bench/published/2026-11-17/fitted-rules-rerun-2026-11-17.json', formats: ['terset'] },
];
export const OUTPUT = fileURLToPath(new URL('../src/data/accuracy-results.json', import.meta.url));
/** Anthropic's token count for every published Claude request. `pnpm --dir apps/site count:claude --published` writes it. */
export const REQUEST_COUNTS = fileURLToPath(new URL('../src/data/claude-request-counts.json', import.meta.url));

/** The vendor's name for each model id the run may contain. */
const MODEL_NAMES: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'gpt-6.1-sol': 'GPT 6.1 Sol',
};

const Count = z.number().int().nonnegative();
const RunRow = z.object({ model: z.string(), format: z.enum(ACCURACY_FORMATS), dataset: z.string(), questionId: z.string(), correct: z.boolean(), inputTokens: Count, outputTokens: Count, reservedInputTokens: Count });
const RunModel = z.object({
  id: z.string(),
  api: z.string(),
  temperature: z.string(),
  outputTokenParameter: z.string(),
  price: z.object({ inputPerMillion: z.number().positive(), outputPerMillion: z.number().positive(), sourceUrl: z.string(), dateRead: z.iso.date() }),
});
const RunSummary = z.object({
  model: z.string(),
  format: z.enum(ACCURACY_FORMATS),
  dataset: z.string(),
  metrics: z.object({ correct: Count, total: Count, inputTokens: Count, outputTokens: Count, totalCost: z.number(), wilson95: z.object({ lower: z.number(), upper: z.number() }).nullable() }),
});
const RunFile = z.object({
  runId: z.string(),
  fingerprint: z.string().min(1),
  mode: z.literal('http'),
  status: z.literal('complete'),
  plannedCalls: Count,
  rows: z.array(RunRow),
  failures: z.array(z.unknown()),
  models: z.array(RunModel).min(1),
  upstreamSha: z.string(),
  dataHashes: z.record(z.string(), z.string()),
  tokenizer: z.string(),
  budgets: z.object({ perCallMaxOutputTokens: Count }),
  summary: z.array(RunSummary),
});
type RunFile = z.infer<typeof RunFile>;
type RunRow = z.infer<typeof RunRow>;

/** One published run with the source entry that lists it. */
interface Published {
  readonly run: RunFile;
  readonly source: PublishedSource;
  readonly runOn: string;
}

/** The input tokens a row is published with. */
type InputFor = (row: RunRow) => number;

/**
 * Wilson score interval at 95%, the same formula the benchmark harness uses.
 * `correct` may be a mean over runs, so it may have a fraction; `total` is the question count.
 */
export function wilson95(correct: number, total: number): { readonly low: number; readonly high: number } {
  if (!Number.isFinite(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) throw new Error(`Invalid score ${String(correct)} of ${String(total)}`);
  const z = 1.959963984540054;
  const p = correct / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  // At 0 or 100% the exact bound is 0 or 1; floating point can land a hair inside it.
  return {
    low: correct === 0 ? 0 : Math.max(0, center - margin),
    high: correct === total ? 1 : Math.min(1, center + margin),
  };
}

const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

const mean = (values: readonly number[]): number => {
  if (values.length === 0) throw new Error('No values to average');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

/** The run's dataset names in each kind of data. Every dataset in the run must appear here exactly once. */
export const KIND_DATASETS: Readonly<Record<AccuracyKindId, readonly string[]>> = {
  tabular: ['tabular'],
  analytics: ['analytics'],
  github: ['github'],
  'event-logs': ['event-logs'],
  nested: ['nested'],
  'nested-group': ['nested-group'],
  keyed: ['keyed'],
  'nested-config': ['nested-config'],
  'structure-control': ['structural-validation-control'],
  'structure-truncated': ['structural-validation-truncated'],
  'structure-extra-rows': ['structural-validation-extra-rows'],
  'structure-width-mismatch': ['structural-validation-width-mismatch'],
  'structure-missing-fields': ['structural-validation-missing-fields'],
};

/**
 * Input tokens per kind of data, model and format: summed over the rows of each run
 * the format is published from, then the mean over those runs. `runsFor` returns one
 * row list per run for one format, with the input tokens it is published with.
 */
function kindRows(models: RunFile['models'], runsFor: (format: AccuracyFormat) => readonly RunFile['rows'][]): AccuracyKind[] {
  const grouped = Object.values(KIND_DATASETS).flat();
  for (const format of ACCURACY_FORMATS) {
    for (const rows of runsFor(format)) {
      const inRun = [...new Set(rows.map((row) => row.dataset))];
      const unknown = inRun.filter((dataset) => !grouped.includes(dataset));
      if (unknown.length > 0) throw new Error(`No kind of data for dataset ${unknown.join(', ')}`);
      const missing = grouped.filter((dataset) => !inRun.includes(dataset));
      if (missing.length > 0) throw new Error(`The ${format} rows have no dataset ${missing.join(', ')}`);
    }
  }
  return ACCURACY_KINDS.map((kind): AccuracyKind => {
    const datasets = KIND_DATASETS[kind];
    const inKind = (rows: RunFile['rows']): RunFile['rows'] => rows.filter((row) => datasets.includes(row.dataset));
    const [compact] = runsFor('json-compact');
    if (compact === undefined) throw new Error('No compact JSON run');
    const questions = new Set(inKind(compact).map((row) => `${row.dataset}/${row.questionId}`)).size;
    return {
      kind,
      datasets: [...datasets],
      questions,
      models: models.map((model) => {
        const tokens = (format: AccuracyFormat): number => mean(runsFor(format).map((rows) => {
          const own = inKind(rows).filter((row) => row.model === model.id);
          if (own.length !== questions) throw new Error(`${model.id} ${format} ${kind}: ${String(own.length)} answers for ${String(questions)} questions`);
          return own.reduce((sum, row) => sum + row.inputTokens, 0);
        }));
        return { id: model.id, inputTokens: { terset: tokens('terset'), 'json-compact': tokens('json-compact'), 'json-pretty': tokens('json-pretty'), toon: tokens('toon') } };
      }),
    };
  });
}

/**
 * The input tokens each published row is published with: the request count for the
 * counted Claude model, the reported tokens for everything else. A run with
 * `claudeCountsFrom` looks its counts up under that run's id. `assertAllUsed`
 * throws when a count matched no published row.
 */
function inputCounts(counts: ClaudeRequestCounts): { readonly inputFor: (item: Published) => InputFor; readonly assertAllUsed: () => void } {
  const byKey = new Map(counts.rows.map((row) => [requestCountKey(row), row.inputTokens]));
  const used = new Set<string>();
  return {
    inputFor: ({ run, source }) => (row) => {
      if (row.model !== counts.model || !source.formats.includes(row.format)) return row.inputTokens;
      const key = requestCountKey({ runId: source.claudeCountsFrom ?? run.runId, format: row.format, dataset: row.dataset, questionId: row.questionId });
      const counted = byKey.get(key);
      if (counted === undefined) throw new Error(`No request count for ${key}`);
      used.add(key);
      return counted;
    },
    assertAllUsed: () => {
      if (used.size !== byKey.size) throw new Error(`${String(byKey.size - used.size)} request counts match no published request`);
    },
  };
}

/**
 * A run that uses another run's Claude counts must have sent the same requests: the same
 * plan fingerprint, and the same recorded and reserved input tokens on every published row.
 */
function assertSameRequests(item: Published, all: readonly Published[]): void {
  const from = item.source.claudeCountsFrom;
  if (from === undefined) return;
  const counted = all.find((other) => other.run.runId === from);
  if (counted === undefined) throw new Error(`${item.run.runId}: takes Claude counts from ${from}, which is not published`);
  if (counted.source.claudeCountsFrom !== undefined) throw new Error(`${item.run.runId}: ${from} has no counts of its own`);
  if (item.run.fingerprint !== counted.run.fingerprint) throw new Error(`${item.run.runId}: its plan differs from ${from}, so it cannot use its Claude counts`);
  const key = (row: RunRow): string => JSON.stringify([row.model, row.format, row.dataset, row.questionId]);
  const theirs = new Map(counted.run.rows.map((row) => [key(row), row]));
  for (const row of item.run.rows.filter((entry) => item.source.formats.includes(entry.format))) {
    const other = theirs.get(key(row));
    if (other?.inputTokens !== row.inputTokens || other.reservedInputTokens !== row.reservedInputTokens) {
      throw new Error(`${item.run.runId}: a request differs from ${from}, so it cannot use its Claude counts`);
    }
  }
}

/** One run of one format on one model, recomputed from its rows and checked against its summary. */
interface RunScore {
  readonly format: AccuracyFormat;
  readonly runId: string;
  readonly runOn: string;
  readonly correct: number;
  readonly total: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalCost: number;
}

function runScores(item: Published, model: RunFile['models'][number], inputFor: InputFor): RunScore[] {
  const { run } = item;
  const mine = run.rows.filter((row) => row.model === model.id);
  const formats = ACCURACY_FORMATS.filter((format) => mine.some((row) => row.format === format));
  const questionSets = formats.map((format) => questionSet(mine.filter((row) => row.format === format)));
  if (new Set(questionSets).size !== 1) throw new Error(`${model.id}: formats did not answer the same questions`);
  return formats.map((format: AccuracyFormat): RunScore => {
    const rows = mine.filter((row) => row.format === format);
    if (new Set(rows.map((row) => row.questionId)).size !== rows.length) throw new Error(`${model.id} ${format}: a question was answered twice`);
    const correct = rows.filter((row) => row.correct).length;
    const outputTokens = rows.reduce((sum, row) => sum + row.outputTokens, 0);
    const cost = (input: number): number => (input * model.price.inputPerMillion + outputTokens * model.price.outputPerMillion) / 1_000_000;
    // The run's summary is checked against the tokens the run recorded.
    const reportedInput = rows.reduce((sum, row) => sum + row.inputTokens, 0);
    const { low, high } = wilson95(correct, rows.length);
    const summary = run.summary.find((entry) => entry.model === model.id && entry.format === format && entry.dataset === 'ALL');
    if (summary === undefined) throw new Error(`${model.id} ${format}: the run has no overall summary row`);
    const m = summary.metrics;
    const agrees = m.correct === correct && m.total === rows.length && m.inputTokens === reportedInput && m.outputTokens === outputTokens && close(m.totalCost, cost(reportedInput)) && m.wilson95 !== null && close(m.wilson95.lower, low) && close(m.wilson95.upper, high);
    if (!agrees) throw new Error(`${model.id} ${format}: the run's summary differs from the figures recomputed from its rows`);
    const inputTokens = rows.reduce((sum, row) => sum + inputFor(row), 0);
    return { format, runId: run.runId, runOn: item.runOn, correct, total: rows.length, inputTokens, outputTokens, totalCost: cost(inputTokens) };
  });
}

/** One format's row: every run of it, then the mean over them, with the interval of the mean score. */
function meanRow(format: AccuracyFormat, scores: readonly RunScore[]): AccuracyRow {
  const [first] = scores;
  if (first === undefined) throw new Error(`No published run holds ${format}`);
  if (scores.some((score) => score.total !== first.total)) throw new Error(`${format}: runs answered different numbers of questions`);
  const correct = mean(scores.map((score) => score.correct));
  const { low, high } = wilson95(correct, first.total);
  return {
    format,
    runs: scores.map(({ runId, runOn, correct: right, inputTokens, outputTokens, totalCost }) => ({ runId, runOn, correct: right, inputTokens, outputTokens, totalCost })),
    correct,
    total: first.total,
    low,
    high,
    inputTokens: mean(scores.map((score) => score.inputTokens)),
    outputTokens: mean(scores.map((score) => score.outputTokens)),
    totalCost: mean(scores.map((score) => score.totalCost)),
  };
}

function questionSet(rows: RunFile['rows']): string {
  return JSON.stringify(rows.map((row) => [row.dataset, row.questionId]).sort());
}

function equalField(a: unknown, b: unknown, field: string): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Published runs differ in ${field}`);
}

/** Combines every published run of every format after checking that all runs are comparable. */
export function buildAccuracy(rawRuns: readonly unknown[], rawCounts: unknown): AccuracyFile {
  if (rawRuns.length !== PUBLISHED_RUNS.length) throw new Error('Expected every published run');
  const published = rawRuns.map((raw, index): Published => {
    const source = PUBLISHED_RUNS[index];
    if (source === undefined) throw new Error('Missing published source');
    return { run: RunFile.parse(raw), source, runOn: basename(dirname(source.path)) };
  });
  const run = published[0]?.run;
  if (run === undefined) throw new Error('No published runs');
  if (new Set(published.map((item) => item.run.runId)).size !== published.length) throw new Error('A run is published twice');
  const counts = ClaudeRequestCountsSchema.parse(rawCounts);
  if (run.models.find((model) => model.id === counts.model)?.api !== 'anthropic') throw new Error(`The request counts are for ${counts.model}, which is not a Claude model in the runs`);
  const { inputFor, assertAllUsed } = inputCounts(counts);
  for (const { run: candidate } of published) {
    equalField(candidate.models, run.models, 'models and prices (including API, temperature and output token parameter)');
    equalField(Object.entries(candidate.dataHashes).sort(), Object.entries(run.dataHashes).sort(), 'data hashes');
    equalField(candidate.upstreamSha, run.upstreamSha, 'upstream commit');
    equalField(candidate.tokenizer, run.tokenizer, 'tokenizer');
    equalField(candidate.budgets.perCallMaxOutputTokens, run.budgets.perCallMaxOutputTokens, 'per-call output cap');
    if (candidate.rows.some((row) => !candidate.models.some((model) => model.id === row.model))) throw new Error('Unknown row model');
    for (const model of candidate.models) {
      const formats = new Set(candidate.rows.filter((row) => row.model === model.id).map((row) => row.format));
      for (const format of formats) {
        equalField(questionSet(candidate.rows.filter((row) => row.model === model.id && row.format === format)), questionSet(run.rows.filter((row) => row.model === run.models[0]?.id && row.format === 'json-compact')), 'question set');
      }
    }
    validateRun(candidate);
  }
  for (const item of published) assertSameRequests(item, published);
  for (const format of ACCURACY_FORMATS) {
    if (!published.some((item) => item.source.formats.includes(format))) throw new Error(`No published run is selected for ${format}`);
  }
  const models = run.models.map((model): AccuracyModel => {
    const name = MODEL_NAMES[model.id];
    if (name === undefined) throw new Error(`No display name for model ${model.id}`);
    const scores = published.flatMap((item) => {
      const ownModel = item.run.models.find((entry) => entry.id === model.id);
      if (ownModel === undefined) throw new Error('Missing published model');
      return runScores(item, ownModel, inputFor(item)).filter((score) => item.source.formats.includes(score.format));
    });
    return {
      id: model.id, name,
      inputTokensFrom: model.id === counts.model ? 'anthropic-token-count' : 'model-report',
      inputPerMillion: model.price.inputPerMillion,
      outputPerMillion: model.price.outputPerMillion,
      priceSource: model.price.sourceUrl,
      priceReadOn: model.price.dateRead,
      rows: ACCURACY_FORMATS.map((format) => meanRow(format, scores.filter((score) => score.format === format))),
    };
  });
  const kinds = kindRows(run.models, (format) => published
    .filter((item) => item.source.formats.includes(format))
    .map((item) => {
      const input = inputFor(item);
      return item.run.rows.filter((row) => row.format === format).map((row) => ({ ...row, inputTokens: input(row) }));
    }));
  assertAllUsed();
  return AccuracyFileSchema.parse({
    publishedRuns: published.map(({ run: item, source, runOn }) => ({ runId: item.runId, runOn, publishedPath: dirname(source.path), formats: [...source.formats] })),
    upstreamSha: run.upstreamSha,
    questions: models[0]?.rows[0]?.total,
    datasets: new Set(run.rows.map((row) => row.dataset)).size,
    calls: models.flatMap((model) => model.rows).reduce((sum, row) => sum + row.total * row.runs.length, 0),
    failedCalls: 0,
    models,
    kinds,
  });
}

function validateRun(run: RunFile): void {
  if (run.failures.length > 0) throw new Error('The run recorded failed calls');
  if (run.rows.length !== run.plannedCalls) throw new Error(`The run recorded ${String(run.rows.length)} of ${String(run.plannedCalls)} planned calls`);
  if (new Set(run.models.map((model) => model.id)).size !== run.models.length) throw new Error('Duplicate model id');
}

/** The file `pnpm accuracy` writes, as text. */
export function accuracyText(): string {
  const runs: unknown[] = PUBLISHED_RUNS.map((source) => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')) as unknown);
  const counts: unknown = JSON.parse(readFileSync(REQUEST_COUNTS, 'utf8'));
  return `${JSON.stringify(buildAccuracy(runs, counts), null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUTPUT, accuracyText());
  const { ACCURACY, accuracyReadmeBlock } = await import('../src/data/accuracy.ts');
  for (const path of ['README.md', 'packages/terset/README.md', 'packages/terset-py/README.md']) {
    const text = readFileSync(`${REPO}${path}`, 'utf8');
    if (!text.includes('### Answer accuracy')) continue;
    const updated = text.replace(/### Answer accuracy\n[\s\S]*?(?=\n## |\n### |$)/u, `${accuracyReadmeBlock(ACCURACY)}\n`);
    writeFileSync(`${REPO}${path}`, updated);
  }
  console.log(`Updated accuracy data and README tables from all ${String(PUBLISHED_RUNS.length)} published runs.`);
}
