import raw from './real-accuracy-results.json' with { type: 'json' };
import type { RealAccuracyFile } from './real-accuracy-schema.ts';

export type { RealAccuracyFile };

/** Typed without zod, so the browser skips it. data-check.ts proves it against RealAccuracyFileSchema. */
export const REAL_ACCURACY = raw as RealAccuracyFile;
