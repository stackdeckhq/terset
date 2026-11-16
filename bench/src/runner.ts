import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Client } from './clients.ts';
import { DATA_HASHES, UPSTREAM_SHA } from './data.ts';
import { fingerprint, key, reserveInput } from './plan.ts';
import type { Task } from './plan.ts';
import { markdown, summaries } from './report.ts';
import { budgetsSchema, inputReservationSchema, modelSchema, responseSchema, resultSchema, runIdSchema } from './schema.ts';
import type { Budgets, InputReservation, Result, Row, Usage } from './schema.ts';
import { score } from './scoring.ts';

export function budgetStop(used: Usage, budgets: Budgets, inputReservation: number): string | null {
  if (!Number.isSafeInteger(inputReservation) || inputReservation < 0) throw new Error('Invalid input token reservation');
  if (used.calls + 1 > budgets.maxCalls) return 'max calls';
  if (used.inputTokens + inputReservation > budgets.maxInputTokens) return 'max input tokens';
  if (used.outputTokens + budgets.perCallMaxOutputTokens > budgets.maxOutputTokens) return 'max output tokens';
  return null;
}

function rowKey(row: Pick<Row, 'model' | 'format' | 'dataset' | 'questionId'>): string {
  return JSON.stringify([row.model, row.format, row.dataset, row.questionId]);
}

export async function run(options: {
  runId: string; directory: string; tasks: Task[]; client: Client; mode: Result['mode']; budgets: Budgets;
  inputReservation?: InputReservation;
}): Promise<Result> {
  const runId = runIdSchema.parse(options.runId);
  for (const task of options.tasks) modelSchema.parse(task.model);
  const budgets = budgetsSchema.parse(options.budgets);
  const inputReservation = inputReservationSchema.parse(options.inputReservation ?? {});
  if (options.client.maxOutputTokens !== budgets.perCallMaxOutputTokens) throw new Error('Client output cap must equal the run per-call output limit');
  const digest = fingerprint(options.tasks, options.mode, budgets.perCallMaxOutputTokens);
  await mkdir(options.directory, { recursive: true });
  const jsonPath = join(options.directory, `${runId}.json`);
  const markdownPath = join(options.directory, `${runId}.md`);
  // Exclusive creation protects this run id against concurrent invocations.
  const lockPath = join(options.directory, `${runId}.lock`);
  let lock;
  try {
    const { open } = await import('node:fs/promises');
    lock = await open(lockPath, 'wx');
  } catch { throw new Error('Run id is locked; use a different id or finish the existing run'); }
  try {
    let result: Result = {
      version: 1, runId, fingerprint: digest, mode: options.mode, status: 'partial', reason: null,
      plannedCalls: options.tasks.length, budgets, budgetUsed: { calls: 0, inputTokens: 0, outputTokens: 0 }, rows: [], failures: [],
    };
    let existing: string | undefined;
    try { existing = await readFile(jsonPath, 'utf8'); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw new Error('Cannot read result file'); }
    if (existing !== undefined) {
      const parsed = resultSchema.safeParse(JSON.parse(existing) as unknown);
      if (!parsed.success) throw new Error('Invalid result file');
      result = parsed.data;
      if (result.fingerprint !== digest || result.runId !== runId) throw new Error('Run id belongs to a different plan, model configuration, or mode');
      result.budgets = budgets;
    }
    const tasksByKey = new Map(options.tasks.map(task => [key(task), task]));
    const done = new Set<string>();
    for (const row of result.rows) {
      const id = rowKey(row);
      const task = tasksByKey.get(id);
      if (!task || done.has(id) || task.question.groundTruth !== row.expected
        || score(row.text, task.question) !== row.correct) throw new Error('Result rows do not match the plan');
      done.add(id);
    }
    for (const failure of result.failures) {
      if (!tasksByKey.has(rowKey(failure))) throw new Error('Failed calls do not match the plan');
    }
    const recorded = [...result.rows, ...result.failures];
    if (result.budgetUsed.calls < recorded.length
      || result.budgetUsed.inputTokens < recorded.reduce((n, row) => n + row.inputTokens, 0)
      || result.budgetUsed.outputTokens < recorded.reduce((n, row) => n + row.outputTokens, 0)) throw new Error('Invalid persisted budget accounting');
    if (budgets.maxCalls < result.budgetUsed.calls || budgets.maxInputTokens < result.budgetUsed.inputTokens
      || budgets.maxOutputTokens < result.budgetUsed.outputTokens) throw new Error('Cannot set run limits below recorded usage');
    async function save(): Promise<void> {
      const document = { ...result,
        models: [...new Map(options.tasks.map(task => [task.model.id, task.model])).values()],
        upstreamSha: UPSTREAM_SHA, dataHashes: DATA_HASHES, tokenizer: 'o200k_base',
        summary: summaries(result.rows, options.tasks) };
      await writeFile(`${jsonPath}.tmp`, `${JSON.stringify(document, null, 2)}\n`);
      await rename(`${jsonPath}.tmp`, jsonPath);
      await writeFile(`${markdownPath}.tmp`, markdown(result, options.tasks));
      await rename(`${markdownPath}.tmp`, markdownPath);
    }
    result.status = 'partial';
    result.reason = null;
    result.inputReservation = inputReservation;
    const questions = new Map<string, Task[]>();
    for (const task of options.tasks) {
      const id = JSON.stringify([task.question.dataset, task.question.id]);
      const group = questions.get(id) ?? [];
      group.push(task);
      questions.set(id, group);
    }
    const started = new Set([...result.rows, ...result.failures].map(row => JSON.stringify([row.dataset, row.questionId])));
    const orderedQuestions = [...questions].sort(([a], [b]) => Number(started.has(b)) - Number(started.has(a)));
    for (const [, group] of orderedQuestions) {
      const pending = group.filter(task => !done.has(key(task))).map(task => ({
        task, reservation: reserveInput(task.estimatedInputTokens, inputReservation),
      }));
      // Reserve the entire question across formats and models before its first
      // request. Budget stops therefore never start an incomplete comparison.
      const projected = { ...result.budgetUsed };
      for (const { reservation } of pending) {
        const stop = budgetStop(projected, budgets, reservation);
        if (stop) { result.reason = stop; await save(); return result; }
        projected.calls++;
        projected.inputTokens += reservation;
        projected.outputTokens += budgets.perCallMaxOutputTokens;
      }
      for (const { task, reservation } of pending) {
        const stop = budgetStop(result.budgetUsed, budgets, reservation);
        if (stop) { result.reason = stop; await save(); return result; }
        // Persist before the request so interruption cannot erase a potentially
        // billed call. Explicit resume retains every failed attempt's charges.
        result.budgetUsed.calls++;
        result.budgetUsed.inputTokens += reservation;
        result.budgetUsed.outputTokens += budgets.perCallMaxOutputTokens;
        const attempt = { model: task.model.id, format: task.format, dataset: task.question.dataset,
          questionId: task.question.id, status: 'reserved' as 'reserved' | 'failed',
          inputTokens: reservation, outputTokens: budgets.perCallMaxOutputTokens };
        result.failures.push(attempt);
        result.reason = 'request failed or interrupted; usage reserved';
        await save();
        let answer;
        try { answer = responseSchema.parse(await options.client.ask(task.model, task.prompt)); }
        catch { attempt.status = 'failed'; await save(); return result; }
        result.failures.pop();
        result.rows.push({ ...answer, model: task.model.id, format: task.format, dataset: task.question.dataset,
          questionId: task.question.id, expected: task.question.groundTruth, correct: score(answer.text, task.question),
          reservedInputTokens: reservation });
        result.budgetUsed.inputTokens += answer.inputTokens - reservation;
        result.budgetUsed.outputTokens += answer.outputTokens - budgets.perCallMaxOutputTokens;
        if (answer.inputTokens > reservation) {
          await appendFile(join(options.directory, `${runId}.log`),
            `Warning: reported input ${answer.inputTokens} exceeds reservation ${reservation}; call ${result.budgetUsed.calls}.\n`);
        }
        result.reason = null;
        await save();
      }
    }
    result.status = 'complete';
    await save();
    return result;
  } finally {
    await lock.close();
    const { unlink } = await import('node:fs/promises');
    await unlink(lockPath);
  }
}
