import { createHash } from 'node:crypto';
import { DATASETS } from './data.ts';
import type { SuiteRecord } from './data.ts';
import { encode, encodeDataset, estimateInputTokens, makePrompt, primerFor } from './formats.ts';
import type { Prompt } from './formats.ts';
import { FORMATS, inputReservationSchema, modelSchema, PUBLISHED_TERSET_FORMAT, selectedFormatsSchema } from './schema.ts';
import type { Dataset, Format, InputReservation, Model, Question, TersetFormat } from './schema.ts';

export interface Task { model: Model; format: Format; question: Question; prompt: Prompt; estimatedInputTokens: number }
export function key(task: Pick<Task, 'model' | 'format' | 'question'>): string {
  return JSON.stringify([task.model.id, task.format, task.question.dataset, task.question.id]);
}

export function plan(models: Model[], questions: Question[], formats: readonly Format[] = FORMATS, datasets: Dataset[] = DATASETS, tersetFormat: TersetFormat = PUBLISHED_TERSET_FORMAT): Task[] {
  formats = selectedFormatsSchema.parse(formats);
  models = models.map(model => modelSchema.parse(model));
  if (new Set(models.map(m => m.id)).size !== models.length) throw new Error('Model ids must be unique');
  const encoded = new Map<string, { data: string; primer: string }>();
  for (const dataset of datasets) {
    if (!questions.some(question => question.dataset === dataset.name)) continue;
    for (const format of formats) encoded.set(JSON.stringify([dataset.name, format]), {
      primer: primerFor(format, encode(format, dataset.data, tersetFormat)),
      data: encodeDataset(format, dataset, tersetFormat),
    });
  }
  return questions.flatMap(question => models.flatMap(model => formats.map(format => {
    const encodedDataset = encoded.get(JSON.stringify([question.dataset, format]));
    if (encodedDataset === undefined) throw new Error('Unknown dataset');
    const prompt = makePrompt(question, format, encodedDataset.data, encodedDataset.primer);
    return { model, format, question, prompt, estimatedInputTokens: estimateInputTokens(prompt) };
  })));
}

export function fingerprint(tasks: Task[], mode: string, maxOutputTokens: number, suite?: SuiteRecord): string {
  // Keep the same JSON bytes without building one string for every prompt.
  const digest = createHash('sha256');
  digest.update(JSON.stringify({ version: 1, mode, maxOutputTokens }).slice(0, -1)).update(',"tasks":[');
  for (const [index, task] of tasks.entries()) {
    if (index > 0) digest.update(',');
    digest.update(JSON.stringify(task));
  }
  digest.update(']');
  if (suite && suite.name !== 'toon') {
    digest.update(',').update(JSON.stringify({ suite: suite.name, dataHashes: suite.hashes, source: suite.source }).slice(1, -1));
  }
  return digest.update('}').digest('hex');
}

export function reserveInput(estimate: number, config: InputReservation): number {
  const reserved = Math.ceil(estimate * config.margin) + config.allowance;
  if (!Number.isSafeInteger(reserved) || reserved < 0) throw new Error('Invalid input token reservation');
  return reserved;
}

export function estimateCost(tasks: Task[], inputReservation: InputReservation, maxOutputTokens: number): {
  models: { model: string; reservedInputTokens: number; reservedOutputTokens: number; inputCost: number; outputCost: number; totalCost: number }[];
  totalCost: number;
} {
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1) throw new Error('Invalid per-call output cap');
  const models = [...new Set(tasks.map(task => task.model.id))].map(model => {
    const rows = tasks.filter(task => task.model.id === model);
    const price = rows[0]?.model.price;
    if (!price) throw new Error('Missing model price');
    const reservedInputTokens = rows.reduce((n, task) => n + reserveInput(task.estimatedInputTokens, inputReservation), 0);
    const reservedOutputTokens = rows.length * maxOutputTokens;
    const inputCost = reservedInputTokens * price.inputPerMillion / 1_000_000;
    const outputCost = reservedOutputTokens * price.outputPerMillion / 1_000_000;
    return { model, reservedInputTokens, reservedOutputTokens, inputCost, outputCost, totalCost: inputCost + outputCost };
  });
  return { models, totalCost: models.reduce((n, model) => n + model.totalCost, 0) };
}

export function describePlan(tasks: Task[], inputReservation: InputReservation = inputReservationSchema.parse({}), maxOutputTokens = 128): string {
  const questions = new Map(tasks.map(t => [t.question.id, t.question]));
  const lines = ['Call plan (o200k_base estimates include shared instructions and each format primer; API framing excluded)',
    `Datasets: ${new Set([...questions.values()].map(q => q.dataset)).size}; questions: ${questions.size}; planned calls: ${tasks.length}`,
    `Input reservation per call: ceil(estimate × ${inputReservation.margin}) + ${inputReservation.allowance} tokens`];
  const names = new Set([...DATASETS.map(dataset => dataset.name), ...[...questions.values()].map(question => question.dataset)]);
  for (const name of names) {
    const count = [...questions.values()].filter(q => q.dataset === name).length;
    if (count) lines.push(`  ${name}: ${count} questions`);
  }
  for (const model of new Set(tasks.map(t => t.model.id))) {
    const subset = tasks.filter(t => t.model.id === model);
    lines.push(`Model ${model}: ${subset.length} calls`);
    for (const format of new Set(subset.map(task => task.format))) {
      const rows = subset.filter(t => t.format === format);
      lines.push(`  ${format}: ${rows.length} calls, ${rows.reduce((n, t) => n + t.estimatedInputTokens, 0)} estimated input tokens, ${rows.reduce((n, t) => n + reserveInput(t.estimatedInputTokens, inputReservation), 0)} reserved input tokens`);
    }
  }
  const costs = estimateCost(tasks, inputReservation, maxOutputTokens);
  for (const cost of costs.models) lines.push(`Reserved cost (USD), model ${cost.model}: $${cost.totalCost.toFixed(6)} (input $${cost.inputCost.toFixed(6)}; output $${cost.outputCost.toFixed(6)}; ${maxOutputTokens} output tokens per call)`);
  lines.push(`Reserved cost (USD), total: $${costs.totalCost.toFixed(6)}`);
  return lines.join('\n');
}
