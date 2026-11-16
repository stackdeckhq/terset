// The shape of claude-request-counts.json: Anthropic's token count for every Claude
// request in the published benchmark runs, over the exact body the benchmark sent.
// `pnpm --dir apps/site count:claude --published` writes it.
import { z } from 'zod';
import { AccuracyFormatSchema } from './accuracy-schema.ts';

const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const ClaudeRequestCountSchema = z.strictObject({
  runId: z.string().min(1),
  format: AccuracyFormatSchema,
  dataset: z.string().min(1),
  questionId: z.string().min(1),
  /** input_tokens from the token counting endpoint for model, system and messages. */
  inputTokens: Count.min(1),
});

export const ClaudeRequestCountsSchema = z.strictObject({
  model: z.string().min(1),
  countedAt: z.iso.datetime(),
  endpoint: z.literal('/v1/messages/count_tokens'),
  /** The one-letter message counted first, to check the count carries no extra tokens. */
  baseline: z.strictObject({ text: z.literal('a'), inputTokens: Count.min(1) }),
  /** Requests sent, the baseline and any retry included. */
  requests: Count.min(1),
  rows: z.array(ClaudeRequestCountSchema).min(1)
    .refine((rows) => new Set(rows.map(requestCountKey)).size === rows.length, 'Duplicate request counts'),
});

/** One published request: its run, format, dataset and question. */
export function requestCountKey(row: Pick<ClaudeRequestCount, 'runId' | 'format' | 'dataset' | 'questionId'>): string {
  return JSON.stringify([row.runId, row.format, row.dataset, row.questionId]);
}

export type ClaudeRequestCount = z.infer<typeof ClaudeRequestCountSchema>;
export type ClaudeRequestCounts = z.infer<typeof ClaudeRequestCountsSchema>;
