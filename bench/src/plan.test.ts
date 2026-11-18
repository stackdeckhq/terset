import { expect, it } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { QUESTIONS } from './data.ts';
import { describePlan, estimateCost, plan } from './plan.ts';
import { modelSchema } from './schema.ts';

it('prices reserved input and every output cap per model and in total', () => {
  const first = modelSchema.parse(fakeModel);
  const second = { ...first, id: 'second', price: { ...first.price, inputPerMillion: 4, outputPerMillion: 20 } };
  const tasks = plan([first, second], QUESTIONS.slice(0, 1), ['toon', 'terset'])
    .map(task => ({ ...task, estimatedInputTokens: 100 }));
  const reservation = { margin: 1.25, allowance: 64 };
  const costs = estimateCost(tasks, reservation, 2048);
  expect(costs.models).toEqual([
    { model: first.id, reservedInputTokens: 378, reservedOutputTokens: 4096,
      inputCost: 0.000756, outputCost: 0.04096, totalCost: 0.041716 },
    { model: 'second', reservedInputTokens: 378, reservedOutputTokens: 4096,
      inputCost: 0.001512, outputCost: 0.08192, totalCost: 0.083432 },
  ]);
  expect(costs.totalCost).toBeCloseTo(0.125148, 12);
  const text = describePlan(tasks, reservation, 2048);
  expect(text).toContain('Reserved cost (USD), model second: $0.083432');
  expect(text).toContain('Reserved cost (USD), total: $0.125148');
  expect(estimateCost([], reservation, 2048)).toEqual({ models: [], totalCost: 0 });
});
