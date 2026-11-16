import { DATASETS, hash } from './data.ts';
import { encode, encodeDataset, estimateInputTokens, makePrompt, primerFor } from './formats.ts';
import type { Prompt } from './formats.ts';
import { FORMATS, inputReservationSchema, modelSchema, selectedFormatsSchema } from './schema.ts';
import type { Format, InputReservation, Model, Question } from './schema.ts';

export interface Task { model: Model; format: Format; question: Question; prompt: Prompt; estimatedInputTokens: number }
export function key(task: Pick<Task, 'model' | 'format' | 'question'>): string {
  return JSON.stringify([task.model.id, task.format, task.question.dataset, task.question.id]);
}

export function plan(models: Model[], questions: Question[], formats: readonly Format[] = FORMATS): Task[] {
  formats = selectedFormatsSchema.parse(formats);
  models = models.map(model => modelSchema.parse(model));
  if (new Set(models.map(m => m.id)).size !== models.length) throw new Error('Model ids must be unique');
  const encoded = new Map<string, { data: string; primer: string }>();
  for (const dataset of DATASETS) {
    if (!questions.some(question => question.dataset === dataset.name)) continue;
    for (const format of formats) encoded.set(JSON.stringify([dataset.name, format]), {
      primer: primerFor(format, encode(format, dataset.data)),
      data: encodeDataset(format, dataset),
    });
  }
  return questions.flatMap(question => models.flatMap(model => formats.map(format => {
    const encodedDataset = encoded.get(JSON.stringify([question.dataset, format]));
    if (encodedDataset === undefined) throw new Error('Unknown dataset');
    const prompt = makePrompt(question, format, encodedDataset.data, encodedDataset.primer);
    return { model, format, question, prompt, estimatedInputTokens: estimateInputTokens(prompt) };
  })));
}

export function fingerprint(tasks: Task[], mode: string, maxOutputTokens: number): string {
  return hash(JSON.stringify({ version: 1, mode, maxOutputTokens, tasks }));
}

export function reserveInput(estimate: number, config: InputReservation): number {
  const reserved = Math.ceil(estimate * config.margin) + config.allowance;
  if (!Number.isSafeInteger(reserved) || reserved < 0) throw new Error('Invalid input token reservation');
  return reserved;
}

export function describePlan(tasks: Task[], inputReservation: InputReservation = inputReservationSchema.parse({})): string {
  const questions = new Map(tasks.map(t => [t.question.id, t.question]));
  const lines = ['Call plan (o200k_base estimates include shared instructions and each format primer; API framing excluded)',
    `Datasets: ${new Set([...questions.values()].map(q => q.dataset)).size}; questions: ${questions.size}; planned calls: ${tasks.length}`,
    `Input reservation per call: ceil(estimate × ${inputReservation.margin}) + ${inputReservation.allowance} tokens`];
  for (const dataset of DATASETS) {
    const count = [...questions.values()].filter(q => q.dataset === dataset.name).length;
    if (count) lines.push(`  ${dataset.name}: ${count} questions`);
  }
  for (const model of new Set(tasks.map(t => t.model.id))) {
    const subset = tasks.filter(t => t.model.id === model);
    lines.push(`Model ${model}: ${subset.length} calls`);
    for (const format of new Set(subset.map(task => task.format))) {
      const rows = subset.filter(t => t.format === format);
      lines.push(`  ${format}: ${rows.length} calls, ${rows.reduce((n, t) => n + t.estimatedInputTokens, 0)} estimated input tokens, ${rows.reduce((n, t) => n + reserveInput(t.estimatedInputTokens, inputReservation), 0)} reserved input tokens`);
    }
  }
  return lines.join('\n');
}
