// The shape of bench-results.json. Strict, so a stray or missing field fails loudly.
// The file is either pending (no numbers yet) or ready (real measured counts).
import { z } from 'zod';

const Count = z.number().int().positive();
const TrioSchema = z.strictObject({ json: Count, toon: Count, terset: Count });

export const CaseRowSchema = z.strictObject({
  name: z.string().min(1),
  /** Compact JSON, no spaces. The main baseline. */
  json: Count,
  /** JSON.stringify(value, null, 2). */
  jsonPretty: Count,
  /** The yaml package's stringify with default options. */
  yaml: Count,
  /** TOON's best of its comma and tab forms. */
  toon: Count,
  /** Plain CSV, or null when the data is not one list of records. */
  csv: Count.nullable(),
  /** Whether the CSV read back to the exact typed data. Null when there is no CSV. */
  csvExact: z.boolean().nullable(),
  /** Terset data plus its fitted rules line. */
  terset: Count,
});

export const BenchPendingSchema = z.strictObject({
  status: z.literal('pending'),
  /** Why there are no numbers yet, in one plain sentence. */
  reason: z.string().min(1),
});

export const BenchReadySchema = z.strictObject({
  status: z.literal('ready'),
  tokenizer: z.string().min(1),
  /** Tokens for the full RULES reference. Each prompt uses its fitted subset. */
  rulesTokens: Count,
  /** The exact yaml package version the YAML counts were made with. */
  yamlVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  cases: z.array(CaseRowSchema).min(1),
  samples: z.strictObject({ orders: TrioSchema, servers: TrioSchema, config: TrioSchema }),
});

export const BenchFileSchema = z.discriminatedUnion('status', [BenchPendingSchema, BenchReadySchema]);

export type BenchPending = z.infer<typeof BenchPendingSchema>;
export type BenchReady = z.infer<typeof BenchReadySchema>;
export type BenchFile = z.infer<typeof BenchFileSchema>;

/** Reads and checks a bench file. */
export function parseBench(raw: unknown): BenchFile {
  return BenchFileSchema.parse(raw);
}
export type CaseRow = z.infer<typeof CaseRowSchema>;
export type Trio = z.infer<typeof TrioSchema>;
