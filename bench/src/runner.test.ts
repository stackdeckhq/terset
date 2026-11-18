import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { main } from './cli.ts';
import { fakeClient, httpClient } from './clients.ts';
import { QUESTIONS } from './data.ts';
import { describePlan, plan, reserveInput } from './plan.ts';
import { summaries } from './report.ts';
import { budgetStop, run } from './runner.ts';
import { inputReservationSchema, modelSchema, resultSchema } from './schema.ts';
import type { Budgets } from './schema.ts';

const model = modelSchema.parse({ ...fakeModel, id: 'fake-test' });
const tasks = plan([model], QUESTIONS.slice(0, 2));
const budgets: Budgets = { maxCalls: 100, maxInputTokens: 1_000_000, maxOutputTokens: 10_000, perCallMaxOutputTokens: 128 };
const directories: string[] = [];
async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'terset-runner-'));
  directories.push(path);
  return path;
}
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true });
  vi.unstubAllGlobals();
});
const client = (): ReturnType<typeof fakeClient> => fakeClient(prompt => tasks.find(t => t.prompt.user === prompt.user)?.question.groundTruth ?? 'FAKE');

describe('budget guards and saved results', () => {
  it('compares equal complete question sets after a failed call and a budget stop', async () => {
    const fake = client();
    const original = fake.ask.bind(fake);
    const ask = vi.spyOn(fake, 'ask').mockImplementationOnce(original).mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error('fixture failure')).mockImplementation(original);
    const options = { runId: 'incomplete', directory: await directory(), tasks, client: fake, mode: 'fake' as const,
      budgets: { ...budgets, maxCalls: 4 } };
    expect((await run(options)).rows).toHaveLength(2);
    const stopped = await run(options);
    expect(stopped.reason).toBe('max calls');
    expect(ask).toHaveBeenCalledTimes(3);
    const summary = summaries(stopped.rows, tasks).filter(s => s.dataset === 'ALL');
    expect(summary.map(s => s.metrics.total)).toEqual([0, 0, 0, 0]);
    expect(summary.map(s => s.metrics.savingVsCompactJson)).toEqual([0, 0, 0, 0]);
    expect(await readFile(`${options.directory}/incomplete.md`, 'utf8')).toContain('Dropped incomplete questions: 1');
    const finished = await run({ ...options, budgets: { ...budgets, maxCalls: 5 } });
    expect(finished.rows).toHaveLength(4);
    expect(new Set(finished.rows.map(r => r.questionId))).toEqual(new Set([tasks[0]?.question.id]));
    expect(summaries(finished.rows, tasks).filter(s => s.dataset === 'ALL').map(s => s.metrics.total)).toEqual([1, 1, 1, 1]);
  });
  it('records the installed encoder versions and refuses a resume after they change', async () => {
    const installed = async (name: string): Promise<unknown> => (JSON.parse(await readFile(
      new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8')) as { version: unknown }).version;
    const options = { runId: 'encoders', directory: await directory(), tasks: tasks.slice(0, 1), client: client(), mode: 'fake' as const, budgets };
    const result = await run(options);
    const expected = { '@toon-format/toon': await installed('@toon-format/toon'), '@stackdeck/terset': await installed('@stackdeck/terset') };
    expect(result.encoders).toEqual(expected);
    const path = `${options.directory}/encoders.json`;
    const saved = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    expect(saved.encoders).toEqual(expected);
    await writeFile(path, JSON.stringify({ ...saved, encoders: { ...expected, '@toon-format/toon': '0.0.0' } }));
    await expect(run(options)).rejects.toThrow('Encoder versions changed');
  });
  it('refuses a client configured with a different per-call output cap', async () => {
    const fake = fakeClient(() => '42', 256);
    const ask = vi.spyOn(fake, 'ask');
    await expect(run({ runId: 'cap-mismatch', directory: await directory(), tasks: tasks.slice(0, 1), client: fake, mode: 'fake', budgets }))
      .rejects.toThrow('Client output cap');
    expect(ask).not.toHaveBeenCalled();
  });
  it('reports every planned model/format even when the first call is blocked', async () => {
    const path = await directory();
    const result = await run({ runId: 'zero', directory: path, tasks, client: client(), mode: 'fake', budgets: { ...budgets, maxCalls: 0 } });
    expect(result.rows).toHaveLength(0);
    const report = await readFile(`${path}/zero.md`, 'utf8');
    for (const format of ['json-compact', 'json-pretty', 'toon', 'terset']) {
      expect(report).toContain(`| fake-test | ${format} | ALL | 0 | 0 | N/A | N/A | 0 | 0 |`);
      expect(report).toContain(`| fake-test | ${format} | tabular | 0 | 0 | N/A | N/A | 0 | 0 |`);
    }
    expect(JSON.parse(await readFile(`${path}/zero.json`, 'utf8')) as unknown).toHaveProperty('models', [model]);
  });
  it('reserves output before the next call and permits exact boundaries', () => {
    const used = { calls: 0, inputTokens: 0, outputTokens: 0 };
    expect(budgetStop(used, { ...budgets, maxCalls: 0 }, 1)).toBe('max calls');
    expect(budgetStop(used, { ...budgets, maxInputTokens: 9 }, 10)).toBe('max input tokens');
    expect(budgetStop(used, { ...budgets, maxOutputTokens: 127 }, 10)).toBe('max output tokens');
    expect(budgetStop(used, { ...budgets, maxCalls: 1, maxInputTokens: 10, maxOutputTokens: 128 }, 10)).toBeNull();
  });
  it.each(['calls', 'input', 'output'] as const)('writes a partial report before exceeding %s', async kind => {
    const fake = client();
    const ask = vi.spyOn(fake, 'ask');
    const first = tasks[0];
    if (!first) throw new Error('Missing task');
    const restricted = { ...budgets, ...(kind === 'calls' ? { maxCalls: 1 }
      : kind === 'input' ? { maxInputTokens: reserveInput(first.estimatedInputTokens, inputReservationSchema.parse({})) }
        : { maxOutputTokens: 128 }) };
    const path = await directory();
    const result = await run({ runId: 'budget', directory: path, tasks, client: fake, mode: 'fake', budgets: restricted });
    expect(ask).not.toHaveBeenCalled();
    expect(result.rows).toHaveLength(0);
    expect(result.status).toBe('partial');
    expect(result.reason).toContain(kind === 'input' ? 'input tokens' : kind === 'output' ? 'output tokens' : 'calls');
    expect(resultSchema.parse(JSON.parse(await readFile(`${path}/budget.json`, 'utf8')) as unknown).rows).toEqual(result.rows);
    expect(await readFile(`${path}/budget.md`, 'utf8')).toContain('Status: partial');
  });
  it('resumes the same run without repeating rows or resetting its budget', async () => {
    const path = await directory();
    const fake = client();
    const ask = vi.spyOn(fake, 'ask');
    const options = { runId: 'resume', directory: path, tasks, client: fake, mode: 'fake' as const };
    await run({ ...options, budgets: { ...budgets, maxCalls: 4 } });
    const result = await run({ ...options, budgets });
    expect(result.status).toBe('complete');
    expect(result.rows).toHaveLength(8);
    expect(result.rows.every(r => r.correct)).toBe(true);
    expect(result.budgetUsed.calls).toBe(8);
    expect(ask).toHaveBeenCalledTimes(8);
    await run({ ...options, budgets });
    expect(ask).toHaveBeenCalledTimes(8);
    const saved: unknown = JSON.parse(await readFile(`${path}/resume.json`, 'utf8'));
    expect(saved).toHaveProperty('summary');
    expect(await readFile(`${path}/resume.md`, 'utf8')).toContain('Wilson 95%');
    await expect(run({ ...options, client: fakeClient(() => '42', 64), budgets: { ...budgets, perCallMaxOutputTokens: 64 } })).rejects.toThrow('different plan');
    await expect(run({ ...options, mode: 'http', budgets })).rejects.toThrow('different plan');
  });
  it.each(['calls', 'input', 'output'] as const)('stops only between complete questions for the %s cap', async kind => {
    const fake = client();
    const firstQuestionInput = tasks.slice(0, 4).reduce((n, t) => n + reserveInput(t.estimatedInputTokens, inputReservationSchema.parse({})), 0);
    const restricted = { ...budgets, ...(kind === 'calls' ? { maxCalls: 5 }
      : kind === 'input' ? { maxInputTokens: firstQuestionInput + (tasks[4]?.estimatedInputTokens ?? 0) }
        : { maxOutputTokens: 512 }) };
    const result = await run({ runId: 'whole-question', directory: await directory(), tasks, client: fake, mode: 'fake', budgets: restricted });
    expect(result.status).toBe('partial');
    expect(result.rows).toHaveLength(4);
    for (const format of ['json-compact', 'json-pretty', 'toon', 'terset']) {
      expect(result.rows.filter(r => r.format === format).map(r => r.questionId)).toEqual([QUESTIONS[0]?.id]);
    }
  });
  it('orders multiple models by question and reserves all formats before starting it', async () => {
    const other = { ...model, id: 'second-model' };
    const both = plan([model, other], QUESTIONS.slice(0, 2));
    expect(both.slice(0, 8).every(t => t.question.id === QUESTIONS[0]?.id)).toBe(true);
    const result = await run({ runId: 'two-models', directory: await directory(), tasks: both, client: client(), mode: 'fake', budgets: { ...budgets, maxCalls: 9 } });
    expect(result.rows).toHaveLength(8);
    expect(new Set(result.rows.map(r => r.questionId)).size).toBe(1);
  });
  it('records a 429 failure and completes on explicit resume without repeating finished calls', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(Response.json({
      choices: [{ message: { content: '42' } }], usage: { prompt_tokens: 1, completion_tokens: 1 },
    }))).mockResolvedValueOnce(new Response('', { status: 429 }));
    const http = httpClient({ baseUrl: 'https://bench.invalid', apiKey: 'test-only-placeholder', maxOutputTokens: 128, fetch: fetcher });
    const options = { runId: 'http-resume', directory: await directory(), tasks, client: http, mode: 'http' as const, budgets };
    const failed = await run(options);
    expect(failed.rows).toHaveLength(0);
    expect(failed.budgetUsed.calls).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();
    const finished = await run(options);
    expect(finished.status).toBe('complete');
    expect(finished.rows).toHaveLength(8);
    expect(finished.budgetUsed.calls).toBe(9);
    expect(JSON.parse(await readFile(`${options.directory}/http-resume.json`, 'utf8')) as unknown).toHaveProperty('failures.0.status', 'failed');
    await run(options);
    expect(fetcher).toHaveBeenCalledTimes(9);
  });
  it.each(['calls', 'input', 'output'] as const)('retains failed-call %s charges across resume', async kind => {
    const path = await directory();
    const fake = client();
    const original = fake.ask.bind(fake);
    const ask = vi.spyOn(fake, 'ask').mockRejectedValueOnce(new Error('synthetic failure')).mockImplementation(original);
    // One task isolates cap accounting from the complete-question guard.
    const options = { runId: 'failed', directory: path, tasks: tasks.slice(0, 1), client: fake, mode: 'fake' as const, budgets };
    const result = await run(options);
    expect(result.status).toBe('partial');
    expect(result.budgetUsed.calls).toBe(1);
    expect(result.budgetUsed.outputTokens).toBe(128);
    expect(result.rows).toHaveLength(0);
    const restricted = { ...budgets, ...(kind === 'calls' ? { maxCalls: 1 }
      : kind === 'input' ? { maxInputTokens: result.budgetUsed.inputTokens } : { maxOutputTokens: 128 }) };
    expect((await run({ ...options, budgets: restricted })).status).toBe('partial');
    expect(ask).toHaveBeenCalledOnce();
    const resumed = await run(options);
    expect(resumed.status).toBe('complete');
    expect(resumed.budgetUsed.calls).toBe(2);
    expect(ask).toHaveBeenCalledTimes(2);
  });
  it('treats null completion content as a failed call that can be resumed', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({
      choices: [{ message: { content: null } }], usage: { prompt_tokens: 1, completion_tokens: 1 },
    })).mockResolvedValue(Response.json({
      choices: [{ message: { content: '42' } }], usage: { prompt_tokens: 1, completion_tokens: 1 },
    }));
    const http = httpClient({ baseUrl: 'https://bench.invalid', apiKey: 'test-only-placeholder', maxOutputTokens: 128, fetch: fetcher });
    const options = { runId: 'null-content', directory: await directory(), tasks: tasks.slice(0, 1), client: http, mode: 'http' as const, budgets };
    expect((await run(options)).rows).toHaveLength(0);
    expect((await run(options)).status).toBe('complete');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects resumed limits below usage already recorded', async () => {
    const options = { runId: 'lowered', directory: await directory(), tasks: tasks.slice(0, 1), client: client(), mode: 'fake' as const, budgets };
    const result = await run(options);
    expect(result.status).toBe('complete');
    for (const restricted of [
      { ...budgets, maxCalls: 0 },
      { ...budgets, maxInputTokens: result.budgetUsed.inputTokens - 1 },
      { ...budgets, maxOutputTokens: 0 },
    ]) {
      await expect(run({ ...options, budgets: restricted })).rejects.toThrow('below recorded usage');
    }
  });
  it('continues after usage outside the input reservation when budget remains', async () => {
    const fake = { maxOutputTokens: 128, ask: vi.fn().mockResolvedValue({ text: '42', inputTokens: 10000, outputTokens: 1 }) };
    const result = await run({ runId: 'overrun', directory: await directory(), tasks, client: fake, mode: 'fake', budgets });
    expect(result.status).toBe('complete');
    expect(fake.ask).toHaveBeenCalledTimes(8);
    expect(result.budgetUsed.inputTokens).toBe(80000);
  });
  it('rejects malformed results and path traversal before making calls', async () => {
    const path = await directory();
    const fake = client();
    const ask = vi.spyOn(fake, 'ask');
    const options = { directory: path, tasks, client: fake, mode: 'fake' as const, budgets };
    await expect(run({ ...options, runId: '../escape' })).rejects.toThrow();
    await writeFile(`${path}/invalid.json`, '{}');
    await expect(run({ ...options, runId: 'invalid' })).rejects.toThrow('Invalid result file');
    expect(ask).not.toHaveBeenCalled();
  });
  it('does not share a run id between concurrent writers', async () => {
    const path = await directory();
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const startedPromise = new Promise<void>(resolve => { started = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const fake = client();
    const original = fake.ask.bind(fake);
    fake.ask = async (m, p) => { started?.(); await barrier; return original(m, p); };
    const options = { runId: 'concurrent', directory: path, tasks: tasks.slice(0, 1), client: fake, mode: 'fake' as const, budgets };
    const first = run(options);
    await startedPromise;
    try { await expect(run(options)).rejects.toThrow('locked'); }
    finally { release?.(); }
    expect((await first).status).toBe('complete');
  });
});

describe('dry-run CLI', () => {
  it('prints a deterministic call plan without calling fetch or writing results', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('Network is forbidden'));
    vi.stubGlobal('fetch', fetcher);
    const output: string[] = [];
    await main(['--dry-run', '--limit', '1'], text => output.push(text));
    expect(output.join('\n')).toContain('questions: 13; planned calls: 52');
    expect(output.join('\n')).toContain('no calls made and no results written');
    expect(fetcher).not.toHaveBeenCalled();
    expect(describePlan(tasks)).toContain('Model fake-test: 8 calls');
  });
});
