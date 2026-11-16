// The chart figures match the published runs, and the losses stay in view.
import { describe, expect, it } from 'vitest';
import { ACCURACY } from './accuracy.ts';
import type { AccuracyFile, AccuracyModel } from './accuracy.ts';
import { BENCH, COUNTERS, benchHeadline, counterSummary, underJson, underToon } from './numbers.ts';
import type { CaseRow, Counters } from './numbers.ts';
import { bigNumbers, bigNumbersNote, compare, costBars, costNote, datasetRows, datasetScale, datasetSummary, homeHeadline, proofLines, smallerThanToon } from './proof.ts';

function model(id: string): AccuracyModel {
  const found = ACCURACY.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

const OPUS = model('claude-opus-5-5');
const SOL = model('gpt-6.1-sol');

describe('cost bars', () => {
  it('gives each format its cost at API list price and run date, Terset first, scaled from zero', () => {
    expect(costBars(OPUS).map((bar) => [bar.label, bar.costText, bar.runOn])).toEqual([
      ['Terset', '$5.69', '2026-11-13'],
      ['Compact JSON', '$8.04', '2026-11-12'],
      ['Pretty JSON', '$10.20', '2026-11-12'],
      ['TOON', '$6.35', '2026-11-12'],
    ]);
    expect(costBars(SOL)[0]).toMatchObject({ costText: '$1.85', runOn: '2026-11-13', terset: true });
    for (const bars of [costBars(OPUS), costBars(SOL)]) {
      expect(Math.max(...bars.map((bar) => bar.fraction))).toBe(1);
      expect(bars.every((bar) => bar.fraction > 0)).toBe(true);
    }
  });
});

describe('big numbers', () => {
  it('shows fewer tokens, lower cost and right answers per model', () => {
    expect(bigNumbers(ACCURACY).map((item) => [item.id, item.values.map((value) => `${value.model} ${value.text}`), item.win])).toEqual([
      ['tokens', ['Opus 32.0%', 'Sol 26.7%'], true],
      ['cost', ['Opus 29.2%', 'Sol 25.8%'], true],
      ['answers', ['Opus 243/244', 'Sol 241/244'], false],
    ]);
    expect(bigNumbers(ACCURACY)[2]?.label).toBe('right answers');
  });

  it('splits each value into a large figure and a quiet tail that join back into the text', () => {
    for (const item of bigNumbers(ACCURACY)) for (const value of item.values) expect(`${value.figure}${value.tail}`).toBe(value.text);
    expect(bigNumbers(ACCURACY)[2]?.values.map((value) => [value.figure, value.tail])).toEqual([
      ['243', '/244'],
      ['241', '/244'],
    ]);
  });

  it('names the tokenizer behind each model and how its input tokens were counted', () => {
    expect(bigNumbersNote(ACCURACY)).toBe("Input tokens: Claude Opus 5.5 on the Claude tokenizer, GPT 6.1 Sol on the OpenAI tokenizer. Claude Opus 5.5 input tokens were counted with Anthropic's token counting endpoint over the exact request; GPT 6.1 Sol input tokens are as the model reported them.");
  });

  it('says cost is at API list price with the price read date', () => {
    expect(costNote(ACCURACY)).toBe('Cost for all 244 questions at API list price: input and output tokens times list prices read on 2026-11-12.');
  });

  it('refuses to print when Terset no longer costs less than compact JSON', () => {
    const copy = structuredClone(ACCURACY) as AccuracyFile & { models: { rows: { totalCost: number }[] }[] };
    const row = copy.models[0]?.rows[0];
    if (row === undefined) throw new Error('no row');
    row.totalCost = 100;
    expect(() => bigNumbers(copy)).toThrow(/cheaper than compact JSON/u);
  });
});

describe('data sets', () => {
  it('lists all 13 data sets for each model', () => {
    expect(datasetRows(ACCURACY, OPUS)).toHaveLength(13);
    expect(datasetRows(ACCURACY, SOL)).toHaveLength(13);
  });

  it('puts Terset under TOON on 13 of 13 for Sol and 12 of 13 for Opus, with nested config a tie', () => {
    expect(datasetRows(ACCURACY, SOL).every((row) => row.vsToon.verdict === 'fewer')).toBe(true);
    const opus = datasetRows(ACCURACY, OPUS);
    expect(opus.filter((row) => row.vsToon.verdict === 'fewer')).toHaveLength(12);
    const config = opus.find((row) => row.kind === 'nested-config');
    expect(config?.terset).toBe(config === undefined ? 0 : config.toon + 29);
    expect(config?.vsToon).toMatchObject({ verdict: 'tie', text: 'Tie' });
  });

  it('shows the nested config loss against compact JSON plainly on both models', () => {
    const loss = (item: AccuracyModel) => datasetRows(ACCURACY, item).filter((row) => row.vsJson.verdict === 'more').map((row) => [row.kind, row.vsJson.text]);
    expect(loss(OPUS)).toEqual([['nested-config', '+5.1%']]);
    expect(loss(SOL)).toEqual([['nested-config', '+8.8%']]);
  });

  it('sums the data sets to each model total', () => {
    for (const item of [OPUS, SOL]) {
      const rows = datasetRows(ACCURACY, item);
      expect(rows.reduce((sum, row) => sum + row.terset, 0)).toBe(item.rows[0]?.inputTokens);
      expect(rows.reduce((sum, row) => sum + row.questions, 0)).toBe(ACCURACY.questions);
    }
  });

  it('says the result per model in one line', () => {
    expect(datasetSummary(datasetRows(ACCURACY, OPUS))).toBe('Fewer tokens than TOON on 12 of 13 (1 tie). Fewer than compact JSON on 12 of 13 (1 more).');
    expect(datasetSummary(datasetRows(ACCURACY, SOL))).toBe('Fewer tokens than TOON on 13 of 13. Fewer than compact JSON on 12 of 13 (1 more).');
  });

  it('shares one scale from zero, wide enough for the largest saving and loss', () => {
    const scale = datasetScale(ACCURACY);
    // Analytics on Opus saves 50.7% against compact JSON, so the scale rounds up to 55%.
    expect(scale.save).toBeCloseTo(0.55, 9);
    expect(scale.lose).toBeCloseTo(0.1, 9);
  });

  it('calls a gap under half a percent a tie', () => {
    expect(compare(1004, 1000).verdict).toBe('tie');
    expect(compare(1006, 1000)).toMatchObject({ verdict: 'more', text: '+0.6%' });
    expect(compare(600, 1000)).toMatchObject({ verdict: 'fewer', text: '−40.0%' });
  });
});

describe('smaller than TOON', () => {
  it('counts the 11 sample cases and Sol on all 13 data sets, on the OpenAI tokenizer', () => {
    expect(smallerThanToon(ACCURACY, COUNTERS)).toMatchObject({ smaller: 24, total: 24, text: 'Smaller than TOON on 24 of 24 data sets', tokenizer: 'OpenAI tokenizer' });
  });

  it('gives nothing while the bench is pending', () => {
    expect(smallerThanToon(ACCURACY, null)).toBeNull();
  });
});

describe('home headline', () => {
  function ready(): Counters {
    if (COUNTERS === null) throw new Error('the bench file is pending');
    return COUNTERS;
  }

  /** The counters with one o200k_base case changed. */
  function withCase(name: string, change: (row: CaseRow) => CaseRow): Counters {
    const counters = ready();
    return { ...counters, o200k: { ...counters.o200k, cases: counters.o200k.cases.map((row) => (row.name === name ? change(row) : row)) } };
  }

  it('leads with TOON on the OpenAI tokenizer, then compact JSON on a plain line', () => {
    const counters = ready();
    const total = counters.o200k.cases.length;
    expect(underToon(counters.o200k)).toBe(total);
    expect(homeHeadline(BENCH, counters)).toEqual({
      title: 'Fewer tokens than TOON in 11 of 11 cases.',
      tag: 'OpenAI tokenizer',
      line: `Fewer than compact JSON in ${String(underJson(counters.o200k))} of ${String(total)}.`,
    });
    expect(homeHeadline(BENCH, counters).line).toBe('Fewer than compact JSON in 9 of 11.');
  });

  it('never says "on both counters" and claims nothing about answers', () => {
    for (const id of ['o200k', 'claude'] as const) {
      const { title, line } = homeHeadline(BENCH, ready(), id);
      for (const text of [title, line ?? '']) {
        expect(text).not.toMatch(/both counters|answer|accura|better/iu);
      }
    }
  });

  it('gives the Claude tab its own counts and its own tag', () => {
    const counters = ready();
    const claude = counters.claude;
    if (claude === null) throw new Error('the Claude file is pending');
    expect(counterSummary(claude)).toContain(`under TOON's best in ${String(underToon(claude))} of 11 cases`);
    expect(underToon(claude)).toBe(6);
    expect(homeHeadline(BENCH, counters, 'claude')).toEqual({
      title: `Fewer tokens than TOON in ${String(underToon(claude))} of ${String(claude.cases.length)} cases.`,
      tag: claude.label,
      line: `Fewer than compact JSON in ${String(underJson(claude))} of ${String(claude.cases.length)}.`,
    });
    expect(homeHeadline(BENCH, counters, 'claude')).toEqual({ title: 'Fewer tokens than TOON in 6 of 11 cases.', tag: 'Claude Opus 5.5', line: 'Fewer than compact JSON in 9 of 11.' });
  });

  it('keeps a tie with TOON out of the Claude count', () => {
    const claude = ready().claude;
    if (claude === null) throw new Error('the Claude file is pending');
    const mixed = claude.cases.find((row) => row.name === 'Mixed-type array');
    expect(mixed).toMatchObject({ terset: 189, toon: 189 });
    expect(homeHeadline(BENCH, ready(), 'claude').title).toContain(`in ${String(claude.cases.filter((row) => row.terset < row.toon).length)} of`);
  });

  it('throws for the Claude tab when its counts are pending or compact JSON wins half', () => {
    const counters = ready();
    const claude = counters.claude;
    if (claude === null) throw new Error('the Claude file is pending');
    expect(() => homeHeadline(BENCH, { ...counters, claude: null }, 'claude')).toThrow('Claude counts');
    const flipped = claude.cases.map((row, index) => (index < 6 ? { ...row, json: row.terset - 1 } : row));
    expect(() => homeHeadline(BENCH, { ...counters, claude: { ...claude, cases: flipped } }, 'claude')).toThrow('Claude has it under compact JSON in');
    const lost = claude.cases.map((row) => ({ ...row, toon: row.terset }));
    expect(() => homeHeadline(BENCH, { ...counters, claude: { ...claude, cases: lost } }, 'claude')).toThrow('TOON in 0 of 11');
  });

  it('throws when one case stops being under TOON', () => {
    expect(() => homeHeadline(BENCH, withCase('200 users', (row) => ({ ...row, toon: row.terset })))).toThrow('under TOON in 10 of 11');
  });

  it('throws when compact JSON wins half the cases or more', () => {
    const counters = ready();
    const flipped = counters.o200k.cases.map((row, index) => (index < 6 ? { ...row, json: row.terset - 1 } : row));
    expect(() => homeHeadline(BENCH, { ...counters, o200k: { ...counters.o200k, cases: flipped } })).toThrow('under compact JSON in');
  });

  it('falls back to the plain headline while the numbers are pending', () => {
    expect(homeHeadline(BENCH, null)).toEqual({ title: benchHeadline(BENCH), tag: null, line: null });
  });
});

describe('benchmark.md lines', () => {
  it('states each claim with its tokenizer and says accuracy is a tie', () => {
    expect(proofLines(ACCURACY, COUNTERS)).toEqual([
      'Fewer input tokens than compact JSON: 32.0% on Opus and 26.7% on Sol. Each model counts with its own tokenizer.',
      'Lower cost than compact JSON: 29.2% on Opus and 25.8% on Sol. Accuracy is a tie.',
      'Smaller than TOON on 24 of 24 data sets (OpenAI tokenizer). The 11 sample cases on o200k_base and the 13 benchmark data sets as GPT 6.1 Sol reported them.',
      'Claude Opus 5.5 (Claude tokenizer): Fewer tokens than TOON on 12 of 13 (1 tie). Fewer than compact JSON on 12 of 13 (1 more).',
      'GPT 6.1 Sol (OpenAI tokenizer): Fewer tokens than TOON on 13 of 13. Fewer than compact JSON on 12 of 13 (1 more).',
    ]);
  });
});
