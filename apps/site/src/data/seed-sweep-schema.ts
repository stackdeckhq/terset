// The shape of seed-sweep.json: the eleven case shapes counted across many seeds.
// Strict, so a stray or missing field fails loudly.
import { z } from 'zod';

const Seeds = z.number().int().positive();
/** Percent change from the other format to Terset, one decimal. Negative means Terset is smaller. */
const Change = z.number();

/** The 5th percentile, median and 95th percentile of one change across all seeds, by nearest rank. */
export const SpreadSchema = z
  .strictObject({ p5: Change, median: Change, p95: Change })
  .refine((spread) => spread.p5 <= spread.median && spread.median <= spread.p95, 'Percentiles must run from low to high');

export const SweepCaseSchema = z.strictObject({
  name: z.string().min(1),
  /** Seeds where Terset has fewer tokens than TOON's best. A tie is not fewer. */
  underToon: z.number().int().nonnegative(),
  /** Seeds where Terset has fewer tokens than compact JSON. A tie is not fewer. */
  underJson: z.number().int().nonnegative(),
  vsJson: SpreadSchema,
  vsToon: SpreadSchema,
});

export const SeedSweepSchema = z
  .strictObject({
    tokenizer: z.string().min(1),
    toonVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
    /** The first seed. Seeds run from firstSeed to firstSeed + seeds - 1. */
    firstSeed: z.number().int().nonnegative(),
    seeds: Seeds,
    cases: z.array(SweepCaseSchema).min(1),
  })
  .refine((file) => file.cases.every((row) => row.underToon <= file.seeds && row.underJson <= file.seeds), 'A case cannot win on more seeds than were run');

export type Spread = z.infer<typeof SpreadSchema>;
export type SweepCase = z.infer<typeof SweepCaseSchema>;
export type SeedSweep = z.infer<typeof SeedSweepSchema>;
