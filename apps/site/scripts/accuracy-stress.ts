// The stress publication has one measured run per model, separate from the TOON means.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { questionSchema } from '../../../bench/src/schema.ts';
import { score } from '../../../bench/src/scoring.ts';
import { ACCURACY_FORMATS } from '../src/data/accuracy-schema.ts';
import type { AccuracyFormat } from '../src/data/accuracy-schema.ts';
import { STRESS_GROUPS, STRESS_MODELS, StressAccuracyFileSchema, StressSourceSchema } from '../src/data/accuracy-stress-schema.ts';
import type { StressAccuracyFile } from '../src/data/accuracy-stress-schema.ts';
import { stressRunDates } from '../src/data/stress.ts';
import { RunFile, equalField, runScores, validateRun } from './accuracy-runs.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const STRESS_GENERATOR_SOURCE = 'bench/src/stress/generate.ts';
const STRESS_SEED = 20261117;
const STRESS_OUTPUT_CAP = 16000;
const STRESS_ENCODERS = { '@toon-format/toon': '4.4.0', '@stackdeck/terset': '0.2.4' } as const;
const STRESS_REFERENCE_DATE = '2026-11-17T00:00:00.000Z';
const STRESS_TOKENIZER = 'o200k_base';
const STRESS_INPUT_RESERVATION = { margin: 1.25, allowance: 64 } as const;
/** US dollars per million tokens, as read on 2026-11-17. The published costs follow from these. */
const STRESS_PRICES: Readonly<Record<(typeof STRESS_MODELS)[number], { readonly inputPerMillion: number; readonly outputPerMillion: number }>> = {
  'claude-opus-5-5': { inputPerMillion: 4, outputPerMillion: 20 },
  'gpt-6.1-sol': { inputPerMillion: 2, outputPerMillion: 10 },
  'claude-haiku-5-5': { inputPerMillion: 0.1, outputPerMillion: 0.5 },
};
const STRESS_DATA_FILES =['datasets.json', 'questions.json'] as const;
const StressQuestion = questionSchema.extend({ type: z.enum(['scale', 'deep', 'messy', 'structural-validation']) });
export const STRESS_OUTPUT = fileURLToPath(new URL('../src/data/accuracy-stress-results.json', import.meta.url));
interface StressPublishedSource {
  readonly path: string;
  readonly model: (typeof STRESS_MODELS)[number];
}
export const STRESS_PUBLISHED_RUNS: readonly StressPublishedSource[] = [
  { path: 'bench/published/2026-11-18/stress-opus-16k-2026-11-18.json', model: 'claude-opus-5-5' },
  { path: 'bench/published/2026-11-18/stress-sol-16k-2026-11-18.json', model: 'gpt-6.1-sol' },
  { path: 'bench/published/2026-11-18/stress-haiku-16k-2026-11-18.json', model: 'claude-haiku-5-5' },
];
const STRESS_MODEL_NAMES: Readonly<Record<(typeof STRESS_MODELS)[number], string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5', 'gpt-6.1-sol': 'GPT 6.1 Sol', 'claude-haiku-5-5': 'Claude Haiku 5.5',
};

export const StressRunFile = RunFile.omit({ upstreamSha: true }).extend({
  suite: z.literal('stress'),
  rows: z.array(RunFile.shape.rows.element.extend({ text: z.string(), expected: z.string() })),
  ...StressSourceSchema.omit({ perCallMaxOutputTokens: true }).shape,
});

function repositoryHash(path: string): string {
  return createHash('sha256').update(readFileSync(`${REPO}${path}`)).digest('hex');
}

/** Agreement between runs cannot prove that they used the frozen repository inputs. */
function validateStressSource(run: z.infer<typeof StressRunFile>, dataHashes: Readonly<Record<string, string>>, generatorHash: string): void {
  const refuse = (message: string): never => { throw new Error(`${run.runId}: ${message}`); };
  if (JSON.stringify(Object.keys(run.dataHashes).sort()) !== JSON.stringify([...STRESS_DATA_FILES].sort())) refuse('stress data hash files differ from the repository');
  for (const name of STRESS_DATA_FILES) {
    if (run.dataHashes[name] !== dataHashes[name]) refuse(`stress ${name} hash differs from the repository`);
  }
  if (run.generatorSource !== STRESS_GENERATOR_SOURCE) refuse(`stress generator source must be ${STRESS_GENERATOR_SOURCE}`);
  if (run.generatorSha256 !== generatorHash) refuse('stress generator hash differs from the repository');
  if (run.seed !== STRESS_SEED) refuse(`stress seed must be ${STRESS_SEED}`);
  if (run.budgets.perCallMaxOutputTokens !== STRESS_OUTPUT_CAP) refuse(`stress per-call output cap must be ${STRESS_OUTPUT_CAP}`);
  for (const encoder of ['@toon-format/toon', '@stackdeck/terset'] as const) {
    if (run.encoders[encoder] !== STRESS_ENCODERS[encoder]) refuse(`stress ${encoder} encoder version must be ${STRESS_ENCODERS[encoder]}`);
  }
  if (run.referenceDate !== STRESS_REFERENCE_DATE) refuse(`stress reference date must be ${STRESS_REFERENCE_DATE}`);
  if (run.tokenizer !== STRESS_TOKENIZER) refuse(`stress tokenizer must be ${STRESS_TOKENIZER}`);
  if (run.inputReservation.margin !== STRESS_INPUT_RESERVATION.margin || run.inputReservation.allowance !== STRESS_INPUT_RESERVATION.allowance) {
    refuse(`stress input reservation must be margin ${STRESS_INPUT_RESERVATION.margin} and allowance ${STRESS_INPUT_RESERVATION.allowance}`);
  }
  for (const model of run.models) {
    const price = STRESS_MODELS.includes(model.id as (typeof STRESS_MODELS)[number]) ? STRESS_PRICES[model.id as (typeof STRESS_MODELS)[number]] : undefined;
    if (price?.inputPerMillion !== model.price.inputPerMillion || price.outputPerMillion !== model.price.outputPerMillion) refuse(`stress ${model.id} price differs from the recorded price`);
  }
}

function validateStressQuestions(run: z.infer<typeof StressRunFile>, questions: ReadonlyMap<string, z.infer<typeof StressQuestion>>): void {
  for (const format of ACCURACY_FORMATS) {
    const seen = new Set<string>();
    for (const row of run.rows.filter((row) => row.format === format)) {
      const refuse = (message: string): never => { throw new Error(`${run.runId} ${format} ${row.questionId}: ${message}`); };
      const question = questions.get(row.questionId);
      if (question === undefined) throw new Error(`${run.runId} ${format} ${row.questionId}: stress question is not in questions.json`);
      if (seen.has(row.questionId)) refuse('stress question was answered twice');
      seen.add(row.questionId);
      if (row.dataset !== question.dataset) refuse('stress dataset differs from questions.json');
      if (row.expected !== question.groundTruth) refuse('stress expected answer differs from questions.json');
      if (row.correct !== score(row.text, question)) refuse('stress correct flag differs from re-scoring the answer');
    }
    if (seen.size !== questions.size) throw new Error(`${run.runId} ${format}: stress question set differs from questions.json`);
  }
}

/** A separate list and output keep the TOON headline and its three-run means intact. */
export function buildStressAccuracy(rawRuns: readonly unknown[], sources: readonly StressPublishedSource[] = STRESS_PUBLISHED_RUNS): StressAccuracyFile {
  if (rawRuns.length !== sources.length || sources.length !== STRESS_MODELS.length) throw new Error('Expected every published stress run');
  equalField(sources.map((source) => source.model), STRESS_MODELS, 'stress model list');
  const dataHashes = Object.fromEntries(STRESS_DATA_FILES.map((name) => [name, repositoryHash(`bench/data/stress/${name}`)]));
  const generatorHash = repositoryHash(STRESS_GENERATOR_SOURCE);
  const questions = new Map(z.array(StressQuestion).parse(JSON.parse(readFileSync(`${REPO}bench/data/stress/questions.json`, 'utf8'))).map((question) => [question.id, question]));
  const runs = rawRuns.map((raw, index) => {
    const source = sources[index];
    if (source === undefined) throw new Error('Missing stress source');
    const run = StressRunFile.parse(raw);
    if (run.runId !== basename(source.path, '.json')) throw new Error(`${source.path} holds run ${run.runId}`);
    if (run.models.length !== 1 || run.models[0]?.id !== source.model) throw new Error(`${run.runId}: a stress run must hold only ${source.model}`);
    validateRun(run, STRESS_MODELS);
    validateStressSource(run, dataHashes, generatorHash);
    validateStressQuestions(run, questions);
    return run;
  });
  const reference = runs[0];
  if (reference === undefined) throw new Error('Expected every published stress run');
  return StressAccuracyFileSchema.parse({
    suite: 'stress', aggregation: 'single-run-per-model',
    source: StressSourceSchema.strip().parse({ ...reference, perCallMaxOutputTokens: reference.budgets.perCallMaxOutputTokens }),
    questions: questions.size,
    datasets: new Set([...questions.values()].map((question) => question.dataset)).size,
    calls: runs.reduce((sum, run) => sum + run.rows.length, 0),
    failedCalls: runs.reduce((sum, run) => sum + run.failures.length, 0),
    publishedRuns: runs.map((run, index) => {
      const source = sources[index];
      if (source === undefined) throw new Error('Unexpected stress run');
      return { runId: run.runId, runOn: basename(dirname(source.path)), publishedPath: dirname(source.path), model: source.model };
    }),
    models: runs.map((run, index) => {
      const model = run.models[0];
      const source = sources[index];
      if (model === undefined || source === undefined) throw new Error('Missing stress model');
      const name = STRESS_MODEL_NAMES[source.model];
      const scores = runScores({ run, runOn: basename(dirname(source.path)) }, model, ACCURACY_FORMATS, (row) => row.inputTokens);
      return {
        id: model.id, name, inputTokensFrom: 'model-report',
        rows: scores.map((score) => ({
          ...score,
          groups: STRESS_GROUPS.map((group) => {
            const rows = run.rows.filter((row) => row.format === score.format && questions.get(row.questionId)?.type === (group === 'damage' ? 'structural-validation' : group));
            return { group, correct: rows.filter((row) => row.correct).length, total: rows.length, inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0) };
          }),
        })),
      };
    }),
  });
}

export function stressAccuracyText(): string {
  const runs = STRESS_PUBLISHED_RUNS.map((source): unknown => JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8')));
  return `${JSON.stringify(buildStressAccuracy(runs), null, 2)}\n`;
}

const STRESS_FORMAT_NAMES: Readonly<Record<AccuracyFormat, string>> = { terset: 'Terset', 'json-compact': 'Compact JSON', 'json-pretty': 'Pretty JSON', toon: 'TOON' };
/** A short block: the headline table, any Terset loss, and links to the detail on the benchmark page. */
export function stressReadmeBlock(file: StressAccuracyFile): string {
  const score = (row: { readonly correct: number; readonly total: number }): string => `${String(row.correct)} of ${String(row.total)}`;
  const table = (head: readonly string[], rows: readonly (readonly string[])[]): string => [head, head.map(() => '---'), ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
  const overall = ACCURACY_FORMATS.map((format) => [STRESS_FORMAT_NAMES[format], ...file.models.map((model) => {
    const row = model.rows.find((item) => item.format === format);
    if (row === undefined) throw new Error(`No stress ${model.id} ${format} score`);
    return score(row);
  })]);
  // The README names every model where Terset alone has the lowest score, so a loss is never left out.
  const lowest = file.models.filter((model) => {
    const terset = model.rows.find((row) => row.format === 'terset');
    return terset !== undefined && model.rows.every((row) => row.format === 'terset' || row.correct > terset.correct);
  }).map((model) => model.name);
  const published = 'https://github.com/stackdeckhq/terset';
  const reports = file.publishedRuns.map((run) => `[${STRESS_MODEL_NAMES[run.model]}](${published}/blob/main/${run.publishedPath}/${run.runId}.md)`);
  return [
    '### Stress accuracy',
    `One run per model on ${stressRunDates(file)}, with ${file.questions} harder questions in all four formats. Gaps of a few questions are within noise.`,
    table(['Format', ...file.models.map((model) => model.name)], overall),
    `${lowest.length > 0 ? `Terset scored lowest on ${lowest.join(' and ')}. ` : ''}Results by group, every loss and the method: [terset.dev/benchmark](https://terset.dev/benchmark#stress). Every answer and its score: ${reports.join(', ')}.`,
  ].join('\n\n');
}

export function updateStressReadme(text: string, file: StressAccuracyFile): string {
  const block = `${stressReadmeBlock(file)}\n`;
  if (text.includes('### Stress accuracy\n')) return text.replace(/### Stress accuracy\n[\s\S]*?(?=\n## |\n### |$)/u, block);
  if (!text.includes('### Answer accuracy\n')) throw new Error('README has no answer accuracy section');
  return text.replace(/### Answer accuracy\n[\s\S]*?(?=\n## |\n### |$)/u, (section) => `${section}\n${block}`);
}
