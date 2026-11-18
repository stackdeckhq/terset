// Writes src/data/accuracy-results.json and README tables from published runs.
//
//   pnpm accuracy
//
// The runs live in bench/published/<run date>/ as the benchmark harness wrote them.
// Every number is recomputed here from the raw rows: correct answers, Wilson 95%
// intervals, input tokens and list-price dollars, overall and per kind of data
// for input tokens. PUBLISHED_RUNS lists every TOON-suite run. Each model takes every format from
// its matched batch's repeats. Every other run is history. Each format is shown with each
// run and the mean over them; no run is ever picked. Each run's own
// summary is checked against the recomputed figures, and any difference stops the script.
// Claude input tokens come from claude-request-counts.json: Anthropic's token count
// for each published request body. Every published Claude row needs exactly one count,
// and every count must match a published row. A run that sent the same request bodies as
// a counted run uses that run's counts, after a check of every row.
// Other tokens are as each model reported. Importing this file writes nothing; only running it does.
// STRESS_PUBLISHED_RUNS feeds a separate file and README block, one measured run per model.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACCURACY_FORMATS, ACCURACY_KINDS, AccuracyFileSchema } from '../src/data/accuracy-schema.ts';
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel, AccuracyRow } from '../src/data/accuracy-schema.ts';
import { ClaudeRequestCountsSchema, requestCountKey } from '../src/data/claude-request-counts-schema.ts';
import type { ClaudeRequestCounts } from '../src/data/claude-request-counts-schema.ts';
import { StressAccuracyFileSchema } from '../src/data/accuracy-stress-schema.ts';
import { RunFile, equalField, questionSet, runScores, validateRun, wilson95 } from './accuracy-runs.ts';
import type { InputFor, RunRow, RunScore } from './accuracy-runs.ts';
import { STRESS_OUTPUT, STRESS_PUBLISHED_RUNS, stressAccuracyText, updateStressReadme } from './accuracy-stress.ts';

export { wilson95 };

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

/** Every model the published runs may hold, in the order the site shows them. */
export const MODELS = ['claude-opus-5-5', 'gpt-6.1-sol'] as const;
export type ModelId = (typeof MODELS)[number];

/** The vendor's name for each model. */
const MODEL_NAMES: Readonly<Record<ModelId, string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'gpt-6.1-sol': 'GPT 6.1 Sol',
};

/** The model whose input tokens come from Anthropic's token count of each request body. */
export const COUNTED_MODEL: ModelId = 'claude-opus-5-5';

/**
 * Per format, the run whose Claude request counts a run uses instead of its own. A run may
 * use them only when it sent the same request bodies, which the script checks row by row.
 */
export type CountsFrom = Readonly<Partial<Record<AccuracyFormat, string>>>;

/**
 * A run from a matched batch: one model, every format, the same day and setup as the
 * other repeats of that batch. The tables take every format for its model from these runs.
 */
export interface MatchedSource {
  readonly kind: 'matched';
  readonly path: string;
  readonly model: ModelId;
  readonly claudeCountsFrom?: CountsFrom;
}

/**
 * A run from before the matched batches. The tables take nothing from it, though it may
 * lend its Claude counts to a matched run that sent the same requests.
 */
export interface HistorySource {
  readonly kind: 'history';
  readonly path: string;
}

export type PublishedSource = MatchedSource | HistorySource;

/** The run whose Claude counts this run uses for a format, if it borrows them. */
export function borrowedCountsFrom(source: PublishedSource, format: AccuracyFormat): string | undefined {
  return source.kind === 'matched' ? source.claudeCountsFrom?.[format] : undefined;
}

/**
 * The Opus matched runs ran at the same commit as these runs and sent the same request
 * bodies, so they use their counts. The script checks every row before it does.
 */
export const OPUS_COUNTS_FROM: CountsFrom = {
  'json-compact': 'p4-2026-11-12',
  'json-pretty': 'p4-2026-11-12',
  toon: 'p4-2026-11-12',
  terset: 'fitted-rules-rerun-2026-11-17',
};

/** Every published TOON-suite run, in the order the site lists them. */
export const PUBLISHED_RUNS: readonly PublishedSource[] = [
  { kind: 'history', path: 'bench/published/2026-11-12/p4-2026-11-12.json' },
  { kind: 'history', path: 'bench/published/2026-11-13/v2-final-2026-11-13.json' },
  { kind: 'history', path: 'bench/published/2026-11-17/fitted-rules-2026-11-17.json' },
  { kind: 'history', path: 'bench/published/2026-11-17/fitted-rules-rerun-2026-11-17.json' },
  { kind: 'matched', path: 'bench/published/2026-11-17/matched-sol-2026-11-17-r1.json', model: 'gpt-6.1-sol' },
  { kind: 'matched', path: 'bench/published/2026-11-17/matched-sol-2026-11-17-r2.json', model: 'gpt-6.1-sol' },
  { kind: 'matched', path: 'bench/published/2026-11-17/matched-sol-2026-11-17-r3.json', model: 'gpt-6.1-sol' },
  { kind: 'matched', path: 'bench/published/2026-11-17/matched-opus-2026-11-17-r1.json', model: 'claude-opus-5-5', claudeCountsFrom: OPUS_COUNTS_FROM },
  { kind: 'matched', path: 'bench/published/2026-11-17/matched-opus-2026-11-17-r2.json', model: 'claude-opus-5-5', claudeCountsFrom: OPUS_COUNTS_FROM },
  { kind: 'matched', path: 'bench/published/2026-11-17/matched-opus-2026-11-17-r3.json', model: 'claude-opus-5-5', claudeCountsFrom: OPUS_COUNTS_FROM },
];
export const OUTPUT = fileURLToPath(new URL('../src/data/accuracy-results.json', import.meta.url));
/** Anthropic's token count for every published Claude request. `pnpm --dir apps/site count:claude --published` writes it. */
export const REQUEST_COUNTS = fileURLToPath(new URL('../src/data/claude-request-counts.json', import.meta.url));

/** The run id a source's file holds: its file name without `.json`. */
export function sourceRunId(source: PublishedSource): string {
  return basename(source.path, '.json');
}

/** The formats the tables take from this run for this model: all of them from its own matched runs, else none. */
export function headlineFormats(source: PublishedSource, model: ModelId): readonly AccuracyFormat[] {
  return source.kind === 'matched' && source.model === model ? ACCURACY_FORMATS : [];
}

/**
 * The formats whose Claude requests in this run need their own count: those the tables take
 * from it for the counted model, and those another run takes counts from, minus those this
 * run takes from another run.
 */
export function claudeCountedFormats(sources: readonly PublishedSource[], source: PublishedSource): readonly AccuracyFormat[] {
  const runId = sourceRunId(source);
  const shown = headlineFormats(source, COUNTED_MODEL);
  const lent = sources.flatMap((other) => ACCURACY_FORMATS.filter((format) => headlineFormats(other, COUNTED_MODEL).includes(format) && borrowedCountsFrom(other, format) === runId));
  return ACCURACY_FORMATS.filter((format) => (shown.includes(format) || lent.includes(format)) && borrowedCountsFrom(source, format) === undefined);
}

/** One published run with the source entry that lists it. */
interface Published {
  readonly run: RunFile;
  readonly source: PublishedSource;
  readonly runOn: string;
  /** The formats the tables take from this run, per model. */
  readonly shown: Readonly<Record<ModelId, readonly AccuracyFormat[]>>;
}

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
 * the tables take that format from for that model, then the mean over those runs.
 * `runsFor` returns one row list per run, holding only that model and format, with the
 * input tokens each row is published with.
 */
function kindRows(models: readonly ModelId[], runsFor: (model: ModelId, format: AccuracyFormat) => readonly RunFile['rows'][]): AccuracyKind[] {
  const grouped = Object.values(KIND_DATASETS).flat();
  for (const model of models) {
    for (const format of ACCURACY_FORMATS) {
      for (const rows of runsFor(model, format)) {
        const inRun = [...new Set(rows.map((row) => row.dataset))];
        const unknown = inRun.filter((dataset) => !grouped.includes(dataset));
        if (unknown.length > 0) throw new Error(`No kind of data for dataset ${unknown.join(', ')}`);
        const missing = grouped.filter((dataset) => !inRun.includes(dataset));
        if (missing.length > 0) throw new Error(`The ${model} ${format} rows have no dataset ${missing.join(', ')}`);
      }
    }
  }
  const [firstModel] = models;
  if (firstModel === undefined) throw new Error('No models');
  return ACCURACY_KINDS.map((kind): AccuracyKind => {
    const datasets = KIND_DATASETS[kind];
    const inKind = (rows: RunFile['rows']): RunFile['rows'] => rows.filter((row) => datasets.includes(row.dataset));
    const [compact] = runsFor(firstModel, 'json-compact');
    if (compact === undefined) throw new Error('No compact JSON run');
    const questions = new Set(inKind(compact).map((row) => `${row.dataset}/${row.questionId}`)).size;
    return {
      kind,
      datasets: [...datasets],
      questions,
      models: models.map((model) => {
        const tokens = (format: AccuracyFormat): number => mean(runsFor(model, format).map((rows) => {
          const own = inKind(rows);
          if (own.length !== questions) throw new Error(`${model} ${format} ${kind}: ${String(own.length)} answers for ${String(questions)} questions`);
          return own.reduce((sum, row) => sum + row.inputTokens, 0);
        }));
        return { id: model, inputTokens: { terset: tokens('terset'), 'json-compact': tokens('json-compact'), 'json-pretty': tokens('json-pretty'), toon: tokens('toon') } };
      }),
    };
  });
}

/**
 * The input tokens each shown row is published with: the request count for the counted
 * Claude model, the reported tokens for everything else. A format with `claudeCountsFrom`
 * looks its counts up under that run's id. `assertAllUsed` throws when a count matched no
 * shown row.
 */
function inputCounts(counts: ClaudeRequestCounts): { readonly inputFor: (item: Published) => InputFor; readonly assertAllUsed: () => void } {
  const byKey = new Map(counts.rows.map((row) => [requestCountKey(row), row.inputTokens]));
  const used = new Set<string>();
  return {
    inputFor: ({ run, source }) => (row) => {
      if (row.model !== counts.model) return row.inputTokens;
      const key = requestCountKey({ runId: borrowedCountsFrom(source, row.format) ?? run.runId, format: row.format, dataset: row.dataset, questionId: row.questionId });
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
 * A run that uses another run's Claude counts for a shown format must have sent the same
 * requests: the same Claude model and input reservation setup, and the same recorded and
 * reserved input tokens on every row of that format, from the same frozen data, upstream
 * commit and tokenizer. The plan fingerprint may differ, since
 * it covers every model in the run. A run that lends counts must have counts of its own.
 */
function assertSameRequests(item: Published, all: readonly Published[]): void {
  for (const format of item.shown[COUNTED_MODEL]) {
    const from = borrowedCountsFrom(item.source, format);
    if (from === undefined) continue;
    const counted = all.find((other) => other.run.runId === from);
    if (counted === undefined) throw new Error(`${item.run.runId}: takes Claude counts from ${from}, which is not published`);
    if (borrowedCountsFrom(counted.source, format) !== undefined) throw new Error(`${item.run.runId}: ${from} has no ${format} counts of its own`);
    const setup = (run: RunFile): string => JSON.stringify([run.models.find((model) => model.id === COUNTED_MODEL)?.api, run.inputReservation]);
    if (setup(item.run) !== setup(counted.run) || !counted.run.models.some((model) => model.id === COUNTED_MODEL)) {
      throw new Error(`${item.run.runId}: its Claude setup differs from ${from}, so it cannot use its Claude counts`);
    }
    // The lending run may be history only, so the check across table runs does not cover it.
    const data = (run: RunFile): string => JSON.stringify([Object.entries(run.dataHashes).sort(), run.upstreamSha, run.tokenizer]);
    if (data(item.run) !== data(counted.run)) {
      throw new Error(`${item.run.runId}: its source data differs from ${from}, so it cannot use its Claude counts`);
    }
    const key = (row: RunRow): string => JSON.stringify([row.dataset, row.questionId]);
    const ofFormat = (run: RunFile): RunRow[] => run.rows.filter((row) => row.model === COUNTED_MODEL && row.format === format);
    const theirs = new Map(ofFormat(counted.run).map((row) => [key(row), row]));
    const mine = ofFormat(item.run);
    if (mine.length !== theirs.size) throw new Error(`${item.run.runId}: a request differs from ${from}, so it cannot use its Claude counts`);
    for (const row of mine) {
      const other = theirs.get(key(row));
      if (other?.inputTokens !== row.inputTokens || other.reservedInputTokens !== row.reservedInputTokens) {
        throw new Error(`${item.run.runId}: a request differs from ${from}, so it cannot use its Claude counts`);
      }
    }
  }
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

function isModelId(id: string): id is ModelId {
  return MODELS.some((model) => model === id);
}

function modelIn(run: RunFile, model: ModelId): RunFile['models'][number] {
  const found = run.models.find((entry) => entry.id === model);
  if (found === undefined) throw new Error(`${run.runId}: the run has no ${model}`);
  return found;
}

/**
 * Combines the published runs after checking that every run the tables use is comparable.
 * `sources` lists the runs in the same order as `rawRuns`; tests pass their own list.
 */
export function buildAccuracy(rawRuns: readonly unknown[], rawCounts: unknown, sources: readonly PublishedSource[] = PUBLISHED_RUNS): AccuracyFile {
  if (rawRuns.length !== sources.length) throw new Error('Expected every published run');
  const published = rawRuns.map((raw, index): Published => {
    const source = sources[index];
    if (source === undefined) throw new Error('Missing published source');
    const run = RunFile.parse(raw);
    if (run.runId !== sourceRunId(source)) throw new Error(`${source.path} holds run ${run.runId}, not ${sourceRunId(source)}`);
    validateRun(run, MODELS);
    if (source.kind === 'matched' && (run.models.length !== 1 || run.models[0]?.id !== source.model)) {
      throw new Error(`${run.runId}: a matched run must hold only ${source.model}, and it holds ${run.models.map((model) => model.id).join(', ')}`);
    }
    const shown: Record<ModelId, readonly AccuracyFormat[]> = {
      'claude-opus-5-5': headlineFormats(source, 'claude-opus-5-5'),
      'gpt-6.1-sol': headlineFormats(source, 'gpt-6.1-sol'),
    };
    return { run, source, runOn: basename(dirname(source.path)), shown };
  });
  if (new Set(published.map((item) => item.run.runId)).size !== published.length) throw new Error('A run is published twice');
  const used = published.filter((item) => MODELS.some((model) => item.shown[model].length > 0));
  const reference = used[0]?.run;
  if (reference === undefined) throw new Error('No published run feeds the tables');
  const referenceQuestions = questionSet(reference.rows.filter((row) => row.model === reference.models[0]?.id && row.format === 'json-compact'));
  for (const { run, shown } of used) {
    equalField(Object.entries(run.dataHashes).sort(), Object.entries(reference.dataHashes).sort(), 'data hashes');
    equalField(run.upstreamSha, reference.upstreamSha, 'upstream commit');
    equalField(run.tokenizer, reference.tokenizer, 'tokenizer');
    equalField(run.budgets.perCallMaxOutputTokens, reference.budgets.perCallMaxOutputTokens, 'per-call output cap');
    for (const model of MODELS) {
      for (const format of shown[model]) equalField(questionSet(run.rows.filter((row) => row.model === model && row.format === format)), referenceQuestions, 'question set');
    }
  }
  for (const model of MODELS) {
    const runs = used.filter((item) => item.shown[model].length > 0);
    const [first] = runs;
    if (first === undefined) throw new Error(`No published run feeds the ${model} tables`);
    for (const item of runs) equalField(modelIn(item.run, model), modelIn(first.run, model), `${model} settings and prices (including API, temperature and output token parameter)`);
    for (const format of ACCURACY_FORMATS) {
      if (!runs.some((item) => item.shown[model].includes(format))) throw new Error(`No published run is selected for ${model} ${format}`);
    }
    // A batch is run together: one plan and one day.
    equalField(new Set(runs.map((item) => item.run.fingerprint)).size, 1, `${model} matched batch plan`);
    equalField(new Set(runs.map((item) => item.runOn)).size, 1, `${model} matched batch date`);
  }
  const counts = ClaudeRequestCountsSchema.parse(rawCounts);
  const countedRun = used.find((item) => item.shown[COUNTED_MODEL].length > 0)?.run ?? reference;
  if (counts.model !== COUNTED_MODEL || modelIn(countedRun, COUNTED_MODEL).api !== 'anthropic') throw new Error(`The request counts are for ${counts.model}, which is not a Claude model in the runs`);
  const { inputFor, assertAllUsed } = inputCounts(counts);
  for (const item of used) assertSameRequests(item, published);
  const models = MODELS.map((model): AccuracyModel => {
    const runs = used.filter((item) => item.shown[model].length > 0);
    const scores = runs.flatMap((item) => runScores(item, modelIn(item.run, model), item.shown[model], inputFor(item)));
    const settings = modelIn(runs[0]?.run ?? reference, model);
    return {
      id: model, name: MODEL_NAMES[model],
      inputTokensFrom: model === counts.model ? 'anthropic-token-count' : 'model-report',
      inputPerMillion: settings.price.inputPerMillion,
      outputPerMillion: settings.price.outputPerMillion,
      priceSource: settings.price.sourceUrl,
      priceReadOn: settings.price.dateRead,
      rows: ACCURACY_FORMATS.map((format) => meanRow(format, scores.filter((score) => score.format === format))),
    };
  });
  const kinds = kindRows(MODELS, (model, format) => used
    .filter((item) => item.shown[model].includes(format))
    .map((item) => {
      const input = inputFor(item);
      return item.run.rows.filter((row) => row.model === model && row.format === format).map((row) => ({ ...row, inputTokens: input(row) }));
    }));
  assertAllUsed();
  const shownFailures = (item: Published): number => item.run.failures.filter((failure) => isModelId(failure.model) && item.shown[failure.model].includes(failure.format)).length;
  return AccuracyFileSchema.parse({
    publishedRuns: published.map((item) => ({
      runId: item.run.runId,
      runOn: item.runOn,
      publishedPath: dirname(item.source.path),
      models: item.run.models.map((model) => model.id),
      formats: ACCURACY_FORMATS.filter((format) => item.run.rows.some((row) => row.format === format)),
      failedRequests: item.run.failures.length,
      inTables: MODELS.filter((model) => item.shown[model].length > 0).map((model) => ({ model, formats: [...item.shown[model]] })),
    })),
    upstreamSha: reference.upstreamSha,
    questions: models[0]?.rows[0]?.total,
    datasets: new Set(reference.rows.map((row) => row.dataset)).size,
    calls: models.flatMap((model) => model.rows).reduce((sum, row) => sum + row.total * row.runs.length, 0),
    failedCalls: used.reduce((sum, item) => sum + shownFailures(item), 0),
    models,
    kinds,
  });
}

/** The file `pnpm accuracy` writes, as text. */
export function accuracyText(): string {
  const runs: unknown[] = PUBLISHED_RUNS.map((source) => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')) as unknown);
  const counts: unknown = JSON.parse(readFileSync(REQUEST_COUNTS, 'utf8'));
  return `${JSON.stringify(buildAccuracy(runs, counts), null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUTPUT, accuracyText());
  const stressText = stressAccuracyText();
  writeFileSync(STRESS_OUTPUT, stressText);
  const stress = StressAccuracyFileSchema.parse(JSON.parse(stressText));
  const { ACCURACY, accuracyReadmeBlock } = await import('../src/data/accuracy.ts');
  for (const path of ['README.md', 'packages/terset/README.md', 'packages/terset-py/README.md']) {
    const text = readFileSync(`${REPO}${path}`, 'utf8');
    if (!text.includes('### Answer accuracy')) continue;
    const updated = text.replace(/### Answer accuracy\n[\s\S]*?(?=\n## |\n### |$)/u, `${accuracyReadmeBlock(ACCURACY)}\n`);
    writeFileSync(`${REPO}${path}`, updateStressReadme(updated, stress));
  }
  console.log(`Updated accuracy data and README tables from ${String(PUBLISHED_RUNS.length)} TOON runs and ${String(STRESS_PUBLISHED_RUNS.length)} stress runs.`);
}
