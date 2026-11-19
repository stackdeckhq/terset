// The worked example shows only what the encoder writes, and its prompt keeps the
// layout the accuracy bench sends. A change to either one fails here.
import { describe, expect, it } from 'vitest';
import { makePrompt } from '../../../../bench/src/formats.ts';
import { questionSchema } from '../../../../bench/src/schema.ts';
import { decode, encode, rulesFor } from '../lib/format.ts';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { BENCH, CLAUDE } from './numbers.ts';
import { WORKED_EXAMPLE } from './worked-example.ts';

describe('worked example', () => {
  it('shows the text encode writes and the rules line rulesFor fits to it', () => {
    expect(WORKED_EXAMPLE.json).toBe(JSON.stringify(WORKED_EXAMPLE.input));
    expect(WORKED_EXAMPLE.terset).toBe(encode(WORKED_EXAMPLE.input));
    expect(WORKED_EXAMPLE.rules).toBe(rulesFor(WORKED_EXAMPLE.terset));
    expect(WORKED_EXAMPLE.rules).not.toBe('');
  });

  it('has a record with a missing field, so named cells show and that row has no role cell', () => {
    const lines = WORKED_EXAMPLE.terset.split('\n');
    expect(lines).toContain('id\tname\tname=value');
    expect(lines.find((line) => line.startsWith('u4\t'))).not.toContain('role=');
  });

  it('decodes back to the input, key order included', () => {
    const decoded = decode(WORKED_EXAMPLE.terset);
    expect(decoded).toEqual(WORKED_EXAMPLE.input);
    expect(JSON.stringify(decoded)).toBe(WORKED_EXAMPLE.json);
  });

  it('builds the prompt the accuracy bench sends', () => {
    const question = questionSchema.parse({ id: 'worked-example', prompt: WORKED_EXAMPLE.question, groundTruth: '3', type: 'aggregation', dataset: 'worked-example', answerType: 'integer' });
    expect(WORKED_EXAMPLE.prompt).toEqual(makePrompt(question, 'terset', WORKED_EXAMPLE.terset));
  });

  it('puts the example in benchmark.md before the first results table', () => {
    const text = benchmarkMarkdown(BENCH, CLAUDE);
    const firstTable = text.search(/^\| /mu);
    expect(firstTable).toBeGreaterThan(0);
    for (const shown of [WORKED_EXAMPLE.json, WORKED_EXAMPLE.terset, WORKED_EXAMPLE.rules, WORKED_EXAMPLE.prompt.system, WORKED_EXAMPLE.prompt.user]) {
      const at = text.indexOf(shown);
      expect(at, shown.slice(0, 40)).toBeGreaterThan(0);
      expect(at, shown.slice(0, 40)).toBeLessThan(firstTable);
    }
  });
});
