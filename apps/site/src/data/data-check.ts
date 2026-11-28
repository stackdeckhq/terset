// Checks every build-time data value the pages read against its zod schema.
// Data modules that type their JSON without parsing it keep zod out of the browser.
// The check runs where zod is free to load: in the server entry, so a bad file fails
// the prerender in `pnpm build`, and in data-check.test.ts, which also proves that
// parsing returns each value unchanged, so typing it without parsing is exact.
import type { z } from 'zod';
import { ACCURACY } from './accuracy.ts';
import { AccuracyFileSchema } from './accuracy-schema.ts';
import { BenchFileSchema } from './bench-schema.ts';
import { BundleSizesSchema } from './bundle-sizes-schema.ts';
import { BYTES } from './bytes.ts';
import { BytesFileSchema } from './bytes-schema.ts';
import { ClaudeCountsSchema } from './claude-counts-schema.ts';
import { GENERATED } from './generated.ts';
import { GeneratedSamplesSchema } from './generated-schema.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import { PRICES } from './prices.ts';
import { PricesSchema } from './prices-schema.ts';
import { REAL } from './real.ts';
import { REAL_400_ACCURACY } from './real-400-accuracy.ts';
import { Real400AccuracyFileSchema } from './real-400-accuracy-schema.ts';
import { REAL_ACCURACY } from './real-accuracy.ts';
import { RealAccuracyFileSchema } from './real-accuracy-schema.ts';
import { RealDataSchema } from './real-data-schema.ts';
import { SeedSweepSchema } from './seed-sweep-schema.ts';
import { SIZE_BYTES } from './size.ts';
import { SIZES } from './sizes.ts';
import { StressAccuracyFileSchema } from './accuracy-stress-schema.ts';
import { STRESS } from './stress.ts';
import { SizesSchema } from './sizes-schema.ts';
import { SWEEP } from './sweep.ts';
import { WEATHER_12_ACCURACY } from './weather-12-accuracy.ts';
import { Weather12AccuracyFileSchema } from './weather-12-accuracy-schema.ts';

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
  check('src/data/accuracy-stress-results.json', StressAccuracyFileSchema, STRESS),
  check('src/data/bench-results.json', BenchFileSchema, BENCH_FILE),
  check('src/data/bundle-sizes.json', BundleSizesSchema, SIZE_BYTES),
  check('src/data/bytes-results.json', BytesFileSchema, BYTES),
  check('src/data/claude-counts.json', ClaudeCountsSchema, CLAUDE_FILE),
  check('src/data/prices.ts', PricesSchema, PRICES),
  check('src/data/real-400-accuracy-results.json', Real400AccuracyFileSchema, REAL_400_ACCURACY),
  check('src/data/real-accuracy-results.json', RealAccuracyFileSchema, REAL_ACCURACY),
  check('src/data/real-data.json', RealDataSchema, REAL),
  check('src/data/seed-sweep.json', SeedSweepSchema, SWEEP),
  check('src/data/weather-12-accuracy-results.json', Weather12AccuracyFileSchema, WEATHER_12_ACCURACY),
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
