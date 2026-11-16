// The shape of the input list prices in prices.ts. Strict, so a stray or missing field fails loudly.
import { z } from 'zod';

const PriceSchema = z.strictObject({
  /** The model the price is for, as the vendor names it. */
  model: z.string().min(1),
  /** The counter the token counts come from: a tokenizer name or a model id. */
  counter: z.string().min(1),
  /** US dollars per one million input tokens, at list price. */
  usdPerMillionInput: z.number().positive(),
  /** A condition the price holds under, in a few words. */
  condition: z.string().min(1).nullable(),
  source: z.url({ protocol: /^https$/u }),
});

export const PricesSchema = z.strictObject({
  /** The day both pricing pages were read, UTC. */
  readOn: z.iso.date(),
  /** Priced against the o200k_base counts. */
  o200k: PriceSchema,
  /** Priced against the Claude counts. */
  claude: PriceSchema,
});

export type Price = z.infer<typeof PriceSchema>;
export type Prices = z.infer<typeof PricesSchema>;
