import raw from './real-accuracy-results.json' with { type: 'json' };
import { RealAccuracyFileSchema } from './real-accuracy-schema.ts';

export type { RealAccuracyFile } from './real-accuracy-schema.ts';

export const REAL_ACCURACY = RealAccuracyFileSchema.parse(raw);
