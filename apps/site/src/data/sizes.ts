// Token sizes of the raw agent files and the agent prompt.
import raw from '../generated/sizes.json' with { type: 'json' };
import type { Sizes } from './sizes-schema.ts';

/** Typed without zod, so the browser skips it. data-check.ts proves it against SizesSchema. */
export const SIZES = raw as Sizes;
