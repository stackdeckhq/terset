// The stress copy states only what the data supports, checked on a small fixture file.
// The README, the bench README, benchmark.md and the tuning note must match the committed file.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STRESS_FIXTURE } from './accuracy-fixtures.ts';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import {
  STRESS,
  STRESS_DAMAGE_NOTE,
  STRESS_FORMAT_LABELS,
  STRESS_QUOTED_NOTE,
  STRESS_FREEZE_NOTE,
  STRESS_FREEZE_URL,
  STRESS_GROUP_LABELS,
  stressFoldAbout,
  stressGroupRows,
  stressGroups,
  stressHeadlineNote,
  stressHeldOutNote,
  stressKeepElse,
  stressIntro,
  stressLimit,
  stressLimitDetail,
  stressMarkdown,
  stressModel,
  stressPageIntro,
  stressMarkdownHead,
  stressReportsLine,
  stressRow,
  stressRunsNote,
  stressSharedTokensLine,
  stressTableMarks,
  stressTableRows,
} from './stress.ts';
import type { StressAccuracyFile } from './stress.ts';
import { TUNING_DETAIL } from './tuning.ts';

const REPO = new URL('../../../../', import.meta.url);
const FIXTURE = STRESS_FIXTURE;

type SparseAnswer = StressAccuracyFile['models'][number]['rows'][number]['sparseFieldCounts'][number];

/** A copy of the fixture with one change made to it. */
function changed(change: (file: StressAccuracyFile) => void): StressAccuracyFile {
  const copy = structuredClone(FIXTURE);
  change(copy);
  return copy;
}

function haikuTerset(file: StressAccuracyFile): StressAccuracyFile['models'][number]['rows'][number] {
  return stressRow(stressModel(file, 'claude-haiku-5-5'), 'terset');
}

const HEADLINE = "Of Terset's 10 misses across the three models, 9 were on long lists.";
const WEAK_SPOT = 'On Claude Haiku 5.5 it got 24 of 30 long-list questions, where pretty JSON got 27. Its one other miss was a field count on sparse records, on Claude Haiku 5.5.';

/** Sets one model's score in one group and keeps the row total in step. */
function setGroup(file: StressAccuracyFile, model: StressAccuracyFile['models'][number]['id'], format: StressAccuracyFile['models'][number]['rows'][number]['format'], index: number, correct: number): void {
  const row = stressRow(stressModel(file, model), format);
  const group = row.groups[index];
  if (group === undefined) throw new Error('no group');
  row.correct += correct - group.correct;
  group.correct = correct;
}

describe('stress section', () => {
  it('says each model ran once, and throws once a model has more runs or none', () => {
    expect(stressRunsNote(FIXTURE)).toBe('Each model ran once, on 2099-01-01. Each cell is that one run. These runs used Terset 1.1.');
    const [first] = FIXTURE.publishedRuns;
    if (first === undefined) throw new Error('no runs');
    expect(() => stressRunsNote({ ...FIXTURE, publishedRuns: [...FIXTURE.publishedRuns, { ...first, runId: 'again' }] })).toThrow(/no longer supports it/u);
    expect(() => stressRunsNote({ ...FIXTURE, publishedRuns: FIXTURE.publishedRuns.slice(1) })).toThrow(/no longer supports it/u);
  });

  it('pins the one miss outside long lists to a Haiku sparse field count and refuses changed evidence', () => {
    expect(stressLimitDetail(FIXTURE)).toBe(WEAK_SPOT);
    for (const change of [
      (answer: SparseAnswer) => { answer.correct = true; },
      (answer: SparseAnswer) => { answer.dataset = 'messy-other'; },
      (answer: SparseAnswer) => { answer.prompt = 'Count nonempty values.'; },
    ]) {
      const file = changed((copy) => {
        const answer = haikuTerset(copy).sparseFieldCounts[0];
        if (answer === undefined) throw new Error('Missing sparse answer');
        change(answer);
      });
      expect(() => stressLimitDetail(file)).toThrow(/no longer supports it/u);
    }
    const another = changed((copy) => { setGroup(copy, 'gpt-6.1-sol', 'terset', 2, 39); });
    expect(() => stressLimitDetail(another)).toThrow(/Its one other miss/u);
  });

  it('names the one best long-list format on Haiku and refuses a tie or a Terset lead', () => {
    const tie = changed((copy) => { setGroup(copy, 'claude-haiku-5-5', 'json-compact', 0, 27); });
    expect(() => stressLimitDetail(tie)).toThrow(/long-list questions/u);
    const lead = changed((copy) => { setGroup(copy, 'claude-haiku-5-5', 'terset', 0, 28); });
    expect(() => stressLimitDetail(lead)).toThrow(/no longer supports it/u);
  });

  it('says most misses were on long lists only while that holds', () => {
    const spread = changed((copy) => {
      for (const model of copy.models) setGroup(copy, model.id, 'terset', 1, 20);
    });
    expect(() => stressLimit(spread)).toThrow(/were on long lists/u);
  });

  it('says the stress test is not held out for format 1.1, and pins Terset\'s place on every model', () => {
    expect(stressHeldOutNote(FIXTURE)).toBe(
      'The stress questions were frozen on 2026-11-17 before any model call. Format 1.1 came after that. Its named cells were designed to fix sparse-record misses seen in an earlier stress run, and were checked on new data from the same stress generator. So the stress test is not a held-out check of format 1.1. Terset tied for the top score on two of the three models and was one answer behind TOON on Claude Opus 5.5.',
    );
    for (const change of [
      (file: StressAccuracyFile) => { setGroup(file, 'claude-opus-5-5', 'terset', 0, 30); },
      (file: StressAccuracyFile) => { setGroup(file, 'claude-opus-5-5', 'terset', 0, 28); },
      (file: StressAccuracyFile) => { setGroup(file, 'claude-opus-5-5', 'json-pretty', 3, 25); },
      (file: StressAccuracyFile) => { setGroup(file, 'gpt-6.1-sol', 'toon', 0, 29); },
      (file: StressAccuracyFile) => { setGroup(file, 'claude-haiku-5-5', 'terset', 0, 25); },
    ]) {
      expect(() => stressHeldOutNote(changed(change))).toThrow(/no longer supports it/u);
    }
    const differentDate = changed((file) => { file.source.referenceDate = '2026-11-18T00:00:00.000Z'; });
    expect(() => stressHeldOutNote(differentDate)).toThrow(/no longer supports it/u);
    const fewerModels = changed((file) => { file.models.pop(); });
    expect(() => stressHeldOutNote(fewerModels)).toThrow(/no longer supports it/u);
  });

  it('shows every format on every model, Terset first, with the measured scores and tokens', () => {
    expect(stressMarkdownHead(FIXTURE)).toEqual([
      'Format',
      'Claude Opus 5.5, correct',
      'Claude Opus 5.5, input tokens',
      'GPT 6.1 Sol, correct',
      'GPT 6.1 Sol, input tokens',
      'Claude Haiku 5.5, correct',
      'Claude Haiku 5.5, input tokens',
    ]);
    expect(stressTableRows(FIXTURE)).toEqual([
      ['Terset', '119 of 120', '500,000', '118 of 120', '375,000', '113 of 120', '500,000'],
      ['Compact JSON', '116 of 120', '1,000,000', '98 of 120', '750,000', '112 of 120', '1,000,000'],
      ['Pretty JSON', '117 of 120', '1,600,000', '111 of 120', '1,300,000', '112 of 120', '1,600,000'],
      ['TOON', '120 of 120', '560,000', '118 of 120', '460,000', '113 of 120', '560,000'],
    ]);
  });

  it('shows each group on every model, losses included', () => {
    expect(stressGroups(FIXTURE)).toEqual(['scale', 'deep', 'messy', 'damage']);
    expect(stressGroupRows(FIXTURE, 'messy')).toEqual([
      ['Terset', '40 of 40', '40 of 40', '39 of 40'],
      ['Compact JSON', '40 of 40', '40 of 40', '40 of 40'],
      ['Pretty JSON', '40 of 40', '40 of 40', '39 of 40'],
      ['TOON', '40 of 40', '40 of 40', '39 of 40'],
    ]);
    expect(stressGroupRows(FIXTURE, 'damage')).toEqual([
      ['Terset', '25 of 25', '25 of 25', '25 of 25'],
      ['Compact JSON', '22 of 25', '7 of 25', '22 of 25'],
      ['Pretty JSON', '22 of 25', '21 of 25', '22 of 25'],
      ['TOON', '25 of 25', '25 of 25', '25 of 25'],
    ]);
    expect(stressGroupRows(FIXTURE, 'scale').map((row) => row.at(-1))).toEqual(['24 of 30', '26 of 30', '27 of 30', '25 of 30']);
  });

  it('builds every cell from the data, so a changed score changes the table', () => {
    const file = changed((copy) => {
      const terset = haikuTerset(copy);
      const messy = terset.groups[2];
      if (messy === undefined) throw new Error('no Haiku messy score');
      terset.correct = 109;
      messy.correct = 35;
    });
    expect(stressTableRows(file)[0]?.[5]).toBe('109 of 120');
    expect(stressGroupRows(file, 'messy')[0]?.[3]).toBe('35 of 40');
  });

  it('states where Terset missed, in plain words', () => {
    expect(stressLimit(FIXTURE)).toBe(`${HEADLINE} ${WEAK_SPOT}`);
    expect(stressKeepElse(FIXTURE)).toBe('Long lists on Haiku: Terset got 24 of 30 questions, where pretty JSON got 27.');
    const tie = changed((copy) => { setGroup(copy, 'claude-haiku-5-5', 'toon', 0, 27); });
    expect(() => stressKeepElse(tie)).toThrow(/no longer supports it/u);
  });

  it('puts the quote-mark note right under the headline table in benchmark.md, once', () => {
    const blocks = stressMarkdown(FIXTURE);
    const table = blocks.findIndex((block) => block.startsWith('| Format |'));
    expect(blocks[table + 1]).toBe(stressHeadlineNote(FIXTURE));
    expect(blocks[table + 2]).toBe(STRESS_QUOTED_NOTE);
    expect(blocks.filter((block) => block === STRESS_QUOTED_NOTE)).toHaveLength(1);
  });

  it('says the two Claude models reported the same input tokens only while their totals match on every format', () => {
    expect(stressSharedTokensLine(FIXTURE)).toBe('Claude Opus 5.5 and Claude Haiku 5.5 reported the same input tokens on every call, so their token columns match.');
    const split = changed((file) => { haikuTerset(file).inputTokens += 1; });
    expect(() => stressSharedTokensLine(split)).toThrow(/no longer supports it/u);
  });

  it('opens with the suite, the freeze and the run dates', () => {
    expect(stressIntro(FIXTURE)).toBe(
      `Each model answered 120 harder questions in four groups, sent in each of four formats. The questions were fixed before any model call. Each run file records the SHA-256 hashes of the question and dataset files. The publish step refuses a run whose hashes differ from the repo. See the [freeze record](${STRESS_FREEZE_URL}). Each model ran once, on 2099-01-01. Each cell is that one run. These runs used Terset 1.1.`,
    );
    expect(STRESS_FREEZE_URL).toBe('https://github.com/stackdeckhq/terset/blob/main/bench/data/stress/README.md');
    const record = readFileSync(new URL('bench/data/stress/README.md', REPO), 'utf8');
    expect(record).toContain('Questions were frozen before any model call.');
  });

  it('splits the page text into open and folded parts with nothing lost', () => {
    const open = stressPageIntro(FIXTURE);
    expect(open).toBe(
      `Each model answered 120 harder questions in four groups, sent in each of four formats. Each model ran once, on 2099-01-01. Each cell is that one run. These runs used Terset 1.1. ${HEADLINE}`,
    );
    // The fold holds the freeze record and the breakdown of the misses, word for word as in the Markdown.
    expect(stressIntro(FIXTURE)).toContain(STRESS_FREEZE_NOTE);
    expect(stressLimit(FIXTURE)).toBe(`${HEADLINE} ${stressLimitDetail(FIXTURE)}`);
    expect(stressFoldAbout(FIXTURE)).toBe('What Terset missed, how the questions were frozen, and the scale, deep nesting, messy data and damage detection scores on each model.');
  });

  it('links one run report per model', () => {
    expect(stressReportsLine(FIXTURE)).toBe(
      'Every answer and its score: [Claude Opus 5.5](https://github.com/stackdeckhq/terset/blob/main/bench/published/2099-01-01/fixture-stress-opus.md), [GPT 6.1 Sol](https://github.com/stackdeckhq/terset/blob/main/bench/published/2099-01-01/fixture-stress-sol.md) and [Claude Haiku 5.5](https://github.com/stackdeckhq/terset/blob/main/bench/published/2099-01-01/fixture-stress-haiku.md).',
    );
  });

  it('keeps the copy plain: no dashes, the format and group names as in the README', () => {
    const text = stressMarkdown(FIXTURE).join('\n');
    expect(text).not.toMatch(/[–—]/u);
    expect(Object.values(STRESS_FORMAT_LABELS)).toEqual(['Terset', 'Compact JSON', 'Pretty JSON', 'TOON']);
    expect(Object.values(STRESS_GROUP_LABELS).map((group) => group.label)).toEqual(['Scale', 'Deep nesting', 'Messy data', 'Damage detection']);
    expect(STRESS_DAMAGE_NOTE).toContain('JSON has no row count');
  });

  it('marks only the fewest input tokens on each model, never a score', () => {
    expect(stressTableMarks(FIXTURE)).toEqual([
      [null, 'is-less', null, 'is-less', null, 'is-less'],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
    ]);
  });
});

describe('stress section on the committed data', () => {
  it('keeps the quote-mark note in step with the committed GPT 6.1 Sol compact JSON score', () => {
    // The note counts 20 compact JSON misses on Sol, 11 of them quoted yes or no answers.
    const compact = stressRow(stressModel(STRESS, 'gpt-6.1-sol'), 'json-compact');
    expect(STRESS_QUOTED_NOTE).toContain('11 of the 20 compact JSON misses');
    expect(compact.total - compact.correct).toBe(20);
    expect(STRESS_QUOTED_NOTE).toContain(`compact JSON would score ${String(compact.correct + 11)} of ${String(compact.total)}`);
  });

  it('keeps the README short but still names the loss, the runs and this section', () => {
    const readme = readFileSync(new URL('README.md', REPO), 'utf8');
    expect(readme).toContain(stressLimit(STRESS));
    expect(readme).toContain(stressRunsNote(STRESS));
    expect(readme).toContain('Results by group, every loss and the method: [terset.dev/benchmark](https://terset.dev/benchmark#stress).');
    for (const link of stressReportsLine(STRESS).match(/\[[^\]]+\]\([^)]+\)/gu) ?? []) expect(readme).toContain(link);
  });

  it('names every published stress run in the bench README', () => {
    const readme = readFileSync(new URL('bench/README.md', REPO), 'utf8');
    for (const run of STRESS.publishedRuns) expect(readme).toContain(run.runId);
  });

  it('puts the section in benchmark.md, after the accuracy runs and before the method', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    for (const block of stressMarkdown(STRESS)) expect(text).toContain(block);
    expect(text.indexOf('### Published runs')).toBeLessThan(text.indexOf('## Stress test'));
    expect(text.indexOf('## Stress test')).toBeLessThan(text.indexOf('## Method'));
  });

  it('has the tuning note point at the stress test, which is no longer in progress', () => {
    expect(TUNING_DETAIL).toContain(stressHeldOutNote(STRESS));
    expect(TUNING_DETAIL).not.toContain('in progress');
  });
});
