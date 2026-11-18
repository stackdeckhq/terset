// Validation and raw-row scoring shared by the TOON and stress publication paths.
import { z } from 'zod';
import { ACCURACY_FORMATS } from '../src/data/accuracy-schema.ts';
import type { AccuracyFormat } from '../src/data/accuracy-schema.ts';

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
/** A request that failed. The harness stops, and a rerun of the same id retries it. */
const RunFailure = z.object({ model: z.string(), format: z.enum(ACCURACY_FORMATS), dataset: z.string(), questionId: z.string(), status: z.literal('failed') });
export const RunFile = z.object({
  runId: z.string(),
  fingerprint: z.string().min(1),
  mode: z.literal('http'),
  status: z.literal('complete'),
  plannedCalls: Count,
  rows: z.array(RunRow),
  failures: z.array(RunFailure),
  inputReservation: z.object({ margin: z.number(), allowance: Count }),
  models: z.array(RunModel).min(1),
  upstreamSha: z.string(),
  dataHashes: z.record(z.string(), z.string()),
  tokenizer: z.string(),
  budgets: z.object({ perCallMaxOutputTokens: Count }),
  summary: z.array(RunSummary),
});
export type RunFile = z.infer<typeof RunFile>;
export type RunRow = z.infer<typeof RunRow>;
/** The input tokens a row is published with. */
export type InputFor = (row: RunRow) => number;

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

/** One run of one format on one model, recomputed from its rows and checked against its summary. */
export interface RunScore {
  readonly format: AccuracyFormat;
  readonly runId: string;
  readonly runOn: string;
  readonly correct: number;
  readonly total: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalCost: number;
}

/** The scores of the formats the tables take from this run for this model. */
export function runScores(item: { readonly run: Pick<RunFile, 'rows' | 'summary' | 'runId'>; readonly runOn: string }, model: RunFile['models'][number], formats: readonly AccuracyFormat[], inputFor: InputFor): RunScore[] {
  const { run } = item;
  const mine = run.rows.filter((row) => row.model === model.id);
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

export function questionSet(rows: RunFile['rows']): string {
  return JSON.stringify(rows.map((row) => [row.dataset, row.questionId]).sort());
}

export function equalField(a: unknown, b: unknown, field: string): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Published runs differ in ${field}`);
}

/** Every planned call answered, with failed attempts retained only when later answered. */
export function validateRun(run: Pick<RunFile, 'runId' | 'rows' | 'plannedCalls' | 'models' | 'failures'>, allowedModels: readonly string[]): void {
  if (run.rows.length !== run.plannedCalls) throw new Error(`The run recorded ${String(run.rows.length)} of ${String(run.plannedCalls)} planned calls`);
  if (new Set(run.models.map((model) => model.id)).size !== run.models.length) throw new Error('Duplicate model id');
  if (run.rows.some((row) => !run.models.some((model) => model.id === row.model))) throw new Error('Unknown row model');
  if (run.models.some((model) => !allowedModels.includes(model.id))) throw new Error(`${run.runId}: no display name for a model in the run`);
  for (const failure of run.failures) {
    const answered = run.rows.some((row) => row.model === failure.model && row.format === failure.format && row.dataset === failure.dataset && row.questionId === failure.questionId);
    if (!answered) throw new Error(`${run.runId}: a failed request was never answered (${failure.model} ${failure.format} ${failure.dataset} ${failure.questionId})`);
  }
}
