import { describe, expect, it } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { QUESTIONS } from './data.ts';
import { plan } from './plan.ts';
import { markdown, summaries } from './report.ts';
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
