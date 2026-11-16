// The converter's output is exactly encode(), and bad input gets a clear status.
import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../data/samples.ts';
import { convert } from './convert.ts';
import { encode } from './format.ts';

describe('convert', () => {
  it('returns encode() output that round trips', () => {
    const result = convert(JSON.stringify(SAMPLES.orders));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(encode(SAMPLES.orders));
    expect(result.roundTrip).toBe(true);
  });

  it('handles 200 rows', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `r${String(i)}`, n: i, ok: i % 2 === 0 }));
    const result = convert(JSON.stringify({ rows }));
    expect(result.ok && result.roundTrip).toBe(true);
  });

  it('encodes a root array of records as a table', () => {
    const rows = [{ id: 'a1', n: 1 }, { id: 'a2', n: 2 }, { id: 'a3', n: 3 }];
    const result = convert(JSON.stringify(rows));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(encode(rows));
    expect(result.text.split('\n').slice(0, 2)).toEqual(['[3]', 'id\tn']);
    expect(result.roundTrip).toBe(true);
  });

  it('explains broken JSON and a scalar root', () => {
    const broken = convert('{"rows": [');
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.status).toBe('Waiting for valid JSON');
    const scalar = convert('42');
    expect(scalar.ok).toBe(false);
    if (!scalar.ok) expect(scalar.status).toBe('Needs an object or array');
  });
});
