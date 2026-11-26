import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { hash, loadSuite } from '../data.ts';
import { decode, encode } from '../formats.ts';
import { score } from '../scoring.ts';
import { generateReal, serializeReal } from './generate.ts';

const sources = {
  'usgs-earthquakes': 'usgs-earthquakes-all-day.geojson',
  'nws-gridpoint': 'nws-gridpoint-lwx-97-71.json',
} as const;
const formats = ['json-compact', 'toon', 'terset'] as const;

it.each(Object.entries(sources))('round trips the whole frozen %s document in each format', (name, file) => {
  const data: unknown = JSON.parse(readFileSync(new URL(`../../data/real/${file}`, import.meta.url), 'utf8'));
  const dataset = loadSuite('real').datasets.find(dataset => dataset.name === name);
  if (!dataset) throw new Error(`Missing dataset: ${name}`);
  expect(dataset.data).toStrictEqual(data);
  expect(dataset.corruption).toBeUndefined();
  for (const format of formats) {
    expect(decode(format, encode(format, dataset.data)), `${name}/${format}`).toStrictEqual(data);
  }
});

it('matches the committed files and records all source hashes', () => {
  const suite = loadSuite('real');
  const generated = serializeReal(generateReal());
  for (const name of ['datasets.json', 'questions.json'] as const) {
    const bytes = readFileSync(new URL(`../../data/real/${name}`, import.meta.url));
    expect(bytes.toString('utf8')).toBe(generated[name]);
    expect(hash(bytes)).toBe(suite.hashes[name]);
  }
  const sourceHashes = Object.fromEntries(Object.values(sources).map(file =>
    [file, hash(readFileSync(new URL(`../../data/real/${file}`, import.meta.url)))]));
  expect(suite.source).toEqual({ generatorSource: 'bench/src/real/generate.ts',
    generatorSha256: hash(readFileSync(new URL('./generate.ts', import.meta.url))), sourceHashes });
});

it('assigns 40 sequential ids and five scorable questions of each kind per dataset', () => {
  const { datasets, questions } = generateReal();
  expect(datasets.map(dataset => dataset.name)).toEqual(Object.keys(sources));
  expect(questions.map(question => question.id)).toEqual(
    Array.from({ length: 40 }, (_, index) => `r${String(index + 1).padStart(3, '0')}`),
  );
  for (const dataset of datasets) {
    const selected = questions.filter(question => question.dataset === dataset.name);
    expect(selected).toHaveLength(20);
    for (const kind of ['field-retrieval', 'count', 'extreme', 'nested-lookup']) {
      expect(selected.filter(question => question.type === kind)).toHaveLength(5);
    }
  }
  for (const question of questions) {
    expect(question.prompt).not.toMatch(/\b(?:json|toon|terset|format)\b/i);
    expect(question.groundTruth, question.id).not.toMatch(/^\s*$|^null$|[\t\n]/);
    expect(score(question.groundTruth, question), question.id).toBe(true);
    if (question.answerType === 'number') {
      expect(question.normalizationOptions?.tolerance ?? question.normalizationOptions?.decimalPlaces).toBeDefined();
    }
  }
});
