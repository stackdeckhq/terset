// The committed byte sizes match a fresh measurement, and the site line reads them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATASETS } from '../../../bench/src/data.ts';
import { BYTES, bytesLine } from '../src/data/bytes.ts';
import { OUTPUT, buildBytes, byteCount, bytesText, measuredDatasets } from './update-bytes.ts';

describe('plain-text bytes', () => {
  it('keeps the committed file equal to a fresh measurement', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(bytesText());
  });

  it('measures the eight benchmark data sets and leaves out the five structure checks', () => {
    expect(DATASETS).toHaveLength(13);
    expect(measuredDatasets(DATASETS).map((dataset) => dataset.name)).toEqual(['tabular', 'nested', 'analytics', 'github', 'event-logs', 'nested-config', 'keyed', 'nested-group']);
  });

  it('gives the published totals for each format', () => {
    expect(buildBytes(DATASETS).totals).toEqual({
      terset: { raw: 62196, gzip: 25838 },
      toon: { raw: 75238, gzip: 26488 },
      'json-compact': { raw: 104007, gzip: 28142 },
    });
  });

  it('counts UTF-8 bytes, not characters', () => {
    expect(byteCount('é').raw).toBe(2);
    expect(byteCount('ab').raw).toBe(2);
  });

  it('writes the site line from the data file', () => {
    expect(bytesLine(BYTES)).toBe(
      'In plain bytes, with no tokenizer, the 8 benchmark data sets take **62,196** as Terset, 75,238 as TOON and 104,007 as compact JSON. Gzipped: **25,838**, 26,488 and 28,142.',
    );
  });
});
