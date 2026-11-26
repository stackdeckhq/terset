// The shape of src/data/bundle-sizes.json: gzip bytes of the browser bundles,
// measured by scripts/measure-bundle-sizes.ts.
// Strict, so a stale or hand-edited file fails loudly.
import { z } from 'zod';

const Bytes = z.number().int().positive();

export const BundleSizesSchema = z
  .object({
    tersetEncode: Bytes,
    tersetAll: Bytes,
    toonEncode: Bytes,
    toonAll: Bytes,
  })
  .strict();

export type BundleSizes = z.infer<typeof BundleSizesSchema>;
