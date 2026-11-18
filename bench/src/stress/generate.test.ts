import { expect, it } from 'vitest';
import { QUESTIONS } from '../data.ts';
import { decode, encode, encodeDataset, estimateInputTokens, makePrompt, primerFor } from '../formats.ts';
import { datasetSchema, FORMATS, questionSchema } from '../schema.ts';
import type { Dataset } from '../schema.ts';
import { score } from '../scoring.ts';
import { generateStress, serializeStress } from './generate.ts';

it('generates byte-identical data with the same seed and different data with another', () => {
  expect(serializeStress(generateStress(12345))).toEqual(serializeStress(generateStress(12345)));
  expect(serializeStress(generateStress(12345))).not.toEqual(serializeStress(generateStress(54321)));
});

function readPath(data: Dataset['data'], path: string): unknown {
  let value: unknown = data;
  for (const key of path.replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (!value || typeof value !== 'object' || !(key in value)) throw new Error(`Missing path: ${path}`);
    value = Reflect.get(value, key);
  }
  return value;
}

function records(dataset: Dataset): Record<string, unknown>[] {
  const value = dataset.data.records;
  if (!Array.isArray(value)) throw new Error('Expected records');
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Expected record');
    return row;
  });
}

// A separate reader interprets the plain questions. It never calls the
// generator's answer-building code or uses a question id to choose an answer.
function recompute(dataset: Dataset, prompt: string): string {
  const path = /^(?:What|Using zero-based list indices, what) is the value at (.+)\?$/.exec(prompt)?.[1];
  if (path) return String(readPath(dataset.data, path));
  const firstLine = /^Using zero-based list indices, what is the first line of (.+), the text before its first line break\?$/.exec(prompt)?.[1];
  if (firstLine) return String(readPath(dataset.data, firstLine)).split('\n')[0] ?? '';
  const endNumber = /^Using zero-based list indices, what number follows the word "End" in (.+)\?$/.exec(prompt)?.[1];
  if (endNumber) return /End (\d+)\./.exec(String(readPath(dataset.data, endNumber)))?.[1] ?? '';
  const rows = records(dataset);
  const filtered = /^How many records have (team|kind|literal) equal to "([^"]+)"\?$/.exec(prompt)
    ?? /^How many records have (active) equal to (true|false)\?$/.exec(prompt);
  if (filtered) return String(rows.filter(row => String(row[filtered[1] ?? '']) === filtered[2]).length);
  const absent = /^How many records are missing the (\w+) field entirely\?$/.exec(prompt)?.[1];
  if (absent) return String(rows.filter(row => !Object.hasOwn(row, absent)).length);
  const present = /^How many records include a (\w+) field, counting null and empty values\?$/.exec(prompt)?.[1];
  if (present) return String(rows.filter(row => Object.hasOwn(row, present)).length);
  const nullField = /^How many records have a null (\w+)\?$/.exec(prompt)?.[1];
  if (nullField) return String(rows.filter(row => row[nullField] === null).length);
  const empty = /^How many records have an empty string in (\w+)\?$/.exec(prompt)?.[1];
  if (empty) return String(rows.filter(row => row[empty] === '').length);
  const sum = /^What is the sum of numeric values in field (\w+)(?: for records with team equal to "(\w+)")?\?$/.exec(prompt);
  if (sum) return String(rows.filter(row => !sum[2] || row.team === sum[2]).reduce((total, row) => {
    const value = row[sum[1] ?? ''];
    return total + (typeof value === 'number' ? value : 0);
  }, 0));
  if (prompt === 'Is this data complete and valid? Answer only YES or NO.') {
    const corruption = dataset.corruption;
    let count = rows.length;
    let completeFields = rows.every(row => ['id', 'code', 'score', 'active'].every(key => Object.hasOwn(row, key)));
    if (corruption?.kind === 'truncated') count -= corruption.removeRecordCount;
    if (corruption?.kind === 'extra-rows') count += corruption.appendRecords.length;
    if (corruption?.kind === 'duplicate-row') count++;
    if (corruption?.kind === 'missing-fields' || corruption?.kind === 'width-mismatch') {
      completeFields = completeFields && corruption.targetRecordIndices.length === 0;
    }
    return count === 300 && completeFields ? 'YES' : 'NO';
  }
  throw new Error(`Question needs an independent answer check: ${prompt}`);
}

it('computes all 120 answers from data with distinct ids and balanced groups', () => {
  const { datasets, questions } = generateStress();
  expect(questions).toHaveLength(120);
  expect(new Set(questions.map(question => question.id)).size).toBe(120);
  for (const [group, count] of Object.entries({ scale: 30, deep: 25, messy: 40, damage: 25 })) {
    expect(questions.filter(question => question.dataset.startsWith(`${group}-`))).toHaveLength(count);
  }
  for (const dataset of datasets) expect(datasetSchema.parse(dataset)).toEqual(dataset);
  for (const question of questions) {
    expect(questionSchema.parse(question)).toEqual(question);
    expect(question.id).toMatch(/^s\d{3}$/);
    expect(question.prompt).not.toMatch(/json|toon|terset|format/i);
    // Plain words only, and no answer that must reproduce a tab or line break.
    expect(question.prompt).not.toMatch(/\bown\b/);
    expect(question.groundTruth, question.id).not.toMatch(/[\t\n]/);
    const dataset = datasets.find(dataset => dataset.name === question.dataset);
    if (!dataset) throw new Error('Missing question dataset');
    expect(question.groundTruth, question.id).toBe(recompute(dataset, question.prompt));
    expect(score(question.groundTruth, question), question.id).toBe(true);
    if (question.answerType === 'string') expect(question.normalizationOptions?.caseSensitive).toBe(true);
  }
});

it('round trips every undamaged source in every format and bounds all prompts', () => {
  const { datasets, questions } = generateStress();
  let largest = { tokens: 0, dataset: '', format: '' };
  for (const dataset of datasets) {
    for (const format of FORMATS) {
      const valid = encode(format, dataset.data);
      expect(decode(format, valid), `${dataset.name}/${format}`).toEqual(dataset.data);
      const damaged = encodeDataset(format, dataset);
      for (const question of questions.filter(question => question.dataset === dataset.name)) {
        const tokens = estimateInputTokens(makePrompt(question, format, damaged, primerFor(format, valid)));
        expect(tokens, `${question.id}/${dataset.name}/${format}`).toBeLessThan(70_000);
        if (tokens > largest.tokens) largest = { tokens, dataset: dataset.name, format };
      }
    }
  }
  console.info('Largest stress prompt:', largest);
}, 30_000);

it('covers depth boundaries, sparsity, mixed shapes, exact text and distinct clean controls', () => {
  const { datasets, questions } = generateStress();
  const get = (name: string): Dataset => {
    const result = datasets.find(dataset => dataset.name === name);
    if (!result) throw new Error('Missing coverage dataset');
    return result;
  };
  for (const size of [500, 750, 1000]) expect(records(get(`scale-${size}`))).toHaveLength(size);
  const sparse = records(get('messy-sparse'));
  const missing = sparse.reduce((n, row) => n + ['score', 'note', 'tag'].filter(key => !Object.hasOwn(row, key)).length, 0);
  expect(missing / (sparse.length * 3)).toBeGreaterThan(0.2);
  expect(missing / (sparse.length * 3)).toBeLessThan(0.4);
  expect(new Set(records(get('messy-shapes')).map(row => Object.keys(row).join(','))).size).toBe(3);
  // Count answers must vary, so one guessed number cannot score a whole dataset.
  for (const name of ['messy-states', 'messy-shapes']) {
    const counts = questions.filter(question => question.dataset === name && question.prompt.startsWith('How many'));
    const spread = new Set(counts.map(question => question.groundTruth)).size;
    expect(spread, name).toBeGreaterThanOrEqual(counts.length - 1);
  }
  for (const row of records(get('messy-text'))) {
    expect(row.text).toEqual(expect.stringContaining('\t'));
    expect(row.text).toEqual(expect.stringContaining('\n'));
    expect(row.text).toEqual(expect.stringContaining('"'));
    expect(row.text).toEqual(expect.stringContaining('東京'));
  }
  for (const depth of [7, 8, 9]) {
    const encoded = encode('terset', get(`deep-records-${depth}`).data);
    const path = `branch${'.child'.repeat(depth - 2)}.value`;
    if (depth <= 8) expect(encoded.split('\n')[1]?.split('\t')).toContain(path);
    else {
      expect(encoded.split('\n')[1]?.split('\t')).not.toContain(path);
      expect(encoded).toContain('{"name":"leaf-9-');
    }
  }
  const controls = datasets.filter(dataset => dataset.corruption?.kind === 'control');
  expect(controls).toHaveLength(12);
  expect(new Set(controls.map(dataset => JSON.stringify(dataset.data))).size).toBe(12);
  // A reader who always answers NO, or always YES, gets about half the damage group.
  const damageAnswers = questions.filter(question => question.type === 'structural-validation').map(question => question.groundTruth);
  expect(damageAnswers.filter(answer => answer === 'NO')).toHaveLength(13);
  expect(damageAnswers.filter(answer => answer === 'YES')).toHaveLength(12);
  // A middle removal keeps rows on both sides of the gap.
  for (const dataset of datasets.filter(dataset => dataset.name.startsWith('damage-middle-'))) {
    const corruption = dataset.corruption;
    if (corruption?.kind !== 'truncated' || corruption.startIndex === undefined) throw new Error('Expected a middle removal');
    expect(corruption.startIndex, dataset.name).toBeGreaterThan(0);
    expect(corruption.startIndex + corruption.removeRecordCount, dataset.name).toBeLessThan(records(dataset).length);
  }
  const upstream = QUESTIONS.filter(question => question.type === 'structural-validation');
  expect(upstream).toHaveLength(5);
  for (const question of questions.filter(question => question.type === 'structural-validation')) {
    expect(question.prompt).toBe(upstream[0]?.prompt);
    expect(question.answerType).toBe(upstream[0]?.answerType);
    const dataset = get(question.dataset);
    const kind = dataset.corruption?.kind;
    if (kind !== 'duplicate-row') {
      expect(question.groundTruth).toBe(upstream.find(q => q.dataset === `structural-validation-${kind ?? ''}`)?.groundTruth);
    }
  }
});
