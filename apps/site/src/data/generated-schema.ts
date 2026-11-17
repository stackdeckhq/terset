// The shape of src/generated/samples.json. Strict, so a stale or hand-edited file fails loudly.
import { z } from 'zod';

const SampleTextSchema = z.strictObject({
  pretty: z.string().min(1),
  compact: z.string().min(1),
  terset: z.string().min(1),
  rules: z.string(),
  rulesTokens: z.number().int().nonnegative(),
  toon: z.string().min(1),
  roundTrip: z.literal(true),
});

const DocExampleSchema = z.strictObject({ json: z.string().min(1), terset: z.string().min(1) });

/** One cheat sheet row on /docs: pretty JSON next to the encoder's output. */
const CheatRowSchema = z.strictObject({ id: z.string().min(1), json: z.string().min(1), terset: z.string().min(1) });

export const GeneratedSamplesSchema = z.strictObject({
  rules: z.string().min(1),
  samples: z.strictObject({ orders: SampleTextSchema, servers: SampleTextSchema, config: SampleTextSchema }),
  docExamples: z.strictObject({ users: DocExampleSchema, shipments: DocExampleSchema, rows: DocExampleSchema }),
  cheatSheet: z.array(CheatRowSchema).min(1),
  facts: z.strictObject({ fuzzObjects: z.number().int().positive(), runtimeDependencies: z.number().int().nonnegative() }),
});

export type GeneratedSamples = z.infer<typeof GeneratedSamplesSchema>;
export type SampleText = z.infer<typeof SampleTextSchema>;
export type CheatRow = z.infer<typeof CheatRowSchema>;
