// The generated sample texts. Pages read samples from here.
import raw from '../generated/samples.json' with { type: 'json' };
import type { GeneratedSamples, SampleText } from './generated-schema.ts';

/** Typed without zod, so the browser skips it. data-check.ts proves it against GeneratedSamplesSchema. */
export const GENERATED = raw as GeneratedSamples;
export const ORDERS_TEXT: SampleText = GENERATED.samples.orders;
export const FACTS = GENERATED.facts;
