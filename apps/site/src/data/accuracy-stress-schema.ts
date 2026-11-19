// One measured run per model. pnpm accuracy rebuilds the data from raw runs.
import { z } from 'zod';
import { ACCURACY_FORMATS } from './accuracy-ids.ts';

export const STRESS_GROUPS = ['scale', 'deep', 'messy', 'damage'] as const;
export const STRESS_MODELS = ['claude-opus-5-5', 'gpt-6.1-sol', 'claude-haiku-5-5'] as const;
const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Hash = z.string().regex(/^[0-9a-f]{64}$/u);
const Score = z.strictObject({ correct: Count, total: Count.positive(), inputTokens: Count })
  .refine((score) => score.correct <= score.total, 'More correct answers than questions');

export const StressSourceSchema = z.strictObject({
  generatorSource: z.string().min(1),
  generatorSha256: Hash,
  seed: Count,
  referenceDate: z.iso.datetime(),
  dataHashes: z.record(z.string(), Hash),
  encoders: z.strictObject({ '@toon-format/toon': z.string().min(1), '@stackdeck/terset': z.string().min(1) }),
  tokenizer: z.string().min(1),
  perCallMaxOutputTokens: Count.positive(),
});

const Row = Score.extend({
  format: z.enum(ACCURACY_FORMATS),
  outputTokens: Count,
  totalCost: z.number().nonnegative(),
  groups: z.array(Score.extend({ group: z.enum(STRESS_GROUPS) })).length(STRESS_GROUPS.length),
  /** The answers to the sparse field-count questions, kept for the Haiku Terset row so the copy can check them. */
  sparseFieldCounts: z.array(z.strictObject({
    questionId: z.string(), dataset: z.string(), prompt: z.string(),
    rowCount: Count.positive(), text: z.string(), correct: z.boolean(),
  })),
}).refine((row) => row.groups.every((group, index) => group.group === STRESS_GROUPS[index]), 'Groups must be in order')
  .refine((row) => (['correct', 'total', 'inputTokens'] as const).every((field) => row.groups.reduce((sum, group) => sum + group[field], 0) === row[field]), 'Groups must add up to the overall score');

export const StressAccuracyFileSchema = z.strictObject({
  suite: z.literal('stress'),
  source: StressSourceSchema,
  questions: Count.positive(),
  datasets: Count.positive(),
  calls: Count.positive(),
  failedCalls: Count,
  /** The one published run of each model, in model order. */
  publishedRuns: z.array(z.strictObject({
    runId: z.string().min(1), runOn: z.iso.date(),
    publishedPath: z.string().regex(/^bench\/published\/[\w./-]+$/u),
    model: z.enum(STRESS_MODELS),
  })).length(STRESS_MODELS.length),
  models: z.array(z.strictObject({
    id: z.enum(STRESS_MODELS), name: z.string().min(1),
    inputTokensFrom: z.literal('model-report'),
    rows: z.array(Row).length(ACCURACY_FORMATS.length),
  }).refine((model) => model.rows.every((row, index) => row.format === ACCURACY_FORMATS[index]), 'Formats must be in order'))
    .length(STRESS_MODELS.length),
}).refine((file) => file.models.every((model, index) => model.id === STRESS_MODELS[index]), 'Models must be in order')
  .refine((file) => file.publishedRuns.every((run, index) => run.model === STRESS_MODELS[index]), 'Each model must have exactly one published run, in model order');

export type StressAccuracyFile = z.infer<typeof StressAccuracyFileSchema>;
