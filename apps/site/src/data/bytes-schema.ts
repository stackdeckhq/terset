import { z } from 'zod';

export const BYTE_FORMATS = ['terset', 'toon', 'json-compact'] as const;
export type ByteFormat = (typeof BYTE_FORMATS)[number];

const Count = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const ByteCountSchema = z.strictObject({ raw: Count, gzip: Count });
export type ByteCount = z.infer<typeof ByteCountSchema>;

const TotalsSchema = z.strictObject({ terset: ByteCountSchema, toon: ByteCountSchema, 'json-compact': ByteCountSchema });

export const BytesFileSchema = z.strictObject({
  /** The benchmark datasets measured, in run order. The structure checks are left out. */
  datasets: z.array(z.string().min(1)).min(1),
  /** Gzip compression level used for every format. */
  gzipLevel: z.literal(9),
  totals: TotalsSchema,
});
export type BytesFile = z.infer<typeof BytesFileSchema>;
