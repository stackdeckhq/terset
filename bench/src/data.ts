import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { datasetSchema, questionSchema } from './schema.ts';
import type { Dataset, Question } from './schema.ts';

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

export const suiteNameSchema = z.enum(['toon', 'stress']);
export type SuiteName = z.infer<typeof suiteNameSchema>;
export interface SuiteRecord {
  name: SuiteName;
  paths: { 'datasets.json': string; 'questions.json': string };
  hashes: Record<keyof typeof DATA_HASHES, string>;
  datasetNames: readonly string[];
  source: { upstreamSha: string } | { generatorSource: string; generatorSha256: string; seed: number; referenceDate: string };
}
export interface Suite extends SuiteRecord { datasets: Dataset[]; questions: Question[] }
export const SUITES: Record<SuiteName, SuiteRecord | null> = {
  toon: { name: 'toon', paths: { 'datasets.json': '../data/datasets.json', 'questions.json': '../data/questions.json' },
    hashes: DATA_HASHES, datasetNames: datasetNameSchema.options, source: { upstreamSha: UPSTREAM_SHA } },
  stress: {
    name: 'stress', paths: { 'datasets.json': '../data/stress/datasets.json', 'questions.json': '../data/stress/questions.json' },
    hashes: {
      'datasets.json': 'a827116f254dcb19483e6326f85ddec07d8721cf1849c4c8a504aa562eb63cab',
      'questions.json': '0a1e63fa6db21cc34bae61a4f6fb56aa7828bedb62854149bfbd041f41aa1c37',
    },
    datasetNames: [
      'scale-500', 'scale-750', 'scale-1000',
      'deep-object-6', 'deep-object-8', 'deep-object-10', 'deep-records-7', 'deep-records-8', 'deep-records-9',
      'messy-sparse', 'messy-states', 'messy-shapes', 'messy-text',
      'damage-control-1', 'damage-control-2', 'damage-control-3', 'damage-control-4', 'damage-control-5',
      'damage-control-6', 'damage-control-7', 'damage-control-8', 'damage-control-9', 'damage-control-10',
      'damage-control-11', 'damage-control-12',
      'damage-end-1', 'damage-end-9', 'damage-end-17',
      'damage-middle-70', 'damage-middle-150', 'damage-middle-220',
      'damage-extra-1', 'damage-extra-3',
      'damage-fields-0', 'damage-fields-150', 'damage-fields-299',
      'damage-duplicate-74', 'damage-duplicate-299',
    ],
    source: { generatorSource: 'bench/src/stress/generate.ts',
      generatorSha256: '36e8782fe7dad303057132ff4ea5e2f85ff1dce4135ba3b3b5fe05be24010cd1',
      seed: 20261117, referenceDate: '2026-11-17T00:00:00.000Z' },
  },
};
export class SuiteUnavailableError extends Error {
  constructor() { super('Stress suite is not frozen. Run the stress freeze step before selecting it.'); }
}

export function loadSuite(name: SuiteName = 'toon'): Suite {
  const record = SUITES[name];
  if (!record) throw new SuiteUnavailableError();
  const read = (file: keyof typeof DATA_HASHES): unknown => {
    const bytes = readFileSync(new URL(record.paths[file], import.meta.url));
    if (hash(bytes) !== record.hashes[file]) throw new Error(`Frozen input hash mismatch: ${file}`);
    return JSON.parse(bytes.toString('utf8')) as unknown;
  };
  const datasets = z.array(datasetSchema).parse(read('datasets.json'));
  const questions = z.array(questionSchema).parse(read('questions.json'));
  if (new Set(datasets.map(d => d.name)).size !== datasets.length
    || new Set(questions.map(q => q.id)).size !== questions.length
    || datasets.length !== record.datasetNames.length
    || datasets.some(d => !record.datasetNames.includes(d.name))
    || questions.some(q => !datasets.some(d => d.name === q.dataset))) {
    throw new Error('Frozen input ids must be unique and dataset references must exist');
  }
  return { ...record, datasets, questions };
}

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
export function selectQuestions(limit?: number, datasets?: readonly string[], suite: Suite = loadSuite()): Question[] {
  const selected = datasets ?? suite.datasetNames;
  if (!selected.length || new Set(selected).size !== selected.length || selected.some(name => !suite.datasetNames.includes(name))) {
    throw new Error('Datasets must be unique names in the selected suite');
  }
  const names = new Set(selected);
  const questions = suite.questions.filter(question => names.has(question.dataset));
  if (limit === undefined) return questions;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  const ids = new Set(suite.datasets.flatMap(dataset => suite.questions
    .filter(q => q.dataset === dataset.name)
    .sort((a, b) => hash(a.id).localeCompare(hash(b.id)))
    .slice(0, limit).map(q => q.id)));
  return questions.filter(q => ids.has(q.id));
}
