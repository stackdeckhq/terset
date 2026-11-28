// The chart figures come from the accuracy file, and the losses stay in view.
// The accuracy figures use a small hand-written file; the headline uses the committed counters.
import { describe, expect, it } from 'vitest';
import { ACCURACY_FIXTURE } from './accuracy-fixtures.ts';
import { accuracyOverlapLine } from './accuracy.ts';
import type { AccuracyFile, AccuracyModel } from './accuracy.ts';
import { BENCH, COUNTERS, benchHeadline, counterSummary, underJson, underToon } from './numbers.ts';
import type { CaseRow, Counters } from './numbers.ts';
import { bigNumbers, bigNumbersNote, compare, costBars, costNote, datasetRows, datasetScale, datasetSummary, homeHeadline, proofHeading, proofLines, smallerThanToon } from './proof.ts';

const FIXTURE = ACCURACY_FIXTURE;

function model(file: AccuracyFile, id: string): AccuracyModel {
  const found = file.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

const OPUS = model(FIXTURE, 'claude-opus-5-5');
const SOL = model(FIXTURE, 'gpt-6.1-sol');

/** A copy of the fixture with Opus's keyed data set changed. */
function withOpusKeyed(terset: number): AccuracyFile {
  const copy = structuredClone(FIXTURE);
  const tokens = copy.kinds.find((item) => item.kind === 'keyed')?.models.find((item) => item.id === 'claude-opus-5-5');
  if (tokens === undefined) throw new Error('no keyed tokens');
  tokens.inputTokens = { ...tokens.inputTokens, terset };
  return copy;
}

describe('cost bars', () => {
  it('gives each format its cost at API list price and its run date, Terset first, scaled from zero', () => {
    expect(costBars(FIXTURE, OPUS).map((bar) => [bar.label, bar.costText, bar.runs])).toEqual([
      ['Terset', '$4.80', ['run 2099-01-01']],
      ['Compact JSON', '$6.80', ['run 2099-01-01']],
      ['Pretty JSON', '$8.80', ['run 2099-01-01']],
      ['TOON', '$5.60', ['run 2099-01-01']],
    ]);
    expect(costBars(FIXTURE, SOL).map((bar) => [bar.label, bar.costText])).toEqual([
      ['Terset', '$1.80'],
      ['Compact JSON', '$2.40'],
      ['Pretty JSON', '$3.40'],
      ['TOON', '$2.20'],
    ]);
    expect(costBars(FIXTURE, SOL)[0]?.terset).toBe(true);
    for (const bars of [costBars(FIXTURE, OPUS), costBars(FIXTURE, SOL)]) {
      expect(Math.max(...bars.map((bar) => bar.fraction))).toBe(1);
      expect(bars.every((bar) => bar.fraction > 0)).toBe(true);
    }
  });

  it('throws for a model with no published run', () => {
    expect(() => costBars({ ...FIXTURE, publishedRuns: [] }, OPUS)).toThrow('No published run for claude-opus-5-5');
  });
});

describe('big numbers', () => {
  it('shows fewer tokens, lower cost and the range of right answers across every format per model', () => {
    expect(bigNumbers(FIXTURE).map((item) => [item.id, item.values.map((value) => `${value.model} ${value.text}`), item.win])).toEqual([
      ['tokens', ['Opus 33.3%', 'Sol 27.3%'], true],
      ['cost', ['Opus 29.4%', 'Sol 25.0%'], true],
      ['answers', ['Opus 241 to 243 of 244', 'Sol 236 to 242 of 244'], false],
    ]);
    expect(bigNumbers(FIXTURE)[2]?.label).toBe('right answers across all four formats');
  });

  it('splits each value into a large figure and a quiet tail that join back into the text', () => {
    for (const item of bigNumbers(FIXTURE)) for (const value of item.values) expect(`${value.figure}${value.tail}`).toBe(value.text);
    expect(bigNumbers(FIXTURE)[2]?.values.map((value) => [value.figure, value.tail])).toEqual([
      ['241 to 243', ' of 244'],
      ['236 to 242', ' of 244'],
    ]);
  });

  it('heads the cards with the question count from the data', () => {
    expect(proofHeading(FIXTURE)).toBe('Fewer tokens on the 244-question test');
    expect(proofHeading({ ...FIXTURE, questions: 1200 })).toBe('Fewer tokens on the 1,200-question test');
  });

  it('says the accuracy ranges overlap, that this proves no equal accuracy, and throws once they stop overlapping', () => {
    expect(accuracyOverlapLine(FIXTURE)).toBe('The 95% accuracy ranges of all four formats overlap on both models. That does not prove the formats are equally accurate.');
    const copy = structuredClone(FIXTURE) as AccuracyFile & { models: { rows: { low: number; high: number }[] }[] };
    const first = copy.models[0]?.rows[0];
    if (first === undefined) throw new Error('no row');
    first.low = 0.999;
    first.high = 1;
    expect(() => accuracyOverlapLine(copy)).toThrow(/every interval overlaps/u);
  });

  it('names the tokenizer behind each model and how its input tokens were counted', () => {
    expect(bigNumbersNote(FIXTURE)).toBe('Input tokens: Claude Opus 5.5 on the Claude tokenizer, GPT 6.1 Sol on the OpenAI tokenizer. Input tokens are as each model reported them.');
  });

  it('says cost is at API list price with the price read date', () => {
    expect(costNote(FIXTURE)).toBe('Cost for all 244 questions at API list price: input and output tokens times list prices read on 2026-11-17.');
  });

  it('refuses to print when Terset no longer costs less than compact JSON', () => {
    const copy = structuredClone(FIXTURE) as AccuracyFile & { models: { rows: { totalCost: number }[] }[] };
    const row = copy.models[0]?.rows[0];
    if (row === undefined) throw new Error('no row');
    row.totalCost = 100;
    expect(() => bigNumbers(copy)).toThrow(/cheaper than compact JSON/u);
  });
});

describe('data sets', () => {
  it('lists every data set for each model, against TOON and compact JSON', () => {
    expect(datasetRows(FIXTURE, OPUS).map((row) => [row.kind, row.questions, row.vsToon.text, row.vsJson.text])).toEqual([
      ['tabular', 41, '−7.7%', '−40.0%'],
      ['nested-group', 18, '−6.3%', '−40.0%'],
      ['keyed', 17, '−9.1%', '−44.4%'],
    ]);
    expect(datasetRows(FIXTURE, SOL)).toHaveLength(3);
  });

  it('shows a loss against compact JSON plainly, on the one model that has it', () => {
    const file = withOpusKeyed(190);
    const loss = (item: AccuracyModel) => datasetRows(file, item).filter((row) => row.vsJson.verdict === 'more').map((row) => [row.kind, row.vsJson.text]);
    expect(loss(model(file, 'claude-opus-5-5'))).toEqual([['keyed', '+5.6%']]);
    expect(loss(model(file, 'gpt-6.1-sol'))).toEqual([]);
  });

  it('says the result per model in one line', () => {
    expect(datasetSummary(datasetRows(FIXTURE, OPUS))).toBe('Fewer tokens than TOON on 3 of 3. Fewer than compact JSON on 3 of 3.');
    const file = withOpusKeyed(190);
    expect(datasetSummary(datasetRows(file, model(file, 'claude-opus-5-5')))).toBe('Fewer tokens than TOON on 2 of 3 (1 more). Fewer than compact JSON on 2 of 3 (1 more).');
  });

  it('shares one scale from zero, wide enough for the largest saving and loss', () => {
    // Keyed data saves 44.4% against compact JSON, so the scale rounds up to 45%. With no loss, it keeps one 5% step.
    expect(datasetScale(FIXTURE).save).toBeCloseTo(0.45, 9);
    expect(datasetScale(FIXTURE).lose).toBeCloseTo(0.05, 9);
    // A 72.7% loss against TOON rounds up to 75%.
    expect(datasetScale(withOpusKeyed(190)).lose).toBeCloseTo(0.75, 9);
  });

  it('calls a gap under half a percent a tie', () => {
    expect(compare(1004, 1000).verdict).toBe('tie');
    expect(compare(1006, 1000)).toMatchObject({ verdict: 'more', text: '+0.6%' });
    expect(compare(600, 1000)).toMatchObject({ verdict: 'fewer', text: '−40.0%' });
  });
});

describe('smaller than TOON', () => {
  it('counts the 11 sample cases and every Sol data set, on the OpenAI tokenizer', () => {
    // 9 of the 11 committed sample cases, and 3 of the 3 fixture data sets.
    expect(smallerThanToon(FIXTURE, COUNTERS)).toMatchObject({ smaller: 12, total: 14, text: 'Smaller than TOON on 12 of 14 data sets', tokenizer: 'OpenAI tokenizer' });
  });

  it('gives nothing while the bench is pending', () => {
    expect(smallerThanToon(FIXTURE, null)).toBeNull();
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
    expect(underToon(counters.o200k)).toBe(9);
    expect(homeHeadline(BENCH, counters)).toEqual({
      title: 'Fewer tokens than TOON in 9 of 11 cases.',
      tag: 'OpenAI tokenizer',
      line: `Fewer than compact JSON in ${String(underJson(counters.o200k))} of ${String(total)}.`,
    });
    expect(homeHeadline(BENCH, counters).line).toBe('Fewer than compact JSON in 10 of 11.');
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
    expect(underToon(claude)).toBe(10);
    expect(homeHeadline(BENCH, counters, 'claude')).toEqual({
      title: `Fewer tokens than TOON in ${String(underToon(claude))} of ${String(claude.cases.length)} cases.`,
      tag: `${claude.label}, Terset 1.1`,
      line: `Fewer than compact JSON in ${String(underJson(claude))} of ${String(claude.cases.length)}.`,
    });
    expect(homeHeadline(BENCH, counters, 'claude')).toEqual({ title: 'Fewer tokens than TOON in 10 of 11 cases.', tag: 'Claude Opus 5.5, Terset 1.1', line: 'Fewer than compact JSON in 10 of 11.' });
  });

  it('keeps a tie with TOON out of the Claude count', () => {
    const claude = ready().claude;
    if (claude === null) throw new Error('the Claude file is pending');
    const tied = claude.cases.map((row) => (row.name === '200 users' ? { ...row, toon: row.terset } : row));
    expect(homeHeadline(BENCH, ready(), 'claude').title).toBe('Fewer tokens than TOON in 10 of 11 cases.');
    expect(homeHeadline(BENCH, { ...ready(), claude: { ...claude, cases: tied } }, 'claude').title).toBe('Fewer tokens than TOON in 9 of 11 cases.');
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

  it('states one more TOON loss as measured instead of hiding it', () => {
    expect(homeHeadline(BENCH, withCase('200 users', (row) => ({ ...row, toon: row.terset }))).title).toBe('Fewer tokens than TOON in 8 of 11 cases.');
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
  // Accuracy is left to the overlap line that follows these lines, so nothing here calls it a tie.
  it('states each claim with its tokenizer and leaves accuracy to the overlap line', () => {
    expect(proofLines(FIXTURE, COUNTERS)).toEqual([
      'Fewer input tokens than compact JSON: 33.3% on Opus and 27.3% on Sol. Each model counts with its own tokenizer.',
      'Lower cost than compact JSON: 29.4% on Opus and 25.0% on Sol.',
      'Smaller than TOON on 12 of 14 data sets (OpenAI tokenizer). The 11 offline sample cases use Terset 1.2 on o200k_base. The 3 benchmark data sets use Terset 1.1 as GPT 6.1 Sol reported them.',
      'Claude Opus 5.5 (Claude tokenizer): Fewer tokens than TOON on 3 of 3. Fewer than compact JSON on 3 of 3.',
      'GPT 6.1 Sol (OpenAI tokenizer): Fewer tokens than TOON on 3 of 3. Fewer than compact JSON on 3 of 3.',
    ]);
  });
});
