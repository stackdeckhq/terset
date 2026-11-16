// The shape of src/generated/sizes.json: token sizes of the raw agent files and
// the agent prompt, counted with o200k_base by scripts/build-llms.ts.
// Strict, so a stale or hand-edited file fails loudly.
import { z } from 'zod';

const Count = z.number().int().nonnegative();

export const SizesSchema = z
  .object({
    tokenizer: z.literal('o200k_base'),
    prompt: Count,
    files: z
      .object({
        '/agents.md': Count,
        '/docs.md': Count,
        '/spec.md': Count,
        '/benchmark.md': Count,
        '/llms.txt': Count,
        '/llms-full.txt': Count,
        '/skill/SKILL.md': Count,
      })
      .strict(),
  })
  .strict();

export type Sizes = z.infer<typeof SizesSchema>;
