import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { z } from 'zod';
import { summarize } from '../../../bench/src/report.ts';
import { questionSchema } from '../../../bench/src/schema.ts';
import {
  REAL_ACCURACY_DATASETS, REAL_ACCURACY_FORMATS, REAL_ACCURACY_MODELS, RealAccuracyFileSchema,
} from '../src/data/real-accuracy-schema.ts';
import { RunFile, equalField, validateRun } from './accuracy-runs.ts';

export const REAL_ACCURACY_OUTPUT = new URL('../src/data/real-accuracy-results.json', import.meta.url);
const REPO = new URL('../../../', import.meta.url);
export const REAL_PUBLISHED_RUNS = [
  { path: 'bench/published/2026-11-26/real-opus-2026-11-26.json', model: REAL_ACCURACY_MODELS[0] },
  { path: 'bench/published/2026-11-26/real-sol-2026-11-26.json', model: REAL_ACCURACY_MODELS[1] },
] as const;
const RealRunFile = RunFile.omit({ upstreamSha: true }).extend({
  suite: z.literal('real'),
  rows: z.array(RunFile.shape.rows.element.extend({ text: z.string(), expected: z.string() })).length(120),
  failures: z.array(RunFile.shape.failures.element).length(0),
});
const Score = RunFile.shape.summary.element.shape.metrics.omit({ wilson95: true });
const DATASETS = ['ALL', ...REAL_ACCURACY_DATASETS] as const;

export function realAccuracyText(): string {
  const questionBytes = readFileSync(new URL('bench/data/real/suite/questions.json', REPO));
  const questionHash = createHash('sha256').update(questionBytes).digest('hex');
  const questions = z.array(questionSchema).length(40).parse(JSON.parse(questionBytes.toString('utf8')));
  const byId = new Map(questions.map((question) => [question.id, question]));
  const runs = REAL_PUBLISHED_RUNS.map(({ path, model }) => {
    const run = RealRunFile.parse(JSON.parse(readFileSync(new URL(path, REPO), 'utf8')));
    const [settings] = run.models;
    if (run.runId !== basename(path, '.json')) throw new Error(`${path} holds run ${run.runId}`);
    if (settings?.id !== model || run.models.length !== 1) throw new Error(`${run.runId}: expected only ${model}`);
    validateRun(run, REAL_ACCURACY_MODELS);
    equalField(run.dataHashes['questions.json'], questionHash, `${run.runId} frozen questions hash`);

    for (const format of REAL_ACCURACY_FORMATS) {
      const rows = run.rows.filter((row) => row.format === format);
      if (rows.length !== questions.length || new Set(rows.map((row) => row.questionId)).size !== questions.length) {
        throw new Error(`${run.runId} ${format}: expected one row per question`);
      }
      for (const row of rows) {
        const question = byId.get(row.questionId);
        if (question === undefined || row.dataset !== question.dataset || row.expected !== question.groundTruth) {
          throw new Error(`${run.runId} ${format} ${row.questionId}: row differs from the frozen question`);
        }
      }
    }
    return { run, path, model, price: settings.price };
  });

  const [first, second] = runs;
  if (first === undefined || second === undefined) throw new Error('Expected both published real runs');
  equalField(Object.entries(first.run.dataHashes).sort(), Object.entries(second.run.dataHashes).sort(), 'real data hashes');
  const perCallMaxOutputTokens = first.run.budgets.perCallMaxOutputTokens;
  equalField(second.run.budgets.perCallMaxOutputTokens, perCallMaxOutputTokens, 'real per-call output cap');

  const data = RealAccuracyFileSchema.parse({
    suite: 'real',
    questions: questions.length,
    perCallMaxOutputTokens,
    formats: REAL_ACCURACY_FORMATS,
    datasets: REAL_ACCURACY_DATASETS,
    publishedRuns: runs.map(({ run, path, model, price }) => ({
      runId: run.runId, runOn: basename(dirname(path)), publishedPath: dirname(path), model, price,
    })),
    models: runs.map(({ run, model, price }) => {
      const rows = REAL_ACCURACY_FORMATS.flatMap((format) => DATASETS.map((dataset) => {
        const grouped = run.rows.filter((row) => row.format === format && (dataset === 'ALL' || row.dataset === dataset));
        const { correct, total, inputTokens, outputTokens } = summarize(grouped);
        const totalCost = inputTokens * price.inputPerMillion / 1_000_000 + outputTokens * price.outputPerMillion / 1_000_000;
        const metrics = { correct, total, inputTokens, outputTokens, totalCost };
        const summary = run.summary.find((entry) => entry.model === model && entry.format === format && entry.dataset === dataset);
        if (summary === undefined) throw new Error(`${run.runId} ${format} ${dataset}: missing summary`);
        equalField(metrics, Score.parse(summary.metrics), `${run.runId} ${format} ${dataset} summary`);
        return { format, dataset, ...metrics };
      }));
      if (run.summary.length !== rows.length) throw new Error(`${run.runId}: unexpected summary rows`);
      return { id: model, rows };
    }),
    wrongAnswers: runs.flatMap(({ run }) => run.rows.filter((row) => !row.correct).map((row) => {
      const { model, format, dataset, questionId, expected, text, outputTokens } = row;
      const question = byId.get(questionId);
      if (question === undefined) throw new Error(`${run.runId}: missing question ${questionId}`);
      return {
        model, format, dataset, questionId, prompt: question.prompt, kind: question.type,
        expected, text, outputTokens, hitOutputCap: outputTokens === perCallMaxOutputTokens,
      };
    })),
  });
  return `${JSON.stringify(data, null, 2)}\n`;
}
