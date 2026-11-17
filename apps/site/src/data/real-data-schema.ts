// The shape of real-data.json: token counts for the frozen real files in
// bench/data/real. Strict, so a stray or missing field fails loudly.
import { z } from 'zod';

const Count = z.number().int().positive();

export const RealFileSchema = z.strictObject({
  /** A short plain name for the table. */
  name: z.string().min(1),
  /** The frozen file, relative to the repo root. */
  path: z.string().regex(/^bench\/data\/real\/[\w.-]+$/u),
  /** Where the file was fetched from. */
  source: z.url(),
  /** The fetch day, UTC. */
  fetched: z.iso.date(),
  /** SHA-256 of the file bytes, so a changed file fails the freshness test. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  bytes: Count,
  /** Compact JSON, no spaces. The main baseline. */
  json: Count,
  /** JSON.stringify(value, null, 2). */
  jsonPretty: Count,
  /** TOON's best of its comma and tab forms, as on the sample table. */
  toon: Count,
  /** TOON with default options only. */
  toonDefault: Count,
  /** Terset data plus its fitted rules line. */
  terset: Count,
});

export const RealDataSchema = z.strictObject({
  tokenizer: z.string().min(1),
  toonVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  files: z.array(RealFileSchema).min(1),
});

export type RealFile = z.infer<typeof RealFileSchema>;
export type RealData = z.infer<typeof RealDataSchema>;
