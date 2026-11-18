import type { Corruption, Dataset, Question } from '../schema.ts';

export const STRESS_SEED = 20261117;
export const REFERENCE_DATE = '2026-11-17T00:00:00.000Z';
export interface StressData { datasets: Dataset[]; questions: Question[] }

// Mulberry32 uses only 32-bit integer operations. No clock, locale or global RNG.
function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing generated value');
  return value;
}

type JsonRecord = Dataset['data'];
function nested(depth: number, value: number, name: string): JsonRecord {
  let object: JsonRecord = { name, value };
  for (let level = depth - 1; level >= 1; level--) object = { name: `level-${level}`, value: value + level, child: object };
  return object;
}

function leafPath(prefix: string, depth: number): string {
  return `${prefix}${'.child'.repeat(depth - 1)}`;
}

function completeAfterDamage(rows: JsonRecord[], corruption: Corruption): boolean {
  const changed = structuredClone(rows);
  switch (corruption.kind) {
    case 'control': break;
    case 'truncated': changed.splice(corruption.startIndex ?? changed.length - corruption.removeRecordCount, corruption.removeRecordCount); break;
    case 'extra-rows': changed.push(...corruption.appendRecords); break;
    case 'duplicate-row': changed.splice(corruption.targetRecordIndex + 1, 0, required(changed[corruption.targetRecordIndex])); break;
    case 'missing-fields':
    case 'width-mismatch':
      for (const index of corruption.targetRecordIndices) {
        changed[index] = Object.fromEntries(Object.entries(required(changed[index])).filter(([key]) => key !== corruption.targetFieldName));
      }
  }
  return changed.length === rows.length
    && changed.every(row => Object.keys(required(rows[0])).every(key => Object.hasOwn(row, key)))
    && new Set(changed.map(row => row.id)).size === rows.length;
}

export function generateStress(seed = STRESS_SEED): StressData {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  const random = randomSource(seed);
  const integer = (max: number): number => Math.floor(random() * max);
  const datasets: Dataset[] = [];
  const questions: Question[] = [];
  function dataset(name: string, data: JsonRecord, description: string, corruption?: Corruption): Dataset {
    const result: Dataset = { name, description, data,
      metadata: { supportsCSV: false, structureClass: name.split('-')[0] ?? name, tabularEligibility: 0 },
      ...(corruption ? { corruption } : {}) };
    datasets.push(result);
    return result;
  }
  function ask(source: Dataset, prompt: string, answer: string | number | boolean, answerType: Question['answerType']): void {
    questions.push({ id: `s${String(questions.length + 1).padStart(3, '0')}`, prompt, groundTruth: String(answer),
      type: source.name.startsWith('damage-') ? 'structural-validation' : required(source.name.split('-')[0]),
      dataset: source.name, answerType, ...(answerType === 'string' ? { normalizationOptions: { caseSensitive: true } } : {}) });
  }
  function at(source: Dataset, path: string, answer: string | number): void {
    const wording = path.includes('[') ? 'Using zero-based list indices, what' : 'What';
    ask(source, `${wording} is the value at ${path}?`, answer, typeof answer === 'number' ? 'integer' : 'string');
  }

  for (const size of [500, 750, 1000]) {
    const rows = Array.from({ length: size }, (_, index) => ({ id: index + 1, team: required(['Amber', 'Cobalt', 'Jade'][integer(3)]),
      value: integer(900) + 100, units: integer(40) + 1, active: integer(2) === 1 }));
    const source = dataset(`scale-${size}`, { records: rows }, `${size} records with late lookups, filters and whole-list sums.`);
    for (const index of [size - 1, size - 7]) {
      at(source, `records[${index}].value`, required(rows[index]).value);
      at(source, `records[${index}].team`, required(rows[index]).team);
    }
    for (const team of ['Amber', 'Jade']) ask(source, `How many records have team equal to "${team}"?`, rows.filter(row => row.team === team).length, 'integer');
    ask(source, 'How many records have active equal to true?', rows.filter(row => row.active).length, 'integer');
    for (const field of ['value', 'units'] as const) ask(source, `What is the sum of numeric values in field ${field}?`, rows.reduce((n, row) => n + row[field], 0), 'integer');
    ask(source, 'What is the sum of numeric values in field value for records with team equal to "Cobalt"?', rows.filter(row => row.team === 'Cobalt').reduce((n, row) => n + row.value, 0), 'integer');
  }

  for (const depth of [6, 8, 10]) {
    const value = integer(9000) + 1000;
    const name = `leaf-${depth}-${integer(10000)}`;
    const source = dataset(`deep-object-${depth}`, { root: nested(depth, value, name) }, `${depth} object levels with repeated name and value keys.`);
    const leaf = leafPath('root', depth);
    at(source, `${leaf}.value`, value);
    at(source, `${leaf}.name`, name);
    at(source, 'root.value', value + 1);
    at(source, 'root.child.value', value + 2);
  }
  for (const depth of [7, 8, 9]) {
    const leaves = Array.from({ length: 48 }, (_, index) => ({ name: `leaf-${depth}-${index}-${integer(1000)}`, value: integer(9000) + 1000 }));
    // branch + child links + value makes exactly depth dotted header segments.
    const rows = leaves.map((leaf, index) => ({ id: index + 1, branch: nested(depth - 1, leaf.value, leaf.name) }));
    const source = dataset(`deep-records-${depth}`, { records: rows }, `Record leaves at ${depth} header segments. Nine exceeds the eight-segment cap and retains JSON in a cell.`);
    for (const index of [47, 39]) {
      const leaf = required(leaves[index]);
      const path = leafPath(`records[${index}].branch`, depth - 1);
      at(source, `${path}.value`, leaf.value);
      at(source, `${path}.name`, leaf.name);
    }
    if (depth === 9) at(source, 'records[47].id', required(rows[47]).id);
  }

  const literals = ['007', '1e5', 'true', 'null'] as const;
  const sparse: { id: number; score?: number; note?: string; tag?: string }[] = Array.from({ length: 120 }, (_, index) => ({ id: index + 1,
    ...(random() < 0.3 ? {} : { score: integer(1000) }),
    ...(random() < 0.3 ? {} : { note: `note-${index}-${integer(1000)}` }),
    ...(random() < 0.3 ? {} : { tag: required(literals[index % literals.length]) }) }));
  const sparseSource = dataset('messy-sparse', { records: sparse }, 'Each optional field is independently omitted with probability 0.30.');
  const missing = (field: string): string => `How many records are missing the ${field} field entirely?`;
  const present = (field: string): string => `How many records include a ${field} field, counting null and empty values?`;
  for (const field of ['score', 'note', 'tag'] as const) {
    ask(sparseSource, missing(field), sparse.filter(row => !Object.hasOwn(row, field)).length, 'integer');
    ask(sparseSource, present(field), sparse.filter(row => Object.hasOwn(row, field)).length, 'integer');
  }
  ask(sparseSource, 'What is the sum of numeric values in field score?', sparse.reduce((n, row) => n + (row.score ?? 0), 0), 'integer');
  for (const field of ['score', 'note', 'tag'] as const) {
    const index = sparse.findLastIndex(row => row[field] !== undefined);
    at(sparseSource, `records[${index}].${field}`, required(required(sparse[index])[field]));
  }

  // Uneven random states and literals, so no field names a record's state and counts differ.
  const states = Array.from({ length: 96 }, (_, index) => {
    const state = integer(10);
    return { id: index + 1, literal: required(literals[integer(literals.length)]),
      ...(state < 2 ? {} : { text: state < 5 ? null : state < 6 ? '' : `text-${integer(10000)}` }) };
  });
  const statesSource = dataset('messy-states', { records: states, referenceDate: REFERENCE_DATE }, 'Absent, null, empty and nonempty text remain distinct.');
  ask(statesSource, missing('text'), states.filter(row => !Object.hasOwn(row, 'text')).length, 'integer');
  ask(statesSource, present('text'), states.filter(row => Object.hasOwn(row, 'text')).length, 'integer');
  ask(statesSource, 'How many records have a null text?', states.filter(row => row.text === null).length, 'integer');
  ask(statesSource, 'How many records have an empty string in text?', states.filter(row => row.text === '').length, 'integer');
  for (const literal of literals) ask(statesSource, `How many records have literal equal to "${literal}"?`, states.filter(row => row.literal === literal).length, 'integer');
  for (const index of [92, 95]) at(statesSource, `records[${index}].literal`, required(states[index]).literal);

  const shapes = Array.from({ length: 90 }, (_, index) => {
    const id = index + 1;
    switch (integer(3)) {
      case 0: return { id, kind: 'sensor', temp: integer(80) - 20, unit: 'C' };
      case 1: return { id, kind: 'person', name: `person-${integer(100000)}`, credits: integer(500) };
      default: return { id, kind: 'event', code: `E${integer(1000)}`, amount: integer(400), at: REFERENCE_DATE };
    }
  });
  const shapesSource = dataset('messy-shapes', { records: shapes }, 'One list interleaves sensor, person and event record shapes.');
  for (const kind of ['sensor', 'person', 'event']) ask(shapesSource, `How many records have kind equal to "${kind}"?`, shapes.filter(row => row.kind === kind).length, 'integer');
  for (const field of ['temp', 'credits', 'amount'] as const) ask(shapesSource, `What is the sum of numeric values in field ${field}?`, shapes.reduce((n, row) => n + (row[field] ?? 0), 0), 'integer');
  const lastOf = (kind: string): number => shapes.findLastIndex(row => row.kind === kind);
  const sensor = lastOf('sensor');
  const person = lastOf('person');
  const event = lastOf('event');
  at(shapesSource, `records[${sensor}].temp`, required(required(shapes[sensor]).temp));
  at(shapesSource, `records[${person}].name`, required(required(shapes[person]).name));
  at(shapesSource, `records[${event}].code`, required(required(shapes[event]).code));
  at(shapesSource, `records[${event}].at`, required(required(shapes[event]).at));

  const texts = Array.from({ length: 24 }, (_, index) => {
    const tabs = 24 + 2 * integer(6);
    return { id: index + 1, literal: required(literals[index % 4]), language: required(['日本語', 'العربية', '한국어', 'हिन्दी'][index % 4]), tabs,
      text: `Entry ${index + 1}: commas, inside, text; "quoted words" and a backslash \\ here.\nSecond line with tabs: ${'left\tright\t'.repeat(tabs / 2)}東京, مرحبا, 서울, नमस्ते. End ${integer(100000)}.` };
  });
  const textSource = dataset('messy-text', { records: texts }, 'Long text includes quotes, commas, newlines, many tabs, backslashes and non-Latin text.');
  // Answers never contain a tab or line break, so scoring tests reading, not output escaping.
  for (const index of [0, 11]) {
    ask(textSource, `Using zero-based list indices, what is the first line of records[${index}].text, the text before its first line break?`,
      required(required(texts[index]).text.split('\n')[0]), 'string');
  }
  for (const index of [5, 17]) {
    ask(textSource, `Using zero-based list indices, what number follows the word "End" in records[${index}].text?`,
      required(/End (\d+)\./.exec(required(texts[index]).text)?.[1]), 'integer');
  }
  for (const index of [0, 1, 2, 3]) at(textSource, `records[${index}].literal`, required(texts[index]).literal);
  ask(textSource, 'What is the sum of numeric values in field tabs?', texts.reduce((n, row) => n + row.tabs, 0), 'integer');
  at(textSource, 'records[23].language', required(texts[23]).language);

  function damage(name: string, corruption: Corruption): void {
    const damageRows = Array.from({ length: 300 }, (_, index) => ({ id: index + 1, code: `R${String(index + 1).padStart(3, '0')}`, score: integer(1000), active: integer(2) === 1 }));
    const source = dataset(`damage-${name}`, { records: damageRows }, 'Encode a valid 300-row list, then damage only its rows while retaining its original headers.', corruption);
    ask(source, 'Is this data complete and valid? Answer only YES or NO.', completeAfterDamage(damageRows, corruption) ? 'YES' : 'NO', 'boolean');
  }
  // 12 clean controls and 13 damaged lists, so always answering NO or YES scores about half.
  for (let index = 0; index < 12; index++) damage(`control-${index + 1}`, { kind: 'control', targetKey: 'records' });
  for (const count of [1, 9, 17]) damage(`end-${count}`, { kind: 'truncated', targetKey: 'records', removeRecordCount: count });
  for (const index of [70, 150, 220]) damage(`middle-${index}`, { kind: 'truncated', targetKey: 'records', removeRecordCount: 2, startIndex: index });
  for (const count of [1, 3]) damage(`extra-${count}`, { kind: 'extra-rows', targetKey: 'records',
    appendRecords: Array.from({ length: count }, (_, index) => ({ id: 301 + index, code: `X${index}`, score: integer(1000), active: false })) });
  for (const index of [0, 150, 299]) damage(`fields-${index}`, { kind: index % 2 === 0 ? 'missing-fields' : 'width-mismatch', targetKey: 'records', targetRecordIndices: [index], targetFieldName: 'score' });
  for (const index of [74, 299]) damage(`duplicate-${index}`, { kind: 'duplicate-row', targetKey: 'records', targetRecordIndex: index });
  return { datasets, questions };
}

export function serializeStress(data: StressData): { 'datasets.json': string; 'questions.json': string } {
  return { 'datasets.json': `${JSON.stringify(data.datasets, null, 2)}\n`, 'questions.json': `${JSON.stringify(data.questions, null, 2)}\n` };
}
