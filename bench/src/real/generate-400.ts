import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { hash, REAL_SOURCE_HASHES } from '../data.ts';
import { datasetSchema } from '../schema.ts';
import type { Question } from '../schema.ts';

const sourceDirectory = new URL('../../data/real/', import.meta.url);
type SourceFile = keyof typeof REAL_SOURCE_HASHES;
type Data = z.infer<typeof datasetSchema.shape.data>;
const kinds = ['field-retrieval', 'count', 'extreme', 'nested-lookup', 'count-two-conditions', 'compare', 'position', 'rank'] as const;
type Kind = typeof kinds[number];
type Candidate = Pick<Question, 'prompt' | 'groundTruth' | 'answerType' | 'normalizationOptions'>;
type Candidates = Record<Kind, Candidate[]>;

const numberFields = ['mag', 'sig', 'nst', 'dmin', 'rms', 'gap'] as const;
const featureSchema = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number(), sig: z.number(), nst: z.number().nullable(), dmin: z.number().nullable(),
    rms: z.number().nullable(), gap: z.number().nullable(),
    net: z.string(), place: z.string(), magType: z.string(), status: z.string(), type: z.string(),
  }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]) }),
});
const seriesSchema = z.object({
  uom: z.string().optional(),
  values: z.array(z.object({ validTime: z.string(), value: z.json() })),
});
const directions = ['highest', 'lowest'] as const;
const ordinals = ['second', 'third', 'fourth', 'fifth'];
type NumericRecord = { id: string; value: number };

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing record at index ${index}`);
  return item;
}

function answer(prompt: string, value: string | number): Candidate {
  if (typeof value === 'string') {
    return { prompt, groundTruth: value, answerType: 'string', normalizationOptions: { caseSensitive: true } };
  }
  return { prompt, groundTruth: String(value), answerType: 'number', normalizationOptions: { tolerance: 1e-6 } };
}

function countAnswer(prompt: string, count: number): Candidate {
  return { prompt, groundTruth: String(count), answerType: 'integer' };
}

function sortValues(rows: NumericRecord[], direction: typeof directions[number]): NumericRecord[] {
  return rows.toSorted((a, b) => direction === 'highest' ? b.value - a.value : a.value - b.value);
}

function ranks(rows: NumericRecord[], prompt: (rank: string, direction: string) => string): Candidate[] {
  if (rows.length < 6) return [];
  return directions.flatMap(direction => {
    const sorted = sortValues(rows, direction);
    return ordinals.flatMap((ordinal, i) => {
      const row = at(sorted, i + 1);
      const unique = row.value !== at(sorted, i).value && row.value !== at(sorted, i + 2).value;
      return unique ? [answer(prompt(ordinal, direction), row.id)] : [];
    });
  });
}

// Pick a readable threshold inside each gap, clear of either endpoint.
function thresholds(rows: NumericRecord[]): number[] {
  const values = [...new Set(rows.map(row => row.value))].sort((a, b) => a - b);
  return values.slice(1).flatMap((high, i) => {
    const low = at(values, i);
    for (let decimals = 0; decimals <= 6; decimals++) {
      const threshold = Number(((high + low) / 2).toFixed(decimals));
      if (threshold - low > 1e-6 && high - threshold > 1e-6) return [threshold];
    }
    return [];
  });
}

function earthquakeCandidates(data: Data): Candidates {
  const features = z.array(featureSchema).parse(data.features);
  if (new Set(features.map(row => row.id)).size !== features.length) throw new Error('Duplicate earthquake id');
  const nets = [...new Set(features.map(row => row.properties.net))];
  const fieldRetrieval = features.map(({ id, properties }, i) => {
    const fields = ['mag', 'place', 'magType', 'status', 'net', 'sig', 'type'] as const;
    const field = at(fields, i % fields.length);
    return answer(`What is properties.${field} for the feature with id "${id}"?`, properties[field]);
  });
  const nestedLookup = features.map(({ id, geometry }, i) => {
    const index = i % 3;
    return answer(`What is the ${at(['longitude', 'latitude', 'depth'], index)} (${at(['first', 'second', 'third'], index)} entry in geometry.coordinates) for the feature with id "${id}"?`,
      at(geometry.coordinates, index));
  });
  const position = features.slice(1, -1).map(({ id }, i) => {
    const after = i % 2 === 0;
    return answer(`In the given features order, what is the id of the feature immediately ${after ? 'after' : 'before'} "${id}"?`,
      at(features, i + (after ? 2 : 0)).id);
  });
  const compare = features.slice(0, -17).flatMap((a, i) => {
    const b = at(features, i + 17);
    const field = at(numberFields, i % numberFields.length);
    const direction = at(directions, Math.floor(i / numberFields.length) % 2);
    const av = a.properties[field];
    const bv = b.properties[field];
    if (av === null || bv === null || av === bv) return [];
    const aWins = direction === 'highest' ? av > bv : av < bv;
    return [answer(`Which feature id, "${a.id}" or "${b.id}", has the ${direction === 'highest' ? 'larger' : 'smaller'} properties.${field}?`,
      aWins ? a.id : b.id)];
  });

  const count: Candidate[] = [];
  const countTwoConditions: Candidate[] = [];
  const extreme: Candidate[] = [];
  const rank: Candidate[] = [];
  for (const field of numberFields) {
    const rows = features.flatMap(({ id, properties }) => {
      const value = properties[field];
      return value === null ? [] : [{ id, net: properties.net, value }];
    });
    for (const threshold of thresholds(rows)) {
      const above = rows.filter(row => row.value > threshold);
      const filter = `How many features have properties.${field} greater than ${threshold}`;
      count.push(countAnswer(`${filter}?`, above.length));
      for (const net of nets) {
        const total = above.filter(row => row.net === net).length;
        if (total > 0 && total < above.length && total < rows.filter(row => row.net === net).length) {
          countTwoConditions.push(countAnswer(`${filter} and properties.net "${net}"?`, total));
        }
      }
    }
    for (const net of nets) {
      const group = rows.filter(row => row.net === net);
      if (group.length < 6) continue;
      for (const direction of directions) {
        extreme.push(answer(`Among features with properties.net "${net}", what is the ${direction} numeric properties.${field}?`,
          at(sortValues(group, direction), 0).value));
      }
      rank.push(...ranks(group, (ordinal, direction) =>
        `Among features with properties.net "${net}", which id has the ${ordinal} ${direction} properties.${field}?`));
    }
  }
  return { 'field-retrieval': fieldRetrieval, count, extreme, 'nested-lookup': nestedLookup,
    'count-two-conditions': countTwoConditions, compare, position, rank };
}

function gridpointCandidates(data: Data): Candidates {
  const properties = datasetSchema.shape.data.parse(data.properties);
  const series = Object.entries(properties).flatMap(([name, property]) => {
    if (!property || typeof property !== 'object' || Array.isArray(property) || !Object.hasOwn(property, 'values')) return [];
    const { uom, values } = seriesSchema.parse(property);
    const numeric = values.flatMap(({ validTime, value }) => typeof value === 'number' ? [{ id: validTime, value }] : []);
    if (new Set(values.map(row => row.validTime)).size !== values.length) throw new Error(`Duplicate validTime in ${name}`);
    return [{ name, uom, values, numeric }];
  });
  const fieldRetrieval = [
    ...['id', 'type'].map(field => answer(`What is the top-level ${field}?`, z.string().parse(data[field]))),
    ...Object.entries(properties).flatMap(([field, value]) => typeof value === 'string' || typeof value === 'number'
      ? [answer(`What is properties.${field}?`, value)] : []),
    ...series.flatMap(({ name, uom }) => uom === undefined ? [] : [answer(`What is properties.${name}.uom?`, uom)]),
  ];
  const nestedLookup: Candidate[] = [];
  const count: Candidate[] = [];
  const countTwoConditions: Candidate[] = [];
  const extreme: Candidate[] = [];
  const position: Candidate[] = [];
  const rank: Candidate[] = [];
  const compare: Candidate[] = [];
  for (const [index, { name, uom, values, numeric }] of series.entries()) {
    const path = `properties.${name}.values`;
    for (const [i, { validTime, value }] of values.entries()) {
      if (typeof value === 'number') {
        nestedLookup.push(answer(`What is the value in ${path} for the entry with validTime "${validTime}"?`, value));
      }
      if (i % 3 === 1) {
        position.push(answer(`What is the exact validTime of entry ${i + 1} in ${path}, counting from 1 in the given order?`, validTime));
      }
    }
    if (numeric.length > 1 && new Set(numeric.map(row => row.value)).size > 1) {
      for (const direction of directions) {
        extreme.push(answer(`In ${path}, what is the ${direction} numeric value?`, at(sortValues(numeric, direction), 0).value));
      }
      rank.push(...ranks(numeric, (ordinal, direction) =>
        `In ${path}, what is the exact validTime of the entry with the ${ordinal} ${direction} numeric value?`));
    }
    for (const threshold of thresholds(numeric)) {
      const filter = `How many entries in ${path} have a numeric value greater than ${threshold}`;
      const above = numeric.filter(row => row.value > threshold);
      count.push(countAnswer(`${filter}?`, above.length));
      // validTime starts with an ISO timestamp, followed by a slash and a duration.
      for (let i = 7; i < numeric.length; i += 11) {
        const start = at(at(numeric, i).id.split('/'), 0);
        const atOrAfter = (row: NumericRecord): boolean => Date.parse(at(row.id.split('/'), 0)) >= Date.parse(start);
        const total = above.filter(atOrAfter).length;
        if (total > 0 && total < above.length && total < numeric.filter(atOrAfter).length) {
          countTwoConditions.push(countAnswer(`${filter} and a validTime start at or after "${start}"?`, total));
        }
      }
    }
    for (const other of series.slice(index + 1).filter(series => uom !== undefined && series.uom === uom)) {
      const byTime = new Map(other.numeric.map(row => [row.id, row.value]));
      for (const [i, { id, value }] of numeric.entries()) {
        const otherValue = byTime.get(id);
        if (otherValue === undefined || otherValue === value) continue;
        const larger = i % 2 === 0;
        const aWins = larger ? value > otherValue : value < otherValue;
        compare.push(answer(`At the exact validTime "${id}", which series has the ${larger ? 'larger' : 'smaller'} value, ${name} or ${other.name}?`,
          aWins ? name : other.name));
      }
    }
  }
  return { 'field-retrieval': fieldRetrieval, count, extreme, 'nested-lookup': nestedLookup,
    'count-two-conditions': countTwoConditions, compare, position, rank };
}

function sample(pool: Candidate[], size: number, offset: number, limitRepeats: boolean): Candidate[] {
  const selected = new Map<number, Candidate>();
  const counts = new Map<string, number>();
  const stride = Math.floor(pool.length / size);
  // First take regularly spaced candidates. Fill any gaps from the next offsets.
  for (let i = 0; i < stride && selected.size < size; i++) {
    for (let index = (offset + i) % stride; index < pool.length && selected.size < size; index += stride) {
      const candidate = at(pool, index);
      const count = counts.get(candidate.groundTruth) ?? 0;
      if (limitRepeats && count >= 3) continue;
      selected.set(index, candidate);
      counts.set(candidate.groundTruth, count + 1);
    }
  }
  if (selected.size !== size) throw new Error(`Cannot sample ${size} questions from ${pool.length} candidates`);
  return [...selected].sort(([a], [b]) => a - b).map(([, question]) => question);
}

interface Real400 { questions: Question[]; pilot: Question[] }

export function generateReal400(read: (file: SourceFile) => Buffer = file => readFileSync(new URL(file, sourceDirectory))): Real400 {
  const earthquakeFile = 'usgs-earthquakes-all-day.geojson';
  const gridpointFile = 'nws-gridpoint-lwx-97-71.json';
  const sources = [[earthquakeFile, read(earthquakeFile)], [gridpointFile, read(gridpointFile)]] as const;
  for (const [file, bytes] of sources) {
    if (hash(bytes) !== REAL_SOURCE_HASHES[file]) throw new Error(`Frozen source hash mismatch: ${file}`);
  }
  const parse = (bytes: Buffer): Data => datasetSchema.shape.data.parse(JSON.parse(bytes.toString('utf8')) as unknown);
  const datasets = [
    ['usgs-earthquakes', earthquakeCandidates(parse(sources[0][1]))],
    ['nws-gridpoint', gridpointCandidates(parse(sources[1][1]))],
  ] as const;
  const questions: Question[] = [];
  const pilot: Question[] = [];
  const prompts = new Set<string>();
  for (const [dataset, candidates] of datasets) {
    for (const [i, type] of kinds.entries()) {
      const append = (target: Question[], prefix: string, picked: Candidate[]): void => {
        for (const candidate of picked) {
          if (prompts.has(candidate.prompt)) throw new Error(`Repeated prompt: ${candidate.prompt}`);
          prompts.add(candidate.prompt);
          target.push({ id: `${prefix}${String(target.length + 1).padStart(3, '0')}`, type, dataset, ...candidate });
        }
      };
      const pool = candidates[type];
      const limitRepeats = type === 'count' || type === 'count-two-conditions';
      append(questions, 'q', sample(pool, 25, i, limitRepeats));
      append(pilot, 'p', sample(pool.filter(candidate => !prompts.has(candidate.prompt)), i % 2 === 0 ? 2 : 1, i + 3, limitRepeats));
    }
  }
  return { questions, pilot };
}

export function serializeReal400({ questions, pilot }: Real400): Record<'questions.json' | 'pilot.json', string> {
  return { 'questions.json': `${JSON.stringify(questions, null, 2)}\n`, 'pilot.json': `${JSON.stringify(pilot, null, 2)}\n` };
}
