// The shape of accuracy-results.json: answer accuracy, tokens and cost per model
// and format, from every published benchmark run of that format, with the mean over
// those runs. Strict, so a stray or missing field fails loudly. `pnpm accuracy` writes
// the file from the published runs.
import { z } from 'zod';
import { ACCURACY_FORMATS, ACCURACY_KINDS } from './accuracy-ids.ts';

export { ACCURACY_FORMATS, ACCURACY_KINDS };

const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Share = z.number().min(0).max(1);
const Usd = z.number().nonnegative();

export const AccuracyFormatSchema = z.enum(ACCURACY_FORMATS);

/** A mean over runs, so it may have a fraction. */
const Mean = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** One published run of one format on one model, as that run recorded it. */
export const AccuracyRunScoreSchema = z.strictObject({
  runId: z.string().min(1),
  runOn: z.iso.date(),
  correct: Count,
  inputTokens: Count,
  outputTokens: Count,
  /** US dollars at API list price: input and output tokens times list price. */
  totalCost: Usd,
});

const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const meanOf = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * One format on one model: every published run of it, then the mean over those runs.
 * No run is picked; a format with one run has that run as its mean.
 */
export const AccuracyRowSchema = z.strictObject({
  format: AccuracyFormatSchema,
  /** Every published run of this format, in the order the runs are published. */
  runs: z.array(AccuracyRunScoreSchema).min(1),
  /** Mean correct answers over the runs. */
  correct: Mean,
  total: Count.min(1),
  /** Wilson 95% interval of the mean correct / total, over the total questions. */
  low: Share,
  high: Share,
  /** Means over the runs. */
  inputTokens: Mean,
  outputTokens: Mean,
  /** US dollars at API list price, the mean over the runs. */
  totalCost: Usd,
}).refine((row) => row.correct <= row.total && row.low <= row.correct / row.total && row.correct / row.total <= row.high, 'Inconsistent score')
  .refine((row) => row.runs.every((run) => run.correct <= row.total), 'A run has more correct answers than questions')
  .refine((row) => new Set(row.runs.map((run) => run.runId)).size === row.runs.length, 'A run is listed twice')
  .refine((row) => close(row.correct, meanOf(row.runs.map((run) => run.correct)))
    && close(row.inputTokens, meanOf(row.runs.map((run) => run.inputTokens)))
    && close(row.outputTokens, meanOf(row.runs.map((run) => run.outputTokens)))
    && close(row.totalCost, meanOf(row.runs.map((run) => run.totalCost))), 'The row is not the mean of its runs');

export const AccuracyModelSchema = z.strictObject({
  /** The model id the requests named. */
  id: z.string().min(1),
  /** The model as the vendor names it. */
  name: z.string().min(1),
  /** Where the input tokens come from: Anthropic's token count of each request body, or the model's own report. */
  inputTokensFrom: z.enum(['anthropic-token-count', 'model-report']),
  inputPerMillion: z.number().positive(),
  outputPerMillion: z.number().positive(),
  priceSource: z.url({ protocol: /^https$/u }),
  priceReadOn: z.iso.date(),
  /** One row per format, Terset first. */
  rows: z.array(AccuracyRowSchema).length(ACCURACY_FORMATS.length),
}).refine((model) => model.rows.every((row, index) => row.format === ACCURACY_FORMATS[index]), 'Rows must be in format order, Terset first');

export const AccuracyKindIdSchema = z.enum(ACCURACY_KINDS);

/** Input tokens one model reported for one kind of data, summed per format over its rows, then the mean over that format's runs. */
export const AccuracyKindModelSchema = z.strictObject({
  id: z.string().min(1),
  inputTokens: z.strictObject({ terset: Mean.min(1), 'json-compact': Mean.min(1), 'json-pretty': Mean.min(1), toon: Mean.min(1) }),
});

export const AccuracyKindSchema = z.strictObject({
  kind: AccuracyKindIdSchema,
  /** The run's dataset names in this kind. */
  datasets: z.array(z.string().min(1)).min(1),
  questions: Count.min(1),
  models: z.array(AccuracyKindModelSchema).min(1),
});

export const AccuracyFileSchema = z.strictObject({
  /** Every published run, the ones the tables use and the ones kept as history. */
  publishedRuns: z.array(z.strictObject({
    runId: z.string().min(1),
    runOn: z.iso.date(),
    publishedPath: z.string().regex(/^bench\/published\/[\w./-]+$/u),
    /** The model ids the run holds. */
    models: z.array(z.string().min(1)).min(1),
    /** The formats the run holds. */
    formats: z.array(AccuracyFormatSchema).min(1),
    /** Failed attempts, each retried in the same run. One request can fail more than once. The file keeps each one. */
    failedRequests: Count,
    /** Per model, the formats the tables take from this run. Empty when the run is history only. */
    inTables: z.array(z.strictObject({ model: z.string().min(1), formats: z.array(AccuracyFormatSchema).min(1) })),
  })).min(1),
  upstreamSha: z.string().regex(/^[0-9a-f]{40}$/u),
  questions: Count.min(1),
  datasets: Count.min(1),
  calls: Count.min(1),
  failedCalls: Count,
  models: z.array(AccuracyModelSchema).min(1),
  /** One entry per kind of data, in ACCURACY_KINDS order. */
  kinds: z.array(AccuracyKindSchema).length(ACCURACY_KINDS.length),
}).refine((file) => file.kinds.every((item, index) => item.kind === ACCURACY_KINDS[index]), 'Kinds must be in ACCURACY_KINDS order')
  .refine((file) => file.kinds.every((item) => item.models.map((model) => model.id).join(',') === file.models.map((model) => model.id).join(',')), 'Every kind must list the same models in the same order')
  .refine((file) => file.kinds.reduce((sum, item) => sum + item.questions, 0) === file.questions, 'The kinds must add up to every question');

export type AccuracyKindId = z.infer<typeof AccuracyKindIdSchema>;
export type AccuracyKind = z.infer<typeof AccuracyKindSchema>;
export type AccuracyFormat = z.infer<typeof AccuracyFormatSchema>;
export type AccuracyRow = z.infer<typeof AccuracyRowSchema>;
export type AccuracyRunScore = z.infer<typeof AccuracyRunScoreSchema>;
export type AccuracyModel = z.infer<typeof AccuracyModelSchema>;
export type AccuracyFile = z.infer<typeof AccuracyFileSchema>;
