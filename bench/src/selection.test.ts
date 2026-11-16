import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { main } from './cli.ts';
import { fakeClient } from './clients.ts';
import { QUESTIONS, selectQuestions } from './data.ts';
import { describePlan, fingerprint, plan } from './plan.ts';
import { markdown, summaries } from './report.ts';
import { run } from './runner.ts';
import { FORMATS, modelSchema } from './schema.ts';
import type { Row } from './schema.ts';

const model = modelSchema.parse(fakeModel);
const datasets = ['structural-validation-control', 'structural-validation-truncated'] as const;
const formats = ['terset', 'toon'] as const;
const directories: string[] = [];
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true });
  vi.unstubAllGlobals();
});

describe('selected benchmark formats and datasets', () => {
  it('selects only allowed datasets and preserves upstream question order', () => {
    const selected = selectQuestions(undefined, datasets);
    expect(selected).toEqual(QUESTIONS.filter(question => datasets.some(name => name === question.dataset)));
    expect(selectQuestions(1, datasets)).toEqual(selected);
  });

  it('plans exactly the requested formats in their requested order', () => {
    const selected = selectQuestions(undefined, datasets);
    const tasks = plan([model], selected, formats);
    expect(tasks.map(task => task.format)).toEqual(['terset', 'toon', 'terset', 'toon']);
    const description = describePlan(tasks);
    expect(description).toContain('Datasets: 2; questions: 2; planned calls: 4');
    expect(description).not.toContain('json-compact');
    expect(description).not.toContain('  tabular:');
    expect(plan([model], selected)).toEqual(plan([model], selected, FORMATS));
    expect(fingerprint(tasks, 'fake', 128)).not.toBe(fingerprint(plan([model], selected), 'fake', 128));
  });

  it('accepts both CLI selections without constructing a network request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('Network forbidden'));
    vi.stubGlobal('fetch', fetcher);
    const output: string[] = [];
    await main(['--dry-run', '--formats', formats.join(','), '--datasets', datasets.join(',')], text => output.push(text));
    expect(output.join('\n')).toContain('planned calls: 4');
    expect(output.join('\n')).toContain('  toon: 2 calls');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['--formats', 'terset,unknown'], ['--datasets', 'tabular,unknown'],
    ['--formats', ''], ['--datasets', ''],
    ['--formats', 'terset,terset'], ['--datasets', 'tabular,tabular'],
  ])('refuses invalid selection %s %s', async (flag, value) => {
    const log = vi.fn();
    await expect(main(['--dry-run', flag, value], log)).rejects.toThrow();
    expect(log).not.toHaveBeenCalled();
  });

  it('compares only questions complete in every selected format without a compact JSON baseline', async () => {
    const tasks = plan([model], selectQuestions(undefined, datasets), formats);
    const rows: Row[] = tasks.slice(0, 3).map(task => ({ model: model.id, format: task.format,
      dataset: task.question.dataset, questionId: task.question.id, expected: task.question.groundTruth,
      text: task.question.groundTruth, correct: true, inputTokens: 10, outputTokens: 1 }));
    const summary = summaries(rows, tasks).filter(group => group.dataset === 'ALL');
    expect(summary).toHaveLength(2);
    for (const group of summary) expect(group.metrics).toMatchObject({ total: 1, droppedIncompleteQuestions: 1, savingVsCompactJson: null });
    const directory = await mkdtemp(join(tmpdir(), 'terset-selection-'));
    directories.push(directory);
    const result = await run({ runId: 'selected', directory, tasks, client: fakeClient(() => 'YES'), mode: 'fake',
      budgets: { maxCalls: 4, maxInputTokens: 100000, maxOutputTokens: 512, perCallMaxOutputTokens: 128 } });
    const report = markdown({ ...result, rows }, tasks);
    expect(report).toContain('complete in every selected format');
    expect(report).toContain('Dropped incomplete questions: 1');
    expect(report.split('\n').filter(line => line.startsWith(`| ${model.id} |`)).every(line => line.endsWith(' |  |'))).toBe(true);
    await expect(run({ runId: 'selected', directory, tasks: plan([model], selectQuestions(undefined, datasets), ['terset']),
      client: fakeClient(() => 'YES'), mode: 'fake', budgets: result.budgets })).rejects.toThrow('different plan');
    await expect(run({ runId: 'selected', directory, tasks: plan([model], selectQuestions(undefined, [datasets[0]]), formats),
      client: fakeClient(() => 'YES'), mode: 'fake', budgets: result.budgets })).rejects.toThrow('different plan');
  });
});
