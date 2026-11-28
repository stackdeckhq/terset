import { z } from 'zod';
import { Real400AccuracyFileSchema } from './real-400-accuracy-schema.ts';

const Real400 = Real400AccuracyFileSchema.shape;
const Run = Real400.publishedRuns.element.pick({ runId: true, runOn: true, publishedPath: true });
const Count = z.number().int().nonnegative();
const Score = z.strictObject({ correct: Count.max(200), inputTokens: Count.positive() });
const Paired = Real400.models.element.shape.paired.element.extend({
  comparisonFormat: z.enum(['json-compact', 'toon', 'terset-1.1']),
  total: z.literal(200),
  inputTokensFewerPct: z.number(),
});

export const Weather12AccuracyFileSchema = z.strictObject({
  dataset: z.literal('nws-gridpoint'),
  questions: z.literal(200),
  perCallMaxOutputTokens: z.literal(8192),
  models: z.array(z.strictObject({
    id: Real400.models.element.shape.id,
    runs: z.strictObject({ '1.1': Run, '1.2': Run }),
    scores: z.strictObject({
      'json-compact': Score,
      toon: Score,
      'terset-1.1': Score,
      'terset-1.2': Score,
    }),
    paired: z.array(Paired).length(3),
    wrongAnswers: z.array(Real400.wrongAnswers.element.extend({
      format: z.literal('terset'),
      dataset: z.literal('nws-gridpoint'),
    })),
  })).length(2),
});

export type Weather12AccuracyFile = z.infer<typeof Weather12AccuracyFileSchema>;
