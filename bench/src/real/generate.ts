import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { hash, REAL_SOURCE_HASHES } from '../data.ts';
import { datasetSchema } from '../schema.ts';
import type { Dataset, Question } from '../schema.ts';

const earthquakesSchema = z.object({
  features: z.array(z.object({
    id: z.string(),
    properties: z.object({
      mag: z.number(), place: z.string(), magType: z.string(), status: z.string(), net: z.string(), sig: z.number(),
    }),
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }),
  })),
});

const gridpointSchema = z.object({
  id: z.string(),
  type: z.string(),
  properties: datasetSchema.shape.data,
});
const seriesSchema = z.object({
  uom: z.string().optional(),
  values: z.array(z.object({ validTime: z.string(), value: z.json() })),
});

type Kind = 'field-retrieval' | 'count' | 'extreme' | 'nested-lookup';
type Ask = (type: Kind, prompt: string, answer: string | number) => void;
interface RealData { datasets: Dataset[]; questions: Question[] }

function readSource(file: keyof typeof REAL_SOURCE_HASHES): Dataset['data'] {
  const bytes = readFileSync(new URL(`../../data/real/${file}`, import.meta.url));
  if (hash(bytes) !== REAL_SOURCE_HASHES[file]) throw new Error(`Frozen source hash mismatch: ${file}`);
  return datasetSchema.shape.data.parse(JSON.parse(bytes.toString('utf8')) as unknown);
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing record at index ${index}`);
  return item;
}

// Sample in source order at evenly spaced indices, including both endpoints.
function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length < count) throw new Error(`Expected at least ${count} records to sample`);
  return Array.from({ length: count }, (_, index) => at(items, Math.round(index * (items.length - 1) / (count - 1))));
}

function only<T>(items: readonly T[], label: string): T {
  if (items.length !== 1) throw new Error(`Expected one record for ${label}, found ${items.length}`);
  return at(items, 0);
}

function extreme<T>(records: readonly T[], valueOf: (record: T) => number, direction: 'min' | 'max') {
  if (records.length === 0) throw new Error('Cannot find an extreme in an empty list');
  const value = Math[direction](...records.map(valueOf));
  return { value, matching: records.filter(record => valueOf(record) === value) };
}

function earthquakeQuestions(data: Dataset['data'], ask: Ask): void {
  const { features } = earthquakesSchema.parse(data);
  if (new Set(features.map(feature => feature.id)).size !== features.length) throw new Error('Duplicate earthquake id');
  const selected = spread(features, 10);

  // Use alternating sample positions for properties and coordinates.
  const fields = ['mag', 'place', 'magType', 'status', 'net'] as const;
  for (const [index, field] of fields.entries()) {
    const feature = at(selected, 2 * index);
    ask('field-retrieval', `What is properties.${field} for the feature with id "${feature.id}"?`, feature.properties[field]);
  }

  for (const threshold of [1, 2.5, 4]) {
    ask('count', `How many features have properties.mag at or above ${threshold}?`,
      features.filter(feature => feature.properties.mag >= threshold).length);
  }
  for (const index of [0, selected.length - 1]) {
    const { net } = at(selected, index).properties;
    ask('count', `How many features have properties.net equal to "${net}"?`,
      features.filter(feature => feature.properties.net === net).length);
  }

  const maxMag = extreme(features, feature => feature.properties.mag, 'max');
  ask('extreme', 'What is the largest properties.mag among all features?', maxMag.value);
  ask('extreme', 'What is the id of the feature with the largest properties.mag?', only(maxMag.matching, 'largest properties.mag').id);

  const minDepth = extreme(features, feature => feature.geometry.coordinates[2], 'min');
  ask('extreme', 'What is the smallest depth (third entry in geometry.coordinates) among all features?', minDepth.value);
  ask('extreme', 'What is the id of the feature with the smallest depth (third entry in geometry.coordinates)?',
    only(minDepth.matching, 'smallest depth').id);
  ask('extreme', 'What is the smallest properties.sig among all features?', extreme(features, feature => feature.properties.sig, 'min').value);

  for (const [index, coordinate] of (['longitude', 'latitude', 'depth', 'longitude', 'latitude'] as const).entries()) {
    const feature = at(selected, 2 * index + 1);
    const coordinateIndex = index % 3;
    const position = at(['first', 'second', 'third'], coordinateIndex);
    ask('nested-lookup', `What is the ${coordinate} (${position} entry in geometry.coordinates) for the feature with id "${feature.id}"?`,
      at(feature.geometry.coordinates, coordinateIndex));
  }
}

function gridpointQuestions(data: Dataset['data'], ask: Ask): void {
  const grid = gridpointSchema.parse(data);
  const { properties } = grid;
  const series = Object.entries(properties).flatMap(([name, property]) => {
    if (!property || typeof property !== 'object' || Array.isArray(property) || !Object.hasOwn(property, 'values')) return [];
    return [{ name, ...seriesSchema.parse(property) }];
  });
  const withUnits = series.flatMap(series => series.uom === undefined ? [] : [{ name: series.name, uom: series.uom }]);
  const numeric = series.map(({ name, values }) => ({
    name,
    values: values.flatMap(({ validTime, value }) => typeof value === 'number' ? [{ validTime, value }] : []),
  })).filter(series => series.values.length > 0);

  for (const field of ['id', 'type'] as const) {
    ask('field-retrieval', `What is the top-level ${field}?`, grid[field]);
  }
  for (const { name, uom } of spread(withUnits, 3)) {
    ask('field-retrieval', `What is properties.${name}.uom?`, uom);
  }

  for (const { name, values } of spread(series.filter(series => series.values.length > 0), 5)) {
    ask('count', `How many entries are in properties.${name}.values, including entries with a null value?`, values.length);
  }

  for (const [name, direction, askForTime] of [
    ['temperature', 'max', true],
    ['relativeHumidity', 'min', true],
    ['windSpeed', 'max', false],
  ] as const) {
    const { values } = only(numeric.filter(series => series.name === name), name);
    const result = extreme(values, row => row.value, direction);
    const label = direction === 'min' ? 'smallest' : 'largest';
    ask('extreme', `For entries in properties.${name}.values, what is the ${label} number in the value field?`, result.value);
    if (askForTime) {
      ask('extreme', `In properties.${name}.values, what is the exact validTime of the entry whose value field has the ${label} number?`,
        only(result.matching, `${label} value in ${name}`).validTime);
    }
  }

  for (const [index, { name, values }] of spread(numeric, 5).entries()) {
    const { validTime, value } = at(values, Math.round(index * (values.length - 1) / 4));
    const { values: allValues } = only(series.filter(series => series.name === name), name);
    only(allValues.filter(row => row.validTime === validTime), `${name} at ${validTime}`);
    ask('nested-lookup', `What is the value in properties.${name}.values for the entry with validTime "${validTime}"?`, value);
  }
}

export function generateReal(): RealData {
  const earthquakes: Dataset = {
    name: 'usgs-earthquakes',
    description: 'USGS daily earthquake feed with a list of features, each with properties and coordinates.',
    data: readSource('usgs-earthquakes-all-day.geojson'),
    metadata: { supportsCSV: false, structureClass: 'nested', tabularEligibility: 0 },
  };
  const gridpoint: Dataset = {
    name: 'nws-gridpoint',
    description: 'National Weather Service gridpoint forecast with named series of timed values.',
    data: readSource('nws-gridpoint-lwx-97-71.json'),
    metadata: { supportsCSV: false, structureClass: 'deep', tabularEligibility: 0 },
  };
  const questions: Question[] = [];
  for (const [dataset, build] of [[earthquakes, earthquakeQuestions], [gridpoint, gridpointQuestions]] as const) {
    build(dataset.data, (type, prompt, answer) => {
      const answerType = type === 'count' ? 'integer' : typeof answer === 'number' ? 'number' : 'string';
      const normalizationOptions = answerType === 'number' ? { tolerance: 1e-6 }
        : answerType === 'string' ? { caseSensitive: true } : undefined;
      questions.push({
        id: `r${String(questions.length + 1).padStart(3, '0')}`,
        prompt, groundTruth: String(answer), type, dataset: dataset.name, answerType,
        ...(normalizationOptions === undefined ? {} : { normalizationOptions }),
      });
    });
  }
  return { datasets: [earthquakes, gridpoint], questions };
}

export function serializeReal(data: RealData): { 'datasets.json': string; 'questions.json': string } {
  return { 'datasets.json': `${JSON.stringify(data.datasets, null, 2)}\n`, 'questions.json': `${JSON.stringify(data.questions, null, 2)}\n` };
}
