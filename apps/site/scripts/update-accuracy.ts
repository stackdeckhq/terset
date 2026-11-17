// Writes src/data/accuracy-results.json and README tables from published runs.
//
//   pnpm accuracy
//
// The run lives in bench/published/<run date>/ as the benchmark harness wrote it.
// Every number is recomputed here from the raw rows: correct answers, Wilson 95%
// intervals, input tokens and list-price dollars, overall and per kind of data
// for input tokens. Each format comes from the run PUBLISHED_RUNS selects it from.
// The run's own summary is then checked against the recomputed figures, and any
// difference stops the script.
// Claude input tokens come from claude-request-counts.json: Anthropic's token count
// for each published request body. Every selected Claude row needs exactly one count,
// and every count must match a selected row. Other tokens are as each model reported.
// Importing this file writes nothing; only running it does.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { ACCURACY_FORMATS, ACCURACY_KINDS, AccuracyFileSchema } from '../src/data/accuracy-schema.ts';
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel, AccuracyRow } from '../src/data/accuracy-schema.ts';
import { ClaudeRequestCountsSchema, requestCountKey } from '../src/data/claude-request-counts-schema.ts';
import type { ClaudeRequestCounts } from '../src/data/claude-request-counts-schema.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
export const PUBLISHED_RUNS = [
  { path: 'bench/published/2026-11-12/p4-2026-11-12.json', formats: ['json-compact', 'json-pretty', 'toon'] },
  { path: 'bench/published/2026-11-17/fitted-rules-rerun-2026-11-17.json', formats: ['terset'] },
] as const;
export const OUTPUT = fileURLToPath(new URL('../src/data/accuracy-results.json', import.meta.url));
/** Anthropic's token count for every published Claude request. `pnpm --dir apps/site count:claude --published` writes it. */
export const REQUEST_COUNTS = fileURLToPath(new URL('../src/data/claude-request-counts.json', import.meta.url));

/** The vendor's name for each model id the run may contain. */
const MODEL_NAMES: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'gpt-6.1-sol': 'GPT 6.1 Sol',
};

const Count = z.number().int().nonnegative();
const RunRow = z.object({ model: z.string(), format: z.enum(ACCURACY_FORMATS), dataset: z.string(), questionId: z.string(), correct: z.boolean(), inputTokens: Count, outputTokens: Count });
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

/** The input tokens a row is published with. */
type InputFor = (row: RunRow) => number;

/** Wilson score interval at 95%, the same formula the benchmark harness uses. */
export function wilson95(correct: number, total: number): { readonly low: number; readonly high: number } {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) throw new Error(`Invalid score ${String(correct)} of ${String(total)}`);
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
 * Input tokens per kind of data, model and format, summed over the rows of the run
 * each format is selected from. `rowsFor` returns those rows for one format.
 */
function kindRows(models: RunFile['models'], rowsFor: (format: AccuracyFormat) => RunFile['rows']): AccuracyKind[] {
  const grouped = Object.values(KIND_DATASETS).flat();
  for (const format of ACCURACY_FORMATS) {
    const inRun = [...new Set(rowsFor(format).map((row) => row.dataset))];
    const unknown = inRun.filter((dataset) => !grouped.includes(dataset));
    if (unknown.length > 0) throw new Error(`No kind of data for dataset ${unknown.join(', ')}`);
    const missing = grouped.filter((dataset) => !inRun.includes(dataset));
    if (missing.length > 0) throw new Error(`The ${format} rows have no dataset ${missing.join(', ')}`);
  }
  return ACCURACY_KINDS.map((kind): AccuracyKind => {
    const datasets = KIND_DATASETS[kind];
    const inKind = (format: AccuracyFormat): RunFile['rows'] => rowsFor(format).filter((row) => datasets.includes(row.dataset));
    const questions = new Set(inKind('json-compact').map((row) => `${row.dataset}/${row.questionId}`)).size;
    return {
      kind,
      datasets: [...datasets],
      questions,
      models: models.map((model) => {
        const tokens = (format: AccuracyFormat): number => {
          const own = inKind(format).filter((row) => row.model === model.id);
          if (own.length !== questions) throw new Error(`${model.id} ${format} ${kind}: ${String(own.length)} answers for ${String(questions)} questions`);
          return own.reduce((sum, row) => sum + row.inputTokens, 0);
        };
        return { id: model.id, inputTokens: { terset: tokens('terset'), 'json-compact': tokens('json-compact'), 'json-pretty': tokens('json-pretty'), toon: tokens('toon') } };
      }),
    };
  });
}

/**
 * The input tokens each selected row is published with: the request count for the
 * counted Claude model, the reported tokens for everything else. `assertAllUsed`
 * throws when a count matched no selected row.
 */
function inputCounts(counts: ClaudeRequestCounts): { readonly inputFor: (run: RunFile, formats: readonly AccuracyFormat[]) => InputFor; readonly assertAllUsed: () => void } {
  const byKey = new Map(counts.rows.map((row) => [requestCountKey(row), row.inputTokens]));
  const used = new Set<string>();
  return {
    inputFor: (run, formats) => (row) => {
      if (row.model !== counts.model || !formats.includes(row.format)) return row.inputTokens;
      const key = requestCountKey({ runId: run.runId, format: row.format, dataset: row.dataset, questionId: row.questionId });
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

function modelRows(run: RunFile, model: RunFile['models'][number], runOn: string, inputFor: InputFor): AccuracyRow[] {
  const mine = run.rows.filter((row) => row.model === model.id);
  const formats = ACCURACY_FORMATS.filter((format) => mine.some((row) => row.format === format));
  const questionSets = formats.map((format) => questionSet(mine.filter((row) => row.format === format)));
  if (new Set(questionSets).size !== 1) throw new Error(`${model.id}: formats did not answer the same questions`);
  return formats.map((format: AccuracyFormat): AccuracyRow => {
    const rows = mine.filter((row) => row.format === format);
    if (new Set(rows.map((row) => row.questionId)).size !== rows.length) throw new Error(`${model.id} ${format}: a question was answered twice`);
    const correct = rows.filter((row) => row.correct).length;
    const outputTokens = rows.reduce((sum, row) => sum + row.outputTokens, 0);
    const cost = (input: number): number => (input * model.price.inputPerMillion + outputTokens * model.price.outputPerMillion) / 1_000_000;
    // The run's summary is checked against the tokens the run recorded.
    const reportedInput = rows.reduce((sum, row) => sum + row.inputTokens, 0);
    const { low, high } = wilson95(correct, rows.length);
    const summary = run.summary.find((item) => item.model === model.id && item.format === format && item.dataset === 'ALL');
    if (summary === undefined) throw new Error(`${model.id} ${format}: the run has no overall summary row`);
    const m = summary.metrics;
    const agrees = m.correct === correct && m.total === rows.length && m.inputTokens === reportedInput && m.outputTokens === outputTokens && close(m.totalCost, cost(reportedInput)) && m.wilson95 !== null && close(m.wilson95.lower, low) && close(m.wilson95.upper, high);
    if (!agrees) throw new Error(`${model.id} ${format}: the run's summary differs from the figures recomputed from its rows`);
    const inputTokens = rows.reduce((sum, row) => sum + inputFor(row), 0);
    return { format, runOn, correct, total: rows.length, low, high, inputTokens, outputTokens, totalCost: cost(inputTokens) };
  });
}

function questionSet(rows: RunFile['rows']): string {
  return JSON.stringify(rows.map((row) => [row.dataset, row.questionId]).sort());
}

function equalField(a: unknown, b: unknown, field: string): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Published runs differ in ${field}`);
}

/** Combines only the explicitly selected formats after checking comparable inputs. */
export function buildAccuracy(rawRuns: readonly unknown[], rawCounts: unknown): AccuracyFile {
  if (rawRuns.length !== PUBLISHED_RUNS.length) throw new Error('Expected both published runs');
  const runs = rawRuns.map((raw) => RunFile.parse(raw));
  const run = runs[0];
  if (run === undefined) throw new Error('No published runs');
  const counts = ClaudeRequestCountsSchema.parse(rawCounts);
  if (run.models.find((model) => model.id === counts.model)?.api !== 'anthropic') throw new Error(`The request counts are for ${counts.model}, which is not a Claude model in the runs`);
  const { inputFor, assertAllUsed } = inputCounts(counts);
  for (const candidate of runs) {
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
  const publishedRuns = runs.map((item, index) => {
    const source = PUBLISHED_RUNS[index];
    if (source === undefined) throw new Error('Missing published source');
    return { runId: item.runId, runOn: basename(dirname(source.path)), publishedPath: dirname(source.path), formats: [...source.formats] };
  });
  const models = run.models.map((model): AccuracyModel => {
    const name = MODEL_NAMES[model.id];
    if (name === undefined) throw new Error(`No display name for model ${model.id}`);
    const selected = runs.flatMap((item, index) => {
      const source = publishedRuns[index];
      const ownModel = item.models.find((entry) => entry.id === model.id);
      if (source === undefined || ownModel === undefined) throw new Error('Missing published model');
      return modelRows(item, ownModel, source.runOn, inputFor(item, source.formats)).filter((row) => source.formats.some((format) => format === row.format));
    });
    return {
      id: model.id, name,
      inputTokensFrom: model.id === counts.model ? 'anthropic-token-count' : 'model-report',
      inputPerMillion: model.price.inputPerMillion,
      outputPerMillion: model.price.outputPerMillion,
      priceSource: model.price.sourceUrl,
      priceReadOn: model.price.dateRead,
      rows: ACCURACY_FORMATS.map((format) => {
        const matches = selected.filter((row) => row.format === format);
        const row = matches[0];
        if (matches.length !== 1 || row === undefined) throw new Error(`Expected one selected ${format} row`);
        return row;
      }),
    };
  });
  const kinds = kindRows(run.models, (format) => {
    const index = PUBLISHED_RUNS.findIndex((source) => source.formats.some((selected) => selected === format));
    const source = runs[index];
    const selected = PUBLISHED_RUNS[index];
    if (source === undefined || selected === undefined) throw new Error(`No published run is selected for ${format}`);
    const input = inputFor(source, selected.formats);
    return source.rows.filter((row) => row.format === format).map((row) => ({ ...row, inputTokens: input(row) }));
  });
  assertAllUsed();
  return AccuracyFileSchema.parse({
    publishedRuns,
    upstreamSha: run.upstreamSha,
    questions: models[0]?.rows[0]?.total,
    datasets: new Set(run.rows.map((row) => row.dataset)).size,
    calls: models.flatMap((model) => model.rows).reduce((sum, row) => sum + row.total, 0),
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
  console.log('Updated accuracy data and README tables from both published runs.');
}
