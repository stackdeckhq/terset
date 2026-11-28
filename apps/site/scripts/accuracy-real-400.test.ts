import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hash, loadSuite } from '../../../bench/src/data.ts';
import { resultSchema } from '../../../bench/src/schema.ts';
import { REAL_400_ACCURACY } from '../src/data/real-400-accuracy.ts';
import { REAL_400_ACCURACY_OUTPUT, real400AccuracyText } from './accuracy-real-400.ts';

const REPO = new URL('../../../', import.meta.url);
const PUBLISHED = new URL('bench/published/2026-11-28/', REPO);
const MODELS = [
  {
    name: 'opus', id: 'claude-opus-5-5',
    totals: [[398, 24_769_266], [398, 24_401_266], [400, 19_199_666]],
    paired: [[2, 0], [2, 0]],
  },
  {
    name: 'sol', id: 'gpt-6.2-sol',
    totals: [[389, 17_908_786], [389, 19_211_386], [390, 14_537_986]],
    paired: [[7, 6], [5, 4]],
  },
] as const;

function published(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`real400-${name}-2026-11-28.json`, PUBLISHED), 'utf8')) as unknown;
}

describe('400-question site data', () => {
  it('keeps the checked-in JSON byte for byte equal to the generator output', () => {
    expect(readFileSync(REAL_400_ACCURACY_OUTPUT, 'utf8')).toBe(real400AccuracyText());
  });

  it('ties every listed full and pilot run to the frozen datasets, questions and generator', () => {
    const full = loadSuite('real-400');
    const pilot = loadSuite('real-400-pilot');
    expect(REAL_400_ACCURACY.questions).toBe(400);
    expect(REAL_400_ACCURACY.perCallMaxOutputTokens).toBe(8_192);
    expect(pilot.questions).toHaveLength(24);
    for (const [suite, runs, prefix] of [
      [full, REAL_400_ACCURACY.publishedRuns, ''],
      [pilot, REAL_400_ACCURACY.pilotRuns, 'pilot-'],
    ] as const) {
      const source = suite.source;
      if (!('sourceHashes' in source)) throw new Error('Expected the real suite source record');
      expect(hash(readFileSync(new URL(source.generatorSource, REPO)))).toBe(source.generatorSha256);
      for (const [name, sha] of Object.entries(source.sourceHashes)) {
        expect(hash(readFileSync(new URL(`bench/data/real/${name}`, REPO)))).toBe(sha);
      }
      expect(runs).toHaveLength(MODELS.length);
      for (const { name, id } of MODELS) {
        const runId = `real400-${prefix}${name}-2026-11-28`;
        expect(runs).toContainEqual(expect.objectContaining({ runId, model: id, runOn: '2026-11-28' }));
        expect(published(prefix + name)).toMatchObject({
          runId, suite: suite.name, dataHashes: suite.hashes, ...source,
          budgets: { perCallMaxOutputTokens: REAL_400_ACCURACY.perCallMaxOutputTokens },
        });
      }
    }
  });

  it('keeps the interrupted compact JSON call as a charge and scores its retry', () => {
    const run = resultSchema.parse(published('opus'));
    expect(run.failures).toHaveLength(1);
    expect(run.failures[0]).toMatchObject({ format: 'json-compact', questionId: 'q367', status: 'reserved' });
    expect(run.rows.filter((row) => row.format === 'json-compact' && row.questionId === 'q367')).toHaveLength(1);
    expect(run.budgetUsed.calls).toBe(run.rows.length + 1);
    expect(REAL_400_ACCURACY.publishedRuns.map((item) => [item.model, item.retainedCharges]))
      .toEqual([['claude-opus-5-5', 1], ['gpt-6.2-sol', 0]]);
  });

  it.each(MODELS)('recounts totals, token changes and paired wins for $id', ({ name, id, totals, paired }) => {
    const { rows } = resultSchema.parse(published(name));
    const model = REAL_400_ACCURACY.models.find((item) => item.id === id);
    if (model === undefined) throw new Error(`Missing model ${id}`);
    const overall = model.rows.filter((row) => row.dataset === 'ALL');
    expect(overall.map((row) => [row.correct, row.inputTokens])).toEqual(totals);
    expect(model.rows.map((row) => [row.dataset, row.format])).toEqual(
      ['ALL', ...REAL_400_ACCURACY.datasets].flatMap((dataset) => REAL_400_ACCURACY.formats.map((format) => [dataset, format])),
    );
    for (const row of model.rows) {
      const sameFile = rows.filter((answer) => row.dataset === 'ALL' || answer.dataset === row.dataset);
      const group = sameFile.filter((answer) => answer.format === row.format);
      const compact = sameFile.filter((answer) => answer.format === 'json-compact')
        .reduce((sum, answer) => sum + answer.inputTokens, 0);
      expect(row.total).toBe(group.length);
      expect(row.total).toBe(row.dataset === 'ALL' ? 400 : 200);
      expect(row.correct).toBe(group.filter((answer) => answer.correct).length);
      expect(row.inputTokens).toBe(group.reduce((sum, answer) => sum + answer.inputTokens, 0));
      expect(row.inputTokenDelta).toBe(row.inputTokens - compact);
      expect(row.inputTokenChangePct).toBeCloseTo((row.inputTokens / compact - 1) * 100, 10);
    }
    expect(model.paired.map(({ tersetOnly, otherOnly }) => [tersetOnly, otherOnly])).toEqual(paired);
    const terset = rows.filter((row) => row.format === 'terset');
    for (const comparison of model.paired) {
      const other = rows.filter((row) => row.format === comparison.comparisonFormat);
      const tersetWins = terset.filter((row) => row.correct
        && other.some((answer) => row.questionId === answer.questionId && !answer.correct)).length;
      const otherWins = other.filter((row) => row.correct
        && terset.some((answer) => row.questionId === answer.questionId && !answer.correct)).length;
      expect(comparison).toMatchObject({ tersetOnly: tersetWins, otherOnly: otherWins, total: terset.length });
      expect(comparison.gapPoints).toBeCloseTo(((tersetWins - otherWins) * 100) / terset.length, 10);
      expect(comparison.pValue).toBeCloseTo(name === 'opus' ? 0.5 : 1, 12);
      expect(comparison.interval95Points.lower).toBeLessThan(0);
      expect(comparison.interval95Points.upper).toBeGreaterThan(0);
    }
  });

  it.each(MODELS)('keeps every wrong answer and counts them by kind and format for $id', ({ name, id }) => {
    const questions = loadSuite('real-400').questions;
    const { rows } = resultSchema.parse(published(name));
    const wrong = rows.filter((row) => !row.correct);
    const shown = REAL_400_ACCURACY.wrongAnswers.filter((answer) => answer.model === id);
    expect(shown).toHaveLength(wrong.length);
    for (const row of wrong) {
      const question = questions.find(({ id: questionId }) => questionId === row.questionId);
      expect(shown).toContainEqual(expect.objectContaining({
        format: row.format, dataset: row.dataset, questionId: row.questionId,
        expected: row.expected, text: row.text, kind: question?.type, prompt: question?.prompt,
      }));
    }
    const counts = REAL_400_ACCURACY.models.find((model) => model.id === id)?.wrongByKind;
    expect(counts?.map(({ kind }) => kind).sort()).toEqual([...new Set(questions.map(({ type }) => type))].sort());
    for (const { kind, counts: byFormat } of counts ?? []) {
      const ids = new Set(questions.filter(({ type }) => type === kind).map((question) => question.id));
      for (const format of REAL_400_ACCURACY.formats) {
        expect(byFormat[format]).toBe(wrong.filter((row) => row.format === format && ids.has(row.questionId)).length);
      }
    }
  });
});
