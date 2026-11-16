// Short labels in narrow columns must not leave one word alone on the last line.
// "pretty" wrapping does not fix a three-word label. Balance fixes some; where Chrome
// keeps the lone word even with balance, a no-break space holds the last two words.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

/** The selectors listed in base.css rules that set text-wrap-style: balance. */
function balanced(): readonly string[] {
  const rules = [...read('./base.css').matchAll(/([^{}]+)\{[^}]*text-wrap-style:\s*balance[^}]*\}/gu)];
  return rules.flatMap((rule) =>
    (rule[1] ?? '')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .split(',')
      .map((selector) => selector.trim()),
  );
}

describe('short labels keep their last word company', () => {
  it('balances the data set labels, so "Structure: width mismatch" breaks after the colon', () => {
    expect(balanced()).toContain('.ds-l');
  });

  it.each([
    // The 390 px home trio.
    ['../components/home/StepBench.tsx', '<span>Terset, rules&nbsp;included</span>'],
    ['../components/home/StepBench.tsx', '<span>TOON, best&nbsp;variant</span>'],
    // The empty round trip panel at 1440 px.
    ['../components/home/StepRoundTrip.tsx', '<b>Waiting for&nbsp;decode()</b>'],
  ])('%s holds "%s" together', (path, label) => {
    expect(read(path)).toContain(label);
  });
});
