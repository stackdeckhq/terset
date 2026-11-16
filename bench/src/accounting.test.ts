import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { fakeClient, httpClient } from './clients.ts';
import { QUESTIONS } from './data.ts';
import { estimateInputTokens } from './formats.ts';
import { describePlan, plan, reserveInput } from './plan.ts';
import { run } from './runner.ts';
import { configSchema, modelSchema } from './schema.ts';

const tasks = plan([modelSchema.parse(fakeModel)], QUESTIONS.slice(0, 2));
const budgets = { maxCalls: 100, maxInputTokens: 1_000_000, maxOutputTokens: 10_000, perCallMaxOutputTokens: 128 };
const directories: string[] = [];
async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'terset-accounting-'));
  directories.push(path);
  return path;
}
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true }); });

it('accepts provider framing above the estimate and resumes without repeating calls', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (typeof init?.body !== 'string') throw new Error('Expected fixture request body');
    const body = JSON.parse(init.body) as { messages: { content: string }[] };
    const inputTokens = estimateInputTokens({ system: body.messages[0]?.content ?? '', user: body.messages[1]?.content ?? '' }) + 7;
    return Promise.resolve(Response.json({ choices: [{ message: { content: '42' } }], usage: { prompt_tokens: inputTokens, completion_tokens: 1 } }));
  });
  const client = httpClient({ baseUrl: 'https://fixture.invalid', apiKey: 'fixture', maxOutputTokens: 128, fetch: fetcher });
  const options = { runId: 'framing', directory: await directory(), tasks, client, mode: 'http' as const, budgets };
  const result = await run(options);
  expect(result.status).toBe('complete');
  expect(result.budgetUsed.inputTokens).toBe(tasks.reduce((n, t) => n + t.estimatedInputTokens + 7, 0));
  expect((await run(options)).rows).toHaveLength(8);
  expect(fetcher).toHaveBeenCalledTimes(8);
});

it('records a large reported overrun, warns, and checks real spend before the next call', async () => {
  const client = fakeClient(() => '42');
  const ask = vi.spyOn(client, 'ask').mockResolvedValue({ text: '42', inputTokens: 1_000_007, outputTokens: 3 });
  const path = await directory();
  const result = await run({ runId: 'overrun', directory: path, tasks, client, mode: 'fake', budgets });
  expect(ask).toHaveBeenCalledOnce();
  expect(result.reason).toBe('max input tokens');
  expect(result.rows[0]?.inputTokens).toBe(1_000_007);
  expect(result.budgetUsed).toEqual({ calls: 1, inputTokens: 1_000_007, outputTokens: 3 });
  expect(await readFile(`${path}/overrun.log`, 'utf8')).toContain('Warning: reported input 1000007 exceeds reservation');
  expect(await readFile(`${path}/overrun.md`, 'utf8')).toContain('Input reservation exceeded: 1 calls.');
});

it.each([-5, 7])('fake usage offset %i is recorded instead of the reservation', async offset => {
  const client = fakeClient(() => '42', 128, { inputTokenOffset: offset });
  const result = await run({ runId: 'offset', directory: await directory(), tasks, client, mode: 'fake', budgets });
  expect(result.status).toBe('complete');
  expect(result.rows.map(r => r.inputTokens)).toEqual(tasks.map(t => t.estimatedInputTokens + offset));
  expect(result.budgetUsed.inputTokens).toBe(tasks.reduce((n, t) => n + t.estimatedInputTokens + offset, 0));
});

it('uses configured reservation margins in the plan and charges the full reservation on failure', async () => {
  const config = configSchema.parse({ models: [fakeModel], inputReservation: { margin: 2, allowance: 19 } });
  const first = tasks[0];
  if (!first) throw new Error('Missing fixture');
  const client = fakeClient(() => '42');
  vi.spyOn(client, 'ask').mockRejectedValue(new Error('fixture failure'));
  const result = await run({ runId: 'failed', directory: await directory(), tasks, client, mode: 'fake', budgets,
    inputReservation: config.inputReservation });
  expect(result.budgetUsed).toEqual({ calls: 1, inputTokens: first.estimatedInputTokens * 2 + 19, outputTokens: 128 });
  const sameFormat = tasks.filter(t => t.format === first.format);
  const estimated = sameFormat.reduce((n, t) => n + t.estimatedInputTokens, 0);
  expect(describePlan(tasks, config.inputReservation)).toContain(
    `${first.format}: 2 calls, ${estimated} estimated input tokens, ${estimated * 2 + 38} reserved input tokens`);
  expect(configSchema.parse({ models: [fakeModel] }).inputReservation).toEqual({ margin: 1.25, allowance: 64 });
  expect(reserveInput(1, { margin: 1.25, allowance: 64 })).toBe(66);
});

