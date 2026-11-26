// The converter's output is exactly encode(), and bad input gets a clear status.
import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../data/samples.ts';
import { MAX_CHARS, changedNumbers, convert, promptText, statusOf } from './convert.ts';
import { encode, rulesFor } from './format.ts';

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

describe('numbers JavaScript would change', () => {
  const statusFor = (source: string): string => statusOf(convert(source));
  const detailFor = (source: string): string => {
    const result = convert(source);
    return result.ok ? '' : result.detail;
  };

  it('refuses an integer past the safe range and names it as typed', () => {
    const source = '[{"id":9007199254740993,"name":"Ada"},{"id":2,"name":"Ben"}]';
    expect(statusFor(source)).toBe('Number would round');
    expect(detailFor(source)).toContain('9007199254740993 would become 9007199254740992.');
    expect(detailFor(source)).toContain('"9007199254740993"');
  });

  // 1000000000000000100 is stored as 1000000000000000128, which prints back as 1000000000000000100.
  it('refuses an integer that is stored as another integer even when it prints back the same', () => {
    expect(statusFor('[1000000000000000100]')).toBe('Number would round');
    expect(statusFor('[-1000000000000000100]')).toBe('Number would round');
    expect(statusFor('[9007199254740994]')).toBe('Round trip exact');
    expect(detailFor('[1000000000000000100]')).toContain('1000000000000000100 would become 1000000000000000128.');
  });

  it('refuses a negative one too', () => {
    expect(statusFor('{"n":-9007199254740993}')).toBe('Number would round');
    expect(detailFor('{"n":-9007199254740993}')).toContain('-9007199254740993 would become -9007199254740992.');
  });

  it('finds one nested deep and gives its line', () => {
    const source = JSON.stringify({ a: [{ b: { c: [1, 2, { d: 1 }] } }] }, null, 2).replace('"d": 1', '"d": 12345678901234567890');
    expect(statusFor(source)).toBe('Number would round');
    expect(detailFor(source)).toMatch(/^Line 9: 12345678901234567890 would become 12345678901234567168\./u);
  });

  it('counts the other numbers that change', () => {
    expect(detailFor('[9007199254740993, 9007199254740995, 9007199254740997]')).toContain('2 more numbers change too.');
    expect(detailFor('[9007199254740993, 9007199254740995]')).toContain('1 more number changes too.');
  });

  it('ignores digits inside strings and keys, escaped quotes included', () => {
    const source = '[{"9007199254740993":"9007199254740993","note":"a \\" 9007199254740993 \\\\","id":1}]';
    expect(statusFor(source)).toBe('Round trip exact');
  });

  it('refuses decimals and exponents whose value changes', () => {
    expect(detailFor('[0.10000000000000000001]')).toContain('0.10000000000000000001 would become 0.1.');
    expect(detailFor('[1e-400]')).toContain('1e-400 would become 0.');
    expect(detailFor('[1e400]')).toContain('1e400 is too large for JavaScript.');
    expect(statusFor('[-1e400]')).toBe('Number would round');
  });

  it('keeps numbers that only print differently', () => {
    expect(statusFor('[{"a":1.50,"b":1e2,"c":1E+21,"d":0.000001,"e":2.5e-7,"f":9007199254740992,"g":-12.0}]')).toBe('Round trip exact');
  });

  it('shortens a very long number in the message', () => {
    const long = `1${'0'.repeat(80)}1`;
    expect(detailFor(`[${long}]`)).toContain(`${long.slice(0, 40)}…`);
    expect(detailFor(`[${long}]`)).not.toContain(long);
  });
});

describe('promptText', () => {
  it('puts the fitted rules line, then a newline, then the data', () => {
    const text = encode(SAMPLES.orders);
    const rules = rulesFor(text);
    expect(rules).not.toBe('');
    expect(promptText(text)).toBe(`${rules}\n${text}`);
  });

  it('gives the data alone when no rules fit, with no blank line first', () => {
    const text = encode(SAMPLES.config);
    expect(rulesFor(text)).toBe('');
    expect(promptText(text)).toBe(text);
  });
});

describe('changedNumbers', () => {
  it('returns each changed literal with its line, in order', () => {
    expect(changedNumbers('{\n"a": 9007199254740993,\n"b": [1, 1e400]\n}')).toEqual([
      { literal: '9007199254740993', line: 2, value: 9007199254740992 },
      { literal: '1e400', line: 3, value: Infinity },
    ]);
  });

  it('returns nothing for plain numbers', () => {
    expect(changedNumbers('[1, -2, 3.25, 0, -0, 1e3]')).toEqual([]);
  });

  // The scan runs on the main thread on every paste. Each case is near the 60,000 character cap.
  // A linear scan takes a few milliseconds; the quadratic one took over a second on the first case.
  it.each([
    ['a decimal with a long run of inner zeros', `[1.${'0'.repeat(MAX_CHARS - 6)}1]`],
    ['an integer with a long run of inner zeros', `[1${'0'.repeat(MAX_CHARS - 4)}1]`],
    ['an exponent with a long run of zeros', `[1e${'0'.repeat(MAX_CHARS - 6)}1]`],
    ['one long run of digits', `[${'7'.repeat(MAX_CHARS - 2)}]`],
    ['many short numbers', `[${Array.from({ length: MAX_CHARS / 2 - 1 }, () => '1').join(',')}]`],
    ['many numbers past the safe range', `[${Array.from({ length: MAX_CHARS / 20 }, () => '9007199254740993').join(',')}]`],
    ['a string full of backslashes', `["${'\\\\'.repeat((MAX_CHARS - 4) / 2)}"]`],
  ])('stays fast on %s', (_, source) => {
    expect(source.length).toBeLessThanOrEqual(MAX_CHARS);
    const start = performance.now();
    changedNumbers(source);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
