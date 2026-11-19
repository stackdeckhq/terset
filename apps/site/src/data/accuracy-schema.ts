// The shape of accuracy-results.json: answer accuracy, tokens and cost per model
// and format, from the one published run of each model. Strict, so a stray or missing
// field fails loudly. `pnpm accuracy` writes the file from the published runs.
import { z } from 'zod';
import { ACCURACY_FORMATS, ACCURACY_KINDS } from './accuracy-ids.ts';

export { ACCURACY_FORMATS, ACCURACY_KINDS };

const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Share = z.number().min(0).max(1);
const Usd = z.number().nonnegative();

export const AccuracyFormatSchema = z.enum(ACCURACY_FORMATS);

/** One format on one model, from that model's run. */
export const AccuracyRowSchema = z.strictObject({
  format: AccuracyFormatSchema,
  correct: Count,
  total: Count.min(1),
  /** Wilson 95% interval of correct / total. */
  low: Share,
  high: Share,
  inputTokens: Count,
  outputTokens: Count,
  /** US dollars at API list price: input and output tokens times list price. */
  totalCost: Usd,
}).refine((row) => row.correct <= row.total && row.low <= row.correct / row.total && row.correct / row.total <= row.high, 'Inconsistent score');

export const AccuracyModelSchema = z.strictObject({
  /** The model id the requests named. */
  id: z.string().min(1),
  /** The model as the vendor names it. */
  name: z.string().min(1),
  /** Input tokens are as the model reported them. */
  inputTokensFrom: z.literal('model-report'),
  inputPerMillion: z.number().positive(),
  outputPerMillion: z.number().positive(),
  priceSource: z.url({ protocol: /^https$/u }),
  priceReadOn: z.iso.date(),
  /** One row per format, Terset first. */
  rows: z.array(AccuracyRowSchema).length(ACCURACY_FORMATS.length),
}).refine((model) => model.rows.every((row, index) => row.format === ACCURACY_FORMATS[index]), 'Rows must be in format order, Terset first');

export const AccuracyKindIdSchema = z.enum(ACCURACY_KINDS);

/** Input tokens one model reported for one kind of data, summed per format over its rows. */
export const AccuracyKindModelSchema = z.strictObject({
  id: z.string().min(1),
  inputTokens: z.strictObject({ terset: Count.min(1), 'json-compact': Count.min(1), 'json-pretty': Count.min(1), toon: Count.min(1) }),
});

export const AccuracyKindSchema = z.strictObject({
  kind: AccuracyKindIdSchema,
  /** The run's dataset names in this kind. */
  datasets: z.array(z.string().min(1)).min(1),
  questions: Count.min(1),
  models: z.array(AccuracyKindModelSchema).min(1),
});

export const AccuracyFileSchema = z.strictObject({
  /** The one published run of each model, in model order. */
  publishedRuns: z.array(z.strictObject({
    runId: z.string().min(1),
    runOn: z.iso.date(),
    publishedPath: z.string().regex(/^bench\/published\/[\w./-]+$/u),
    /** The model the run holds. */
    model: z.string().min(1),
    /** Failed attempts, each retried in the same run. One request can fail more than once. The file keeps each one. */
    failedRequests: Count,
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
  .refine((file) => file.kinds.reduce((sum, item) => sum + item.questions, 0) === file.questions, 'The kinds must add up to every question')
  .refine((file) => file.publishedRuns.map((run) => run.model).join(',') === file.models.map((model) => model.id).join(','), 'Each model must have exactly one published run, in model order');

export type AccuracyKindId = z.infer<typeof AccuracyKindIdSchema>;
export type AccuracyKind = z.infer<typeof AccuracyKindSchema>;
export type AccuracyFormat = z.infer<typeof AccuracyFormatSchema>;
export type AccuracyRow = z.infer<typeof AccuracyRowSchema>;
export type AccuracyModel = z.infer<typeof AccuracyModelSchema>;
export type AccuracyFile = z.infer<typeof AccuracyFileSchema>;
