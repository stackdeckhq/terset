import { z } from 'zod';

export const REAL_ACCURACY_FORMATS = ['json-compact', 'toon', 'terset'] as const;
export const REAL_ACCURACY_DATASETS = ['usgs-earthquakes', 'nws-gridpoint'] as const;
export const REAL_ACCURACY_MODELS = ['claude-opus-5-5', 'gpt-6.2-sol'] as const;

const Format = z.enum(REAL_ACCURACY_FORMATS);
const Dataset = z.enum(REAL_ACCURACY_DATASETS);
const Model = z.enum(REAL_ACCURACY_MODELS);
const Count = z.number().int().nonnegative();

const Row = z.strictObject({
  format: Format,
  dataset: z.enum(['ALL', ...REAL_ACCURACY_DATASETS]),
  correct: Count,
  total: Count.positive(),
  inputTokens: Count,
  outputTokens: Count,
  totalCost: z.number().nonnegative(),
}).refine((row) => row.correct <= row.total, 'More correct answers than questions');

export const RealAccuracyFileSchema = z.strictObject({
  suite: z.literal('real'),
  questions: Count.positive(),
  perCallMaxOutputTokens: Count.positive(),
  formats: z.array(Format).length(REAL_ACCURACY_FORMATS.length)
    .refine((formats) => formats.every((format, index) => format === REAL_ACCURACY_FORMATS[index]), 'Formats must be in order'),
  datasets: z.array(Dataset).length(REAL_ACCURACY_DATASETS.length)
    .refine((datasets) => datasets.every((dataset, index) => dataset === REAL_ACCURACY_DATASETS[index]), 'Datasets must be in order'),
  publishedRuns: z.array(z.strictObject({
    runId: z.string().min(1),
    runOn: z.iso.date(),
    publishedPath: z.string().regex(/^bench\/published\/[\w./-]+$/u),
    model: Model,
    price: z.strictObject({
      inputPerMillion: z.number().positive(),
      outputPerMillion: z.number().positive(),
      sourceUrl: z.url(),
      dateRead: z.iso.date(),
    }),
  })).length(REAL_ACCURACY_MODELS.length),
  models: z.array(z.strictObject({
    id: Model,
    rows: z.array(Row).length(REAL_ACCURACY_FORMATS.length * (REAL_ACCURACY_DATASETS.length + 1)),
  })).length(REAL_ACCURACY_MODELS.length),
  wrongAnswers: z.array(z.strictObject({
    model: Model,
    format: Format,
    dataset: Dataset,
    questionId: z.string().min(1),
    prompt: z.string().min(1),
    kind: z.enum(['field-retrieval', 'count', 'extreme', 'nested-lookup']),
    expected: z.string(),
    text: z.string(),
    outputTokens: Count,
    hitOutputCap: z.boolean(),
  })),
});

export type RealAccuracyFile = z.infer<typeof RealAccuracyFileSchema>;
