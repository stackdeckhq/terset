import { z } from 'zod';

const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const ClaudeRowSchema = z.strictObject({
  id: z.string().min(1),
  source: z.enum(['sample', 'example', 'benchmark']),
  name: z.string().min(1),
  json: Count,
  jsonPretty: Count,
  yaml: Count,
  toon: Count,
  csv: Count.nullable(),
  // Earlier measured files lack these fields. New runs always write both.
  csvExact: z.boolean().nullable().optional(),
  /** Compact JSON counted locally with o200k_base, for matching private inputs. */
  o200kJson: Count.optional(),
  terset: Count,
}).refine((row) => row.csvExact === undefined || (row.csv === null) === (row.csvExact === null), 'CSV count and fidelity must apply together');

export const ClaudeReadySchema = z.strictObject({
  status: z.literal('ready'),
  model: z.string().min(1),
  countedAt: z.iso.datetime(),
  endpoint: z.literal('/v1/messages/count_tokens'),
  baseline: z.strictObject({
    text: z.literal('a'),
    assumedTextTokens: z.literal(1),
    inputTokens: Count.min(1),
    overheadTokens: Count,
  }).refine((value) => value.overheadTokens === value.inputTokens - value.assumedTextTokens, 'Inconsistent baseline'),
  method: z.string().min(1),
  /** Earlier measurements sent the full rules line. New runs fit it to the text. */
  rulesMode: z.enum(['full', 'fitted']).optional(),
  requests: Count.min(1),
  rows: z.array(ClaudeRowSchema).min(1).refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'Duplicate row ids'),
});

export const ClaudeCountsSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending') }),
  ClaudeReadySchema,
]);

export type ClaudeReady = z.infer<typeof ClaudeReadySchema>;
export type ClaudeRow = z.infer<typeof ClaudeRowSchema>;
export type ClaudeCounts = z.infer<typeof ClaudeCountsSchema>;
