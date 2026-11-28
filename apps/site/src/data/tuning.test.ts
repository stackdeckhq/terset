// The tuning notes say what the rules line was tuned on, with counts from the data.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import { TUNING_DETAIL, TUNING_NOTE } from './tuning.ts';

describe('tuning notes', () => {
  it('puts the full note in benchmark.md', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    expect(text).toContain(TUNING_DETAIL);
    expect(TUNING_DETAIL).toContain('not independent checks');
    expect(TUNING_DETAIL).toContain('questions were frozen on 2026-11-17 before any model call');
    expect(TUNING_DETAIL).toContain('not a held-out check of format 1.1');
  });

  it('gives the short tuning note the same facts, with counts from the data, in benchmark.md too', () => {
    expect(TUNING_NOTE).toBe(
      'The rules line was tuned with the 11 sample case shapes and the TOON question set behind this 244-question test in view. So these results are not independent checks of it. The stress questions were frozen on 2026-11-17 before any model call. Format 1.1 came after that. Its named cells were designed to fix sparse-record misses seen in an earlier stress run, and were checked on new data from the same stress generator. So the stress test is not a held-out check of format 1.1. Terset tied for the top score on two of the three models and was one answer behind TOON on Claude Opus 5.5. The Terset 1.1 runs on the real files used the same encoder and rules.',
    );
    // Each fact is the full note's, or one the frozen data folders record in their own README.
    expect(TUNING_DETAIL).toContain('the TOON question set in view');
    expect(TUNING_DETAIL).toContain('questions were frozen on 2026-11-17 before any model call');
    expect(readFileSync(new URL('../../../../bench/data/stress/README.md', import.meta.url), 'utf8')).toContain('Questions were frozen before any model call.');
    expect(readFileSync(new URL('../../../../bench/data/real/README.md', import.meta.url), 'utf8').replace(/\s+/gu, ' ')).toContain('tuned the Terset encoder or its rules line on them');
    expect(benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE)).toContain(TUNING_NOTE);
  });
});
