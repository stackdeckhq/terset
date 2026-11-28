import raw from './weather-12-accuracy-results.json' with { type: 'json' };
import type { Weather12AccuracyFile } from './weather-12-accuracy-schema.ts';

export type { Weather12AccuracyFile };

/** The generator and data-check.ts validate the file without loading zod in the browser. */
export const WEATHER_12_ACCURACY = raw as Weather12AccuracyFile;
