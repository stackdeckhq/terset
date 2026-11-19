// The live token count in the converter. It loads o200k_base on the first click and
// counts the way the bench does: compact JSON alone, and Terset text plus its fitted
// rules line, each counted on its own and summed. For the three samples it must equal
// the published counts, so the live view never disagrees with the page.
import { describe, expect, it } from 'vitest';
import { GENERATED } from '../data/generated.ts';
import { BENCH_FILE } from '../data/numbers.ts';
import { SAMPLE_IDS } from '../data/samples.ts';
import { convert } from './convert.ts';
import { rulesFor } from './format.ts';
import { LIVE_TOKENIZER, countTokens, liveTokens, tokenPieces } from './tokens.ts';

describe('live token counts', () => {
  it('counts with o200k_base, the tokenizer the bench file names', () => {
    if (BENCH_FILE.status !== 'ready') throw new Error('the committed bench file should be ready');
    expect(LIVE_TOKENIZER).toBe(BENCH_FILE.tokenizer);
  });

  for (const id of SAMPLE_IDS) {
    it(`gives the published o200k_base counts for the ${id} sample, rules line included`, () => {
      if (BENCH_FILE.status !== 'ready') throw new Error('the committed bench file should be ready');
      const result = convert(GENERATED.samples[id].pretty);
      if (!result.ok) throw new Error(`the ${id} sample should convert`);
      const live = liveTokens(result.value, result.text);
      expect(live.json.count).toBe(BENCH_FILE.samples[id].json);
      expect(live.terset.count).toBe(BENCH_FILE.samples[id].terset);
      expect(live.terset.count).toBe(countTokens(result.text) + countTokens(rulesFor(result.text)));
    });
  }

  it('splits the text into one piece per token that join back to the text', () => {
    const result = convert(GENERATED.samples.orders.pretty);
    if (!result.ok) throw new Error('the orders sample should convert');
    const live = liveTokens(result.value, result.text);
    expect(live.json.pieces.join('')).toBe(JSON.stringify(result.value));
    expect(live.json.pieces).toHaveLength(live.json.count);
    expect(live.terset.rules.join('')).toBe(rulesFor(result.text));
    expect(live.terset.text.join('')).toBe(result.text);
    expect(live.terset.rules.length + live.terset.text.length).toBe(live.terset.count);
  });

  it('keeps a character that spans two tokens whole', () => {
    const text = 'Lisboa 日本語 parâmetros 🎉🎉 ok';
    const pieces = tokenPieces(text);
    expect(pieces.join('')).toBe(text);
    expect(pieces.some((piece) => piece.includes('�'))).toBe(false);
  });

  it('gives no pieces for empty text', () => {
    expect(tokenPieces('')).toEqual([]);
  });
});
