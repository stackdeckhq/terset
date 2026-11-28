import raw from './real-400-accuracy-results.json' with { type: 'json' };
import type { Real400AccuracyFile } from './real-400-accuracy-schema.ts';

export type { Real400AccuracyFile };

/** The generator and data-check.ts validate this file without loading zod in the browser. */
export const REAL_400_ACCURACY = raw as Real400AccuracyFile;
