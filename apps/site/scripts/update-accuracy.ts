// Writes src/data/accuracy-results.json and README tables from published runs.
//
//   pnpm accuracy
//
// The runs live in bench/published/<run date>/ as the benchmark harness wrote them.
// PUBLISHED_RUNS lists exactly one TOON-suite run per model, holding every format.
// Every number is recomputed here from the raw rows: correct answers, Wilson 95%
// intervals, input tokens and list-price dollars, overall and per kind of data
// for input tokens. Each run's own summary is checked against the recomputed figures,
// and any difference stops the script. Input tokens are as each model reported them.
// Importing this file writes nothing; only running it does.
// STRESS_PUBLISHED_RUNS feeds a separate file and README block, one run per model.
// The two real suites each write their own data file from the published runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACCURACY_FORMATS, ACCURACY_KINDS, AccuracyFileSchema } from '../src/data/accuracy-schema.ts';
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel } from '../src/data/accuracy-schema.ts';
import { StressAccuracyFileSchema } from '../src/data/accuracy-stress-schema.ts';
import { REAL_ACCURACY_OUTPUT, realAccuracyText } from './accuracy-real.ts';
import { REAL_400_ACCURACY_OUTPUT, real400AccuracyText } from './accuracy-real-400.ts';
import { RunFile, equalField, questionSet, runScores, validateRun, wilson95 } from './accuracy-runs.ts';
import { STRESS_OUTPUT, STRESS_PUBLISHED_RUNS, stressAccuracyText, updateStressReadme } from './accuracy-stress.ts';

export { wilson95 };

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

/** Every model the published runs hold, in the order the site shows them. */
export const MODELS = ['claude-opus-5-5', 'gpt-6.1-sol'] as const;
export type ModelId = (typeof MODELS)[number];

/** The vendor's name for each model. */
const MODEL_NAMES: Readonly<Record<ModelId, string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'gpt-6.1-sol': 'GPT 6.1 Sol',
};

/** One published run: one model, every format. */
export interface PublishedSource {
  readonly path: string;
  readonly model: ModelId;
}

/** The one TOON-suite run per model, in MODELS order. */
export const PUBLISHED_RUNS: readonly PublishedSource[] = [
  { path: 'bench/published/2026-11-19/accuracy-opus-2026-11-19.json', model: 'claude-opus-5-5' },
  { path: 'bench/published/2026-11-19/accuracy-sol-2026-11-19.json', model: 'gpt-6.1-sol' },
];
export const OUTPUT = fileURLToPath(new URL('../src/data/accuracy-results.json', import.meta.url));

/** The run's dataset names in each kind of data. Every dataset in the run must appear here exactly once. */
export const KIND_DATASETS: Readonly<Record<AccuracyKindId, readonly string[]>> = {
  tabular: ['tabular'],
  analytics: ['analytics'],
  github: ['github'],
  'event-logs': ['event-logs'],
  nested: ['nested'],
  'nested-group': ['nested-group'],
  keyed: ['keyed'],
  'nested-config': ['nested-config'],
  'structure-control': ['structural-validation-control'],
  'structure-truncated': ['structural-validation-truncated'],
  'structure-extra-rows': ['structural-validation-extra-rows'],
  'structure-width-mismatch': ['structural-validation-width-mismatch'],
  'structure-missing-fields': ['structural-validation-missing-fields'],
};

/** Input tokens per kind of data, model and format, summed over that model's rows of that format. */
function kindRows(runs: readonly { readonly model: ModelId; readonly run: RunFile }[]): AccuracyKind[] {
  const grouped = Object.values(KIND_DATASETS).flat();
  const rowsOf = (model: ModelId, run: RunFile, format: AccuracyFormat): RunFile['rows'] => run.rows.filter((row) => row.model === model && row.format === format);
  for (const { model, run } of runs) {
    for (const format of ACCURACY_FORMATS) {
      const inRun = [...new Set(rowsOf(model, run, format).map((row) => row.dataset))];
      const unknown = inRun.filter((dataset) => !grouped.includes(dataset));
      if (unknown.length > 0) throw new Error(`No kind of data for dataset ${unknown.join(', ')}`);
      const missing = grouped.filter((dataset) => !inRun.includes(dataset));
      if (missing.length > 0) throw new Error(`The ${model} ${format} rows have no dataset ${missing.join(', ')}`);
    }
  }
  const [first] = runs;
  if (first === undefined) throw new Error('No models');
  return ACCURACY_KINDS.map((kind): AccuracyKind => {
    const datasets = KIND_DATASETS[kind];
    const inKind = (rows: RunFile['rows']): RunFile['rows'] => rows.filter((row) => datasets.includes(row.dataset));
    const questions = new Set(inKind(rowsOf(first.model, first.run, 'json-compact')).map((row) => `${row.dataset}/${row.questionId}`)).size;
    return {
      kind,
      datasets: [...datasets],
      questions,
      models: runs.map(({ model, run }) => {
        const tokens = (format: AccuracyFormat): number => {
          const own = inKind(rowsOf(model, run, format));
          if (own.length !== questions) throw new Error(`${model} ${format} ${kind}: ${String(own.length)} answers for ${String(questions)} questions`);
          return own.reduce((sum, row) => sum + row.inputTokens, 0);
        };
        return { id: model, inputTokens: { terset: tokens('terset'), 'json-compact': tokens('json-compact'), 'json-pretty': tokens('json-pretty'), toon: tokens('toon') } };
      }),
    };
  });
}

function modelIn(run: RunFile, model: ModelId): RunFile['models'][number] {
  const found = run.models.find((entry) => entry.id === model);
  if (found === undefined) throw new Error(`${run.runId}: the run has no ${model}`);
  return found;
}

/**
 * Builds the file from one run per model, after checking that the runs are comparable.
 * `sources` lists the runs in the same order as `rawRuns`; tests pass their own list.
 */
export function buildAccuracy(rawRuns: readonly unknown[], sources: readonly PublishedSource[] = PUBLISHED_RUNS): AccuracyFile {
  if (rawRuns.length !== sources.length) throw new Error('Expected every published run');
  equalField(sources.map((source) => source.model), MODELS, 'model list (one run per model, in model order)');
  const runs = rawRuns.map((raw, index) => {
    const source = sources[index];
    if (source === undefined) throw new Error('Missing published source');
    const run = RunFile.parse(raw);
    const runId = basename(source.path, '.json');
    if (run.runId !== runId) throw new Error(`${source.path} holds run ${run.runId}, not ${runId}`);
    validateRun(run, MODELS);
    if (run.models.length !== 1 || run.models[0]?.id !== source.model) {
      throw new Error(`${run.runId}: the run must hold only ${source.model}, and it holds ${run.models.map((model) => model.id).join(', ')}`);
    }
    return { run, source, model: source.model };
  });
  if (new Set(runs.map((item) => item.run.runId)).size !== runs.length) throw new Error('A run is published twice');
  const reference = runs[0];
  if (reference === undefined) throw new Error('No published run');
  const referenceQuestions = questionSet(reference.run.rows.filter((row) => row.format === 'json-compact'));
  for (const { run, model } of runs) {
    equalField(Object.entries(run.dataHashes).sort(), Object.entries(reference.run.dataHashes).sort(), 'data hashes');
    equalField(run.upstreamSha, reference.run.upstreamSha, 'upstream commit');
    equalField(run.tokenizer, reference.run.tokenizer, 'tokenizer');
    equalField(run.budgets.perCallMaxOutputTokens, reference.run.budgets.perCallMaxOutputTokens, 'per-call output cap');
    equalField(run.inputReservation, reference.run.inputReservation, 'input reservation');
    for (const format of ACCURACY_FORMATS) equalField(questionSet(run.rows.filter((row) => row.model === model && row.format === format)), referenceQuestions, 'question set');
  }
  const models = runs.map(({ run, model }): AccuracyModel => {
    const settings = modelIn(run, model);
    return {
      id: model, name: MODEL_NAMES[model],
      inputTokensFrom: 'model-report',
      inputPerMillion: settings.price.inputPerMillion,
      outputPerMillion: settings.price.outputPerMillion,
      priceSource: settings.price.sourceUrl,
      priceReadOn: settings.price.dateRead,
      rows: runScores(run, settings, ACCURACY_FORMATS),
    };
  });
  return AccuracyFileSchema.parse({
    publishedRuns: runs.map(({ run, source, model }) => ({
      runId: run.runId,
      runOn: basename(dirname(source.path)),
      publishedPath: dirname(source.path),
      model,
      failedRequests: run.failures.length,
    })),
    upstreamSha: reference.run.upstreamSha,
    questions: models[0]?.rows[0]?.total,
    datasets: new Set(reference.run.rows.map((row) => row.dataset)).size,
    calls: runs.reduce((sum, item) => sum + item.run.rows.length, 0),
    failedCalls: runs.reduce((sum, item) => sum + item.run.failures.length, 0),
    models,
    kinds: kindRows(runs),
  });
}

/** The file `pnpm accuracy` writes, as text. */
export function accuracyText(): string {
  const runs: unknown[] = PUBLISHED_RUNS.map((source) => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')) as unknown);
  return `${JSON.stringify(buildAccuracy(runs), null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const realText = realAccuracyText();
  const real400Text = real400AccuracyText();
  writeFileSync(OUTPUT, accuracyText());
  const stressText = stressAccuracyText();
  writeFileSync(STRESS_OUTPUT, stressText);
  writeFileSync(REAL_ACCURACY_OUTPUT, realText);
  writeFileSync(REAL_400_ACCURACY_OUTPUT, real400Text);
  const stress = StressAccuracyFileSchema.parse(JSON.parse(stressText));
  const { ACCURACY, accuracyReadmeBlock } = await import('../src/data/accuracy.ts');
  for (const path of ['README.md', 'packages/terset/README.md', 'packages/terset-py/README.md']) {
    const text = readFileSync(`${REPO}${path}`, 'utf8');
    if (!text.includes('### Answer accuracy')) continue;
    const updated = text.replace(/### Answer accuracy\n[\s\S]*?(?=\n## |\n### |$)/u, `${accuracyReadmeBlock(ACCURACY)}\n`);
    writeFileSync(`${REPO}${path}`, updateStressReadme(updated, stress));
  }
  console.log(`Updated accuracy data and README tables from ${String(PUBLISHED_RUNS.length)} TOON runs and ${String(STRESS_PUBLISHED_RUNS.length)} stress runs.`);
  console.log('Updated real accuracy data for the 40-question and 400-question suites.');
}
