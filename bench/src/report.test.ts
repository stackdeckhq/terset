import { describe, expect, it } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { QUESTIONS } from './data.ts';
import { plan } from './plan.ts';
import { markdown, pairedAccuracy, summaries } from './report.ts';
import { configSchema, modelSchema } from './schema.ts';
import type { Result, Row } from './schema.ts';

describe('API-equivalent dollar reports', () => {
  it('places the minus sign before the dollar sign for negative savings', () => {
    const model = modelSchema.parse(fakeModel);
    const tasks = plan([model], QUESTIONS.slice(0, 1));
    const rows: Row[] = tasks.map(t => ({ model: model.id, format: t.format, dataset: t.question.dataset,
      questionId: t.question.id, expected: t.question.groundTruth, text: 'fixture', correct: false,
      inputTokens: t.format === 'json-pretty' ? 537923 : 0, outputTokens: 0 }));
    const result: Result = { version: 1, runId: 'negative', fingerprint: 'fixture', mode: 'fake', status: 'complete',
      reason: null, plannedCalls: 4, rows, failures: [], budgetUsed: { calls: 4, inputTokens: 537923, outputTokens: 0 },
      budgets: { maxCalls: 4, maxInputTokens: 600000, maxOutputTokens: 512, perCallMaxOutputTokens: 128 } };
    expect(markdown(result, tasks)).toContain('-$1.075846');
    expect(markdown(result, tasks)).not.toContain('$-');
  });
  it('selects complete four-format questions independently for each model', () => {
    const first = modelSchema.parse({ ...fakeModel, id: 'first' });
    const second = modelSchema.parse({ ...fakeModel, id: 'second' });
    const tasks = plan([first, second], QUESTIONS.slice(0, 2));
    const rows: Row[] = tasks.filter(t => t.question.id === QUESTIONS[t.model.id === 'first' ? 0 : 1]?.id
      || t.format === 'json-compact').map(t => ({ model: t.model.id, format: t.format, dataset: t.question.dataset,
      questionId: t.question.id, expected: t.question.groundTruth, text: 'fixture', correct: t.model.id === 'first',
      inputTokens: 100, outputTokens: 1 }));
    const summary = summaries(rows, tasks).filter(s => s.dataset === 'ALL');
    expect(summary).toHaveLength(8);
    for (const group of summary) {
      expect(group.metrics).toMatchObject({ total: 1, correct: group.model === 'first' ? 1 : 0,
        inputTokens: 100, outputTokens: 1, savingVsCompactJson: 0, droppedIncompleteQuestions: 1 });
    }
  });
  it('requires a sourced, dated price for each model', () => {
    expect(configSchema.safeParse({ models: [{ id: 'unpriced', api: 'openai' }] }).success).toBe(false);
    expect(configSchema.safeParse({ models: [fakeModel] }).success).toBe(true);
  });
  it('reports input, output, total dollars and savings against compact JSON', () => {
    const model = modelSchema.parse(fakeModel);
    const tasks = plan([model], QUESTIONS.slice(0, 1));
    const rows: Row[] = tasks.map(t => ({ model: model.id, format: t.format, dataset: t.question.dataset,
      questionId: t.question.id, expected: t.question.groundTruth, text: t.question.groundTruth, correct: true,
      inputTokens: t.format === 'json-compact' ? 1_000 : 500, outputTokens: 100 }));
    const summary = summaries(rows, tasks);
    expect(summary.find(s => s.format === 'json-compact' && s.dataset === 'ALL')?.metrics).toMatchObject({
      inputCost: 0.002, outputCost: 0.001, totalCost: 0.003, savingVsCompactJson: 0,
    });
    expect(summary.find(s => s.format === 'terset' && s.dataset === 'ALL')?.metrics).toMatchObject({
      inputCost: 0.001, outputCost: 0.001, totalCost: 0.002, savingVsCompactJson: 0.001,
    });
    const result: Result = { version: 1, runId: 'cost-fixture', fingerprint: 'fixture', mode: 'fake', status: 'complete',
      reason: null, plannedCalls: 4, rows, failures: [], budgetUsed: { calls: 4, inputTokens: 2500, outputTokens: 400 },
      budgets: { maxCalls: 4, maxInputTokens: 2500, maxOutputTokens: 512, perCallMaxOutputTokens: 128 } };
    const report = markdown(result, tasks);
    expect(report).toContain('Input cost (USD)');
    expect(report).toContain('$0.003000');
    expect(report).toContain('Saving vs compact JSON (USD)');
  });
});

describe('paired accuracy', () => {
  it.each([[10, 2, 0.03857421875], [2, 10, 0.03857421875], [5, 5, 1], [0, 0, 1]])(
    'uses the two-sided exact binomial p-value for %i vs %i', (tersetOnly, otherOnly, expected) => {
      expect(pairedAccuracy(tersetOnly, otherOnly, 24).pValue).toBeCloseTo(expected, 12);
    },
  );

  it('accounts for concordant pairs and keeps uncertainty when all pairs agree', () => {
    expect(pairedAccuracy(10, 2, 40).gap).toBeCloseTo(0.2);
    expect(pairedAccuracy(10, 2, 40).interval95).not.toEqual(pairedAccuracy(10, 2, 24).interval95);
    const { interval95 } = pairedAccuracy(0, 0, 4);
    // For zero successes, the exact upper bound solves (1 - p)^4 = 0.0125.
    const edge = 1 - 0.0125 ** (1 / 4);
    expect(interval95?.lower).toBeCloseTo(-edge, 12);
    expect(interval95?.upper).toBeCloseTo(edge, 12);
    const allTerset = pairedAccuracy(4, 0, 4);
    expect(allTerset.gap).toBe(1);
    expect(allTerset.interval95?.lower).toBeCloseTo(1 - 2 * edge, 12);
    expect(allTerset.interval95?.upper).toBe(1);
    expect(pairedAccuracy(0, 0, 0)).toEqual({ gap: null, interval95: null, pValue: 1 });
  });

  it('reports the same complete questions in each format per model for the two new suites', () => {
    const models = ['first', 'second'].map(id => modelSchema.parse({ ...fakeModel, id }));
    const tasks = plan(models, QUESTIONS.slice(0, 3), ['json-compact', 'toon', 'terset']);
    const rows: Row[] = tasks.flatMap(task => {
      const index = QUESTIONS.indexOf(task.question);
      if (index === 2 && task.format === 'toon') return [];
      const correct = task.model.id === 'first'
        ? task.format === 'terset' || task.format === 'json-compact' && index === 1
        : task.format === 'toon';
      return [{ model: task.model.id, format: task.format, dataset: task.question.dataset, questionId: task.question.id,
        expected: task.question.groundTruth, text: 'fixture', correct, inputTokens: 1, outputTokens: 1 }];
    });
    const result: Result = { version: 1, runId: 'paired', fingerprint: 'fixture', mode: 'fake', status: 'partial',
      reason: null, plannedCalls: tasks.length, rows, failures: [],
      budgetUsed: { calls: rows.length, inputTokens: rows.length, outputTokens: rows.length },
      budgets: { maxCalls: tasks.length, maxInputTokens: 100_000, maxOutputTokens: 8192, perCallMaxOutputTokens: 8192 } };
    for (const suite of ['real-400', 'real-400-pilot'] as const) {
      const report = markdown({ ...result, suite }, tasks);
      expect(report).toContain('## Paired accuracy');
      expect(report).toContain('| first | json-compact | 2 | 1 | 0 | 50.00 |');
      expect(report).toContain('| first | toon | 2 | 2 | 0 | 100.00 |');
      expect(report).toContain('| second | json-compact | 2 | 0 | 0 | 0.00 |');
      expect(report).toContain('| second | toon | 2 | 0 | 2 | -100.00 |');
    }
    for (const suite of [undefined, 'toon', 'stress', 'real'] as const) {
      expect(markdown(suite ? { ...result, suite } : result, tasks)).not.toContain('Paired accuracy');
    }
  });
});
