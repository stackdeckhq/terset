import { z } from 'zod';
import { REAL_ACCURACY_FORMATS, REAL_ACCURACY_MODELS, RealAccuracyFileSchema } from './real-accuracy-schema.ts';

const Base = RealAccuracyFileSchema.shape;
const Count = z.number().int().nonnegative();
const Kind = z.enum([
  ...Base.wrongAnswers.element.shape.kind.options,
  'count-two-conditions', 'compare', 'position', 'rank',
]);
export const REAL_400_QUESTION_KINDS = Kind.options;

const Model = Base.models.element;
const Row = Model.shape.rows.element.safeExtend({
  inputTokenDelta: z.number().int(),
  inputTokenChangePct: z.number(),
});
const PublishedRuns = z.array(Base.publishedRuns.element.extend({
  retainedCharges: Count,
})).length(REAL_ACCURACY_MODELS.length);

export const Real400AccuracyFileSchema = z.strictObject({
  suite: z.literal('real-400'),
  questions: z.literal(400),
  perCallMaxOutputTokens: z.literal(8192),
  formats: Base.formats,
  datasets: Base.datasets,
  publishedRuns: PublishedRuns,
  pilotRuns: PublishedRuns,
  models: z.array(Model.extend({
    rows: z.array(Row).length(REAL_ACCURACY_FORMATS.length * (Base.datasets.element.options.length + 1)),
    paired: z.array(z.strictObject({
      comparisonFormat: z.enum(['json-compact', 'toon']),
      total: z.literal(400),
      tersetOnly: Count,
      otherOnly: Count,
      gapPoints: z.number(),
      interval95Points: z.strictObject({ lower: z.number(), upper: z.number() }),
      pValue: z.number().min(0).max(1),
    })).length(2),
    wrongByKind: z.array(z.strictObject({
      kind: Kind,
      counts: z.record(z.enum(REAL_ACCURACY_FORMATS), Count),
    })).length(Kind.options.length),
  })).length(REAL_ACCURACY_MODELS.length),
  wrongAnswers: z.array(Base.wrongAnswers.element.extend({ kind: Kind })),
});

export type Real400AccuracyFile = z.infer<typeof Real400AccuracyFileSchema>;
