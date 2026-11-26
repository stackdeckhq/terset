// The copy buttons copy only the result on screen for what was typed: never an older result
// while the input waits to settle, and nothing after a refused input.
import { describe, expect, it } from 'vitest';
import { convert } from '../../lib/convert.ts';
import { copyable } from './StepConvert.tsx';

describe('copyable', () => {
  const ok = '{"review":"custom input"}';
  const result = convert(ok);

  it('gives the encoded text once the input has settled and converted', () => {
    expect(result.ok).toBe(true);
    if (result.ok) expect(copyable(ok, ok, result)).toBe(result.text);
  });

  it('gives nothing while newer input waits for the timer', () => {
    expect(copyable(`${ok} `, ok, result)).toBeNull();
  });

  it('gives nothing after a refused input', () => {
    const refused = '[9007199254740993]';
    expect(copyable(refused, refused, convert(refused))).toBeNull();
  });
});
