// Checks every build-time data value the pages read against its zod schema.
// The data modules type their JSON without parsing it, so the browser never loads zod.
// The check runs where zod is free to load: in the server entry, so a bad file fails
// the prerender in `pnpm build`, and in data-check.test.ts, which also proves that
// parsing returns each value unchanged, so typing it without parsing is exact.
import type { z } from 'zod';
import { ACCURACY } from './accuracy.ts';
import { AccuracyFileSchema } from './accuracy-schema.ts';
import { BenchFileSchema } from './bench-schema.ts';
import { BYTES } from './bytes.ts';
import { BytesFileSchema } from './bytes-schema.ts';
import { ClaudeCountsSchema } from './claude-counts-schema.ts';
import { GENERATED } from './generated.ts';
import { GeneratedSamplesSchema } from './generated-schema.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import { PRICES } from './prices.ts';
import { PricesSchema } from './prices-schema.ts';
import { SIZES } from './sizes.ts';
import { SizesSchema } from './sizes-schema.ts';

export interface DataCheck {
  /** Where the value comes from, relative to apps/site. */
  readonly source: string;
  readonly schema: z.ZodType;
  readonly value: unknown;
}

/** Pairs a value with the schema its type comes from, so a mismatched pair fails the type check. */
function check<T>(source: string, schema: z.ZodType<T>, value: NoInfer<T>): DataCheck {
  return { source, schema, value };
}

export const DATA_CHECKS: readonly DataCheck[] = [
  check('src/data/accuracy-results.json', AccuracyFileSchema, ACCURACY),
  check('src/data/bench-results.json', BenchFileSchema, BENCH_FILE),
  check('src/data/bytes-results.json', BytesFileSchema, BYTES),
  check('src/data/claude-counts.json', ClaudeCountsSchema, CLAUDE_FILE),
  check('src/data/prices.ts', PricesSchema, PRICES),
  check('src/generated/samples.json', GeneratedSamplesSchema, GENERATED),
  check('src/generated/sizes.json', SizesSchema, SIZES),
];

/** Throws, naming the source and the fields, when a value does not match its schema. */
export function checkSiteData(checks: readonly DataCheck[] = DATA_CHECKS): void {
  for (const { source, schema, value } of checks) {
    const result = schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ');
      throw new Error(`${source} does not match its schema: ${issues}`);
    }
  }
}
