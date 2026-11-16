import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { datasetSchema, questionSchema } from './schema.ts';

export const UPSTREAM_SHA = '22caca377f08d737789a2ca60ab02c425a3aa947';
export const DATA_HASHES = {
  'datasets.json': 'ee0ce056cb7c1cd01fa68d44c343ca72ae2dd1a443b54b82837472771a0c3b7e',
  'questions.json': 'af0121660a4c6a20e4f6b64a4e18b3dde9007799256af5f205fd959a20527b93',
} as const;

export const datasetNameSchema = z.enum([
  'tabular', 'nested', 'analytics', 'github', 'event-logs', 'nested-config',
  'structural-validation-control', 'structural-validation-truncated',
  'structural-validation-extra-rows', 'structural-validation-width-mismatch',
  'structural-validation-missing-fields', 'keyed', 'nested-group',
]);
export const selectedDatasetsSchema = z.array(datasetNameSchema).min(1)
  .refine(names => new Set(names).size === names.length, 'Datasets must be unique');

export function hash(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

export function readFrozen(name: keyof typeof DATA_HASHES): unknown {
  const bytes = readFileSync(new URL(`../data/${name}`, import.meta.url));
  if (hash(bytes) !== DATA_HASHES[name]) throw new Error(`Frozen input hash mismatch: ${name}`);
  return JSON.parse(bytes.toString('utf8')) as unknown;
}

export const DATASETS = z.array(datasetSchema).parse(readFrozen('datasets.json'));
export const QUESTIONS = z.array(questionSchema).parse(readFrozen('questions.json'));
if (new Set(DATASETS.map(d => d.name)).size !== DATASETS.length
  || new Set(QUESTIONS.map(q => q.id)).size !== QUESTIONS.length
  || QUESTIONS.some(q => !DATASETS.some(d => d.name === q.dataset))) {
  throw new Error('Frozen input ids must be unique and dataset references must exist');
}

// Sort by a stable hash, then restore upstream order in the selected subset.
export function selectQuestions(limit?: number, datasets: readonly string[] = datasetNameSchema.options): typeof QUESTIONS {
  const names = new Set<string>(selectedDatasetsSchema.parse(datasets));
  const questions = QUESTIONS.filter(question => names.has(question.dataset));
  if (limit === undefined) return questions;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  const ids = new Set(DATASETS.flatMap(dataset => QUESTIONS
    .filter(q => q.dataset === dataset.name)
    .sort((a, b) => hash(a.id).localeCompare(hash(b.id)))
    .slice(0, limit).map(q => q.id)));
  return questions.filter(q => ids.has(q.id));
}
