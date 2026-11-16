import { z } from 'zod';

const count = z.number().int().nonnegative();
export const formatSchema = z.enum(['json-compact', 'json-pretty', 'toon', 'terset']);
export type Format = z.infer<typeof formatSchema>;
// Default formats retain the published order.
export const FORMATS = ['json-compact', 'json-pretty', 'toon', 'terset'] as const;
export const selectedFormatsSchema = z.array(formatSchema).min(1)
  .refine(formats => new Set(formats).size === formats.length, 'Formats must be unique');
export const jsonRootSchema = z.union([z.record(z.string(), z.json()), z.array(z.json())]);
export type JsonRoot = z.infer<typeof jsonRootSchema>;
const recordSchema = z.record(z.string(), z.json());
export const corruptionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('control') }),
  z.object({ kind: z.literal('truncated'), removeRecordCount: count }),
  z.object({ kind: z.literal('extra-rows'), appendRecords: z.array(recordSchema) }),
  z.object({ kind: z.enum(['width-mismatch', 'missing-fields']), targetRecordIndices: z.array(count), targetFieldName: z.string() }),
]);
export type Corruption = z.infer<typeof corruptionSchema>;
export const datasetSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  data: recordSchema,
  metadata: z.object({ supportsCSV: z.boolean(), structureClass: z.string(), tabularEligibility: z.number() }),
  corruption: corruptionSchema.optional(),
});
export type Dataset = z.infer<typeof datasetSchema>;
export const answerTypeSchema = z.enum(['integer', 'number', 'boolean', 'date', 'string', 'csv-list-ordered', 'csv-list-unordered']);
export const normalizationSchema = z.object({
  tolerance: z.number().nonnegative().optional(),
  caseSensitive: z.boolean().optional(),
  allowCurrency: z.boolean().optional(),
  allowPercent: z.boolean().optional(),
  decimalPlaces: count.optional(),
});
export type Normalization = z.infer<typeof normalizationSchema>;
export const questionSchema = z.object({
  id: z.string().min(1), prompt: z.string().min(1), groundTruth: z.string(),
  type: z.string().min(1), dataset: z.string().min(1),
  answerType: answerTypeSchema.default('string'),
  normalizationOptions: normalizationSchema.optional(),
});
export type Question = z.infer<typeof questionSchema>;
export const modelSchema = z.object({
  id: z.string().min(1), api: z.enum(['anthropic', 'openai']),
  price: z.object({
    inputPerMillion: z.number().nonnegative(), outputPerMillion: z.number().nonnegative(),
    sourceUrl: z.url(), dateRead: z.iso.date(),
  }).strict(),
  temperature: z.enum(['zero', 'omit']).default('zero'),
  outputTokenParameter: z.enum(['max_tokens', 'max_completion_tokens']).default('max_completion_tokens'),
}).strict();
export type Model = z.infer<typeof modelSchema>;
export const inputReservationSchema = z.object({
  margin: z.number().min(1).default(1.25),
  allowance: count.default(64),
}).strict();
export type InputReservation = z.infer<typeof inputReservationSchema>;
export const configSchema = z.object({
  models: z.array(modelSchema).min(1),
  inputReservation: inputReservationSchema.prefault({}),
}).strict();
export const responseSchema = z.object({ text: z.string(), inputTokens: count, outputTokens: count });
export type Response = z.infer<typeof responseSchema>;
export const rowSchema = responseSchema.extend({
  model: z.string(), format: formatSchema, dataset: z.string(), questionId: z.string(),
  expected: z.string(), correct: z.boolean(),
  reservedInputTokens: count.optional(),
});
export type Row = z.infer<typeof rowSchema>;
export const budgetsSchema = z.object({
  maxCalls: count, maxInputTokens: count, maxOutputTokens: count,
  perCallMaxOutputTokens: z.number().int().positive(),
});
export type Budgets = z.infer<typeof budgetsSchema>;
export const usageSchema = z.object({ calls: count, inputTokens: count, outputTokens: count });
export type Usage = z.infer<typeof usageSchema>;
export const runIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
export const failureSchema = z.object({
  model: z.string(), format: formatSchema, dataset: z.string(), questionId: z.string(),
  status: z.enum(['reserved', 'failed']), inputTokens: count, outputTokens: count,
});
export const resultSchema = z.object({
  version: z.literal(1), runId: runIdSchema, fingerprint: z.string(),
  mode: z.enum(['fake', 'http']), status: z.enum(['partial', 'complete']),
  reason: z.string().nullable(), plannedCalls: count, budgets: budgetsSchema,
  budgetUsed: usageSchema, rows: z.array(rowSchema), failures: z.array(failureSchema).default([]),
  inputReservation: inputReservationSchema.optional(),
});
export type Result = z.infer<typeof resultSchema>;
