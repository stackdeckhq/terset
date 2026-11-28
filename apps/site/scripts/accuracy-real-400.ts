import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { z } from 'zod';
import { loadSuite } from '../../../bench/src/data.ts';
import type { Suite } from '../../../bench/src/data.ts';
import { pairedComparisons, summarize } from '../../../bench/src/report.ts';
import { modelSchema, resultSchema, rowSchema } from '../../../bench/src/schema.ts';
import { score } from '../../../bench/src/scoring.ts';
import { REAL_400_QUESTION_KINDS, Real400AccuracyFileSchema } from '../src/data/real-400-accuracy-schema.ts';
import { REAL_ACCURACY_DATASETS, REAL_ACCURACY_FORMATS, REAL_ACCURACY_MODELS } from '../src/data/real-accuracy-schema.ts';
import { RunFile, equalField, validateRun } from './accuracy-runs.ts';

const REPO = new URL('../../../', import.meta.url);
const PUBLISHED = 'bench/published/2026-11-28';
export const REAL_400_ACCURACY_OUTPUT = new URL('../src/data/real-400-accuracy-results.json', import.meta.url);
export const REAL_400_PUBLISHED_RUNS = [
  { path: `${PUBLISHED}/real400-opus-2026-11-28.json`, model: REAL_ACCURACY_MODELS[0] },
  { path: `${PUBLISHED}/real400-sol-2026-11-28.json`, model: REAL_ACCURACY_MODELS[1] },
] as const;
export const REAL_400_PILOT_RUNS = [
  { path: `${PUBLISHED}/real400-pilot-opus-2026-11-28.json`, model: REAL_ACCURACY_MODELS[0] },
  { path: `${PUBLISHED}/real400-pilot-sol-2026-11-28.json`, model: REAL_ACCURACY_MODELS[1] },
] as const;

const Real400RunFile = resultSchema.extend({
  mode: z.literal('http'),
  status: z.literal('complete'),
  models: z.array(modelSchema).length(1),
  rows: z.array(rowSchema.extend({
    reservedInputTokens: RunFile.shape.rows.element.shape.reservedInputTokens,
    format: z.enum(REAL_ACCURACY_FORMATS),
    dataset: z.enum(REAL_ACCURACY_DATASETS),
  })),
  dataHashes: RunFile.shape.dataHashes,
  generatorSource: z.string(),
  generatorSha256: z.string(),
  sourceHashes: RunFile.shape.dataHashes,
  summary: RunFile.shape.summary,
});
type Real400RunFile = z.infer<typeof Real400RunFile>;
type PublishedSource = { readonly path: string; readonly model: typeof REAL_ACCURACY_MODELS[number] };
const DATASETS = ['ALL', ...REAL_ACCURACY_DATASETS] as const;

export function readReal400Run({ path, model }: PublishedSource, suite: Suite,
  formats: readonly typeof REAL_ACCURACY_FORMATS[number][] = REAL_ACCURACY_FORMATS) {
  const parsed: unknown = JSON.parse(readFileSync(new URL(path, REPO), 'utf8'));
  const run = Real400RunFile.parse(parsed);
  const [settings] = run.models;
  if (run.runId !== basename(path, '.json')) throw new Error(`${path} holds run ${run.runId}`);
  if (settings?.id !== model) throw new Error(`${run.runId}: expected only ${model}`);
  validateRun(run, REAL_ACCURACY_MODELS);
  equalField(run.suite, suite.name, `${run.runId} suite`);
  equalField(run.budgets.perCallMaxOutputTokens, 8192, `${run.runId} output cap`);
  equalField(run.budgetUsed.calls, run.rows.length + run.failures.length, `${run.runId} charged calls`);
  equalField(Object.entries(run.dataHashes).sort(), Object.entries(suite.hashes).sort(), `${run.runId} input hashes`);
  if (!('sourceHashes' in suite.source)) throw new Error(`${suite.name}: expected a real suite`);
  equalField(run.generatorSource, suite.source.generatorSource, `${run.runId} generator source`);
  equalField(run.generatorSha256, suite.source.generatorSha256, `${run.runId} generator hash`);
  equalField(Object.entries(run.sourceHashes).sort(), Object.entries(suite.source.sourceHashes).sort(), `${run.runId} source hashes`);

  const byId = new Map(suite.questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const wrongAnswers = run.rows.flatMap((row) => {
    const question = byId.get(row.questionId);
    if (question?.dataset !== row.dataset || question.groundTruth !== row.expected || !formats.includes(row.format)) {
      throw new Error(`${run.runId} ${row.format} ${row.questionId}: row differs from the frozen question`);
    }
    const key = `${row.format}:${row.questionId}`;
    if (seen.has(key)) throw new Error(`${run.runId} ${key}: question was answered twice`);
    seen.add(key);
    if (row.correct !== score(row.text, question)) throw new Error(`${run.runId} ${key}: score differs from the run`);
    if (row.correct) return [];
    const { format, dataset, questionId, expected, text, outputTokens } = row;
    return [{
      model, format, dataset, questionId, expected, text, outputTokens,
      prompt: question.prompt, kind: question.type,
      hitOutputCap: outputTokens === run.budgets.perCallMaxOutputTokens,
    }];
  });
  if (seen.size !== suite.questions.length * formats.length) {
    throw new Error(`${run.runId}: expected one row per format and frozen question`);
  }
  return {
    run, wrongAnswers, publication: {
      model, runId: run.runId, runOn: basename(dirname(path)), publishedPath: dirname(path),
      price: settings.price, retainedCharges: run.failures.length,
    },
  };
}

function scoreRows(run: Real400RunFile, { model, price }: ReturnType<typeof readReal400Run>['publication']) {
  const rows = DATASETS.flatMap((dataset) => {
    const answers = run.rows.filter((row) => dataset === 'ALL' || row.dataset === dataset);
    const compact = summarize(answers.filter((row) => row.format === 'json-compact')).inputTokens;
    return REAL_ACCURACY_FORMATS.map((format) => {
      const { correct, total, inputTokens, outputTokens, wilson95 } = summarize(answers.filter((row) => row.format === format));
      const totalCost = inputTokens * price.inputPerMillion / 1_000_000 + outputTokens * price.outputPerMillion / 1_000_000;
      const metrics = { correct, total, inputTokens, outputTokens, totalCost };
      const summary = run.summary.find((entry) => entry.model === model && entry.format === format && entry.dataset === dataset);
      if (summary === undefined) throw new Error(`${run.runId} ${format} ${dataset}: missing summary`);
      equalField({ ...metrics, wilson95 }, summary.metrics, `${run.runId} ${format} ${dataset} summary`);
      const inputTokenDelta = inputTokens - compact;
      return { format, dataset, ...metrics, inputTokenDelta, inputTokenChangePct: inputTokenDelta / compact * 100 };
    });
  });
  if (run.summary.length !== rows.length) throw new Error(`${run.runId}: unexpected summary rows`);
  return rows;
}

export function real400AccuracyText(): string {
  const suite = loadSuite('real-400');
  const pilot = loadSuite('real-400-pilot');
  const runs = REAL_400_PUBLISHED_RUNS.map((source) => readReal400Run(source, suite));
  const data = Real400AccuracyFileSchema.parse({
    suite: suite.name,
    questions: suite.questions.length,
    perCallMaxOutputTokens: runs[0]?.run.budgets.perCallMaxOutputTokens,
    formats: REAL_ACCURACY_FORMATS,
    datasets: REAL_ACCURACY_DATASETS,
    publishedRuns: runs.map(({ publication }) => publication),
    pilotRuns: REAL_400_PILOT_RUNS.map((source) => readReal400Run(source, pilot).publication),
    models: runs.map(({ run, publication, wrongAnswers }) => ({
      id: publication.model,
      rows: scoreRows(run, publication),
      paired: pairedComparisons(run.rows, [publication.model], REAL_ACCURACY_FORMATS)
        .map(({ comparisonFormat, total, tersetOnly, otherOnly, gap, interval95, pValue }) => {
          if (gap === null || interval95 === null) throw new Error(`${run.runId}: no paired questions`);
          return {
            comparisonFormat, total, tersetOnly, otherOnly, pValue,
            gapPoints: gap * 100,
            interval95Points: { lower: interval95.lower * 100, upper: interval95.upper * 100 },
          };
        }),
      wrongByKind: REAL_400_QUESTION_KINDS.map((kind) => ({
        kind,
        counts: Object.fromEntries(REAL_ACCURACY_FORMATS.map((format) => [
          format, wrongAnswers.filter((answer) => answer.kind === kind && answer.format === format).length,
        ])),
      })),
    })),
    wrongAnswers: runs.flatMap((run) => run.wrongAnswers),
  });
  return `${JSON.stringify(data, null, 2)}\n`;
}
