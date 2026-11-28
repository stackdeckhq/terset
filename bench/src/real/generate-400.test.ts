import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { hash, loadSuite } from '../data.ts';
import { datasetSchema } from '../schema.ts';
import type { Question } from '../schema.ts';
import { score } from '../scoring.ts';
import { generateReal400, serializeReal400 } from './generate-400.ts';

const directory = new URL('../../data/real/', import.meta.url);
const earthquakeFile = 'usgs-earthquakes-all-day.geojson';
const gridpointFile = 'nws-gridpoint-lwx-97-71.json';
const kinds = ['field-retrieval', 'count', 'extreme', 'nested-lookup', 'count-two-conditions', 'compare', 'position', 'rank'];

it('generates 400 questions and a separate 24-question pilot with stable ids and coverage', () => {
  const { questions, pilot } = generateReal400();
  expect(questions.map(q => q.id)).toEqual(Array.from({ length: 400 }, (_, i) => 'q' + String(i + 1).padStart(3, '0')));
  expect(pilot.map(q => q.id)).toEqual(Array.from({ length: 24 }, (_, i) => 'p' + String(i + 1).padStart(3, '0')));
  expect(new Set([...questions, ...pilot].map(q => q.prompt)).size).toBe(424);
  for (const dataset of ['usgs-earthquakes', 'nws-gridpoint']) {
    const full = questions.filter(q => q.dataset === dataset);
    const sample = pilot.filter(q => q.dataset === dataset);
    expect(full).toHaveLength(200);
    expect(sample).toHaveLength(12);
    for (const kind of kinds) {
      expect(full.filter(q => q.type === kind)).toHaveLength(25);
      expect(sample.some(q => q.type === kind)).toBe(true);
    }
    for (const kind of ['count', 'count-two-conditions']) {
      const occurrences = new Map<string, number>();
      for (const { groundTruth } of full.filter(q => q.type === kind)) {
        const count = (occurrences.get(groundTruth) ?? 0) + 1;
        expect(count).toBeLessThanOrEqual(3);
        occurrences.set(groundTruth, count);
      }
    }
  }
  for (const q of [...questions, ...pilot]) {
    expect(q.groundTruth, q.id).not.toMatch(/^\s*$|^null$|[\t\n]/);
    expect(score(q.groundTruth, q), q.id).toBe(true);
  }
});

it('rejects either changed source before parsing', () => {
  for (const file of [earthquakeFile, gridpointFile]) {
    expect(() => generateReal400(name => name === file ? Buffer.from('invalid JSON') : readFileSync(new URL(name, directory))))
      .toThrow(`Frozen source hash mismatch: ${file}`);
  }
});

it('reproduces the frozen files byte for byte and uses the original documents', () => {
  const generated = serializeReal400(generateReal400());
  expect(serializeReal400(generateReal400())).toEqual(generated);
  for (const [file, name] of [['questions.json', 'real-400'], ['pilot.json', 'real-400-pilot']] as const) {
    expect(readFileSync(new URL(`suite-400/${file}`, directory), 'utf8')).toBe(generated[file]);
    expect(loadSuite(name).source).toEqual({
      generatorSource: 'bench/src/real/generate-400.ts',
      generatorSha256: hash(readFileSync(new URL('./generate-400.ts', import.meta.url))),
      sourceHashes: Object.fromEntries([earthquakeFile, gridpointFile].map(file => [file, hash(readFileSync(new URL(file, directory)))])),
    });
  }
  const [earthquakes, gridpoint] = loadSuite('real').datasets;
  for (const [dataset, filename] of [[earthquakes, earthquakeFile], [gridpoint, gridpointFile]] as const) {
    expect(dataset?.data).toStrictEqual(datasetSchema.shape.data.parse(JSON.parse(readFileSync(new URL(filename, directory), 'utf8'))));
  }
});

const featuresSchema = z.array(z.object({
  id: z.string(), properties: datasetSchema.shape.data, geometry: z.object({ coordinates: z.array(z.number()) }),
}));
const timedValuesSchema = z.object({ values: z.array(z.object({ validTime: z.string(), value: z.json() })) });
const ordinals = ['second', 'third', 'fourth', 'fifth'];

function captures(q: Question, pattern: RegExp): string[] {
  const match = pattern.exec(q.prompt);
  if (!match) throw new Error(`Cannot check ${q.id}: ${q.prompt}`);
  return match.slice(1);
}

it('recomputes every count and rank from the source and verifies a unique record at each rank', () => {
  const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, directory), 'utf8'));
  const features = featuresSchema.parse(datasetSchema.shape.data.parse(read(earthquakeFile)).features);
  const properties = datasetSchema.shape.data.parse(datasetSchema.shape.data.parse(read(gridpointFile)).properties);
  const { questions, pilot } = generateReal400();
  for (const q of [...questions, ...pilot]) {
    if (q.type !== 'count' && q.type !== 'count-two-conditions' && q.type !== 'rank') continue;
    if (q.dataset === 'usgs-earthquakes') {
      if (q.type === 'rank') {
        const [net, rank, order, field = ''] = captures(q, /^Among features with properties\.net "(\w+)", which id has the (\w+) (highest|lowest) properties\.(\w+)\?$/);
        const rows = features.filter(row => row.properties.net === net).flatMap(row => {
          const value = row.properties[field];
          return typeof value === 'number' ? [{ id: row.id, value }] : [];
        });
        const winner = rows.filter(row => rows.filter(other => order === 'highest' ? other.value > row.value : other.value < row.value).length
          === ordinals.indexOf(rank ?? '') + 1);
        expect(winner.map(row => row.id), q.id).toEqual([q.groundTruth]);
      } else {
        const [field = '', threshold, net] = captures(q, /^How many features have properties\.(\w+) greater than (-?[\d.]+)(?: and properties\.net "(\w+)")?\?$/);
        expect(Boolean(net), q.id).toBe(q.type === 'count-two-conditions');
        const limit = Number(threshold);
        let count = 0;
        for (const row of features) {
          const value = row.properties[field];
          if (typeof value !== 'number') continue;
          expect(Math.abs(value - limit), q.id).toBeGreaterThan(1e-6);
          if (value > limit && (net === undefined || row.properties.net === net)) count++;
        }
        expect(q.groundTruth, q.id).toBe(String(count));
      }
    } else if (q.type === 'rank') {
      const [name = '', rank, order] = captures(q, /^In properties\.(\w+)\.values, what is the exact validTime of the entry with the (\w+) (highest|lowest) numeric value\?$/);
      const rows = timedValuesSchema.parse(properties[name]).values;
      const winner = rows.flatMap(({ value, validTime }) => {
        if (typeof value !== 'number') return [];
        const ahead = rows.filter(row => typeof row.value === 'number' && (order === 'highest' ? row.value > value : row.value < value));
        return ahead.length === ordinals.indexOf(rank ?? '') + 1 ? [validTime] : [];
      });
      expect(winner, q.id).toEqual([q.groundTruth]);
    } else {
      const [name = '', threshold, start] = captures(q, /^How many entries in properties\.(\w+)\.values have a numeric value greater than (-?[\d.]+)(?: and a validTime start at or after "([^"]+)")?\?$/);
      expect(Boolean(start), q.id).toBe(q.type === 'count-two-conditions');
      const rows = timedValuesSchema.parse(properties[name]).values;
      let count = 0;
      const limit = Number(threshold);
      for (const { value, validTime } of rows) {
        if (typeof value !== 'number') continue;
        expect(Math.abs(value - limit), q.id).toBeGreaterThan(1e-6);
        if (value > limit && (start === undefined || Date.parse(validTime.split('/')[0] ?? '') >= Date.parse(start))) count++;
      }
      expect(q.groundTruth, q.id).toBe(String(count));
    }
  }
});
