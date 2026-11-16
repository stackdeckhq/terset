import { rulesFor, decode as decodeTerset, encode as encodeTerset } from '@stackdeck/terset';
import { decode as decodeToon, encode as encodeToon } from '@toon-format/toon';
import { encode as tokenize } from 'gpt-tokenizer/encoding/o200k_base';
import { jsonRootSchema } from './schema.ts';
import type { Corruption, Dataset, Format, JsonRoot, Question } from './schema.ts';

// JSON and TOON primers are copied verbatim from the upstream benchmark.
export const PRIMERS = {
  'json-compact': 'JSON (compact): Strict JSON without extra whitespace.',
  'json-pretty': 'JSON: Strict JSON objects/arrays with repeated keys per row.',
  toon: 'TOON: Indentation-based. Arrays declare length and fields (e.g., items[N]{f1,f2}:). Rows use single delimiter. Values may be quoted. Keyed maps use key[N:]{fields}: with one `entrykey: values` row per entry. A tabular field may carry sub-fields, e.g. users[N]{name,address{city,country}}:.',
};
export interface Prompt { system: string; user: string }

export function primerFor(format: Format, validText: string): string {
  if (format === 'terset') return rulesFor(validText);
  return PRIMERS[format];
}

export function encode(format: Format, data: JsonRoot): string {
  switch (format) {
    case 'json-compact': return JSON.stringify(data);
    case 'json-pretty': return JSON.stringify(data, null, 2);
    case 'toon': return encodeToon(data);
    case 'terset': return encodeTerset(data);
  }
}

export function decode(format: Format, text: string): JsonRoot {
  switch (format) {
    case 'json-compact':
    case 'json-pretty': return jsonRootSchema.parse(JSON.parse(text) as unknown);
    case 'toon': return jsonRootSchema.parse(decodeToon(text));
    case 'terset': return decodeTerset(text);
  }
}

function corruptJson(data: Dataset['data'], corruption: Corruption): Dataset['data'] {
  const copy = structuredClone(data);
  const employees = copy.employees;
  if (!Array.isArray(employees)) throw new Error('Structural fixture requires employees');
  switch (corruption.kind) {
    case 'control': break;
    case 'truncated': copy.employees = employees.slice(0, -corruption.removeRecordCount); break;
    case 'extra-rows': copy.employees = [...employees, ...corruption.appendRecords]; break;
    case 'width-mismatch':
    case 'missing-fields':
      for (const index of corruption.targetRecordIndices) {
        const employee = employees[index];
        if (!employee || Array.isArray(employee) || typeof employee !== 'object') throw new Error('Invalid structural fixture');
        employees[index] = Object.fromEntries(Object.entries(employee).filter(([field]) => field !== corruption.targetFieldName));
      }
  }
  return copy;
}

// Keep table headers intact while editing the encoded record rows. This mirrors
// the upstream corruption seam. JSON keeps valid framing after the edit.
export function encodeDataset(format: Format, dataset: Dataset): string {
  const text = encode(format, dataset.data);
  const corruption = dataset.corruption;
  if (!corruption || corruption.kind === 'control') return text;
  if (format === 'json-compact' || format === 'json-pretty') return encode(format, corruptJson(dataset.data, corruption));
  const lines = text.split('\n');
  const headerCount = format === 'toon' ? 1 : 2;
  const headers = lines.slice(0, headerCount);
  let rows = lines.slice(headerCount);
  switch (corruption.kind) {
    case 'truncated': rows = rows.slice(0, -corruption.removeRecordCount); break;
    case 'extra-rows': rows.push(...encode(format, { employees: corruption.appendRecords }).split('\n').slice(headerCount)); break;
    case 'width-mismatch':
    case 'missing-fields': {
      const delimiter = format === 'toon' ? ',' : '\t';
      const header = format === 'toon' ? headers[0]?.match(/\{(.*)\}/)?.[1] : headers[1];
      const fieldIndex = header?.split(delimiter).indexOf(corruption.targetFieldName);
      if (fieldIndex === undefined || fieldIndex < 0) throw new Error('Missing structural field');
      rows = rows.map((row, index) => {
        if (!corruption.targetRecordIndices.includes(index)) return row;
        const cells = row.split(delimiter);
        cells.splice(fieldIndex, 1);
        return cells.join(delimiter);
      });
    }
  }
  return [...headers, ...rows].join('\n');
}

export function makePrompt(question: Question, format: Format, data: string, primer = primerFor(format, data)): Prompt {
  const label = format;
  return {
    system: `Read the supplied data.\n\n${primer}`,
    user: `Given the following data in ${label} format:\n\n\`\`\`\n${data}\n\`\`\`\n\nQuestion: ${question.prompt}\n\nAnswer format requirements:\n- Provide only the value itself, no explanation\n- For numbers: output digits only (no commas, currency symbols, or units)\n- For dates/field names: use the exact string from the data\n- For lists: output comma-separated values with no spaces\n\nAnswer:`,
  };
}

export function estimateInputTokens(prompt: Prompt): number {
  return tokenize(prompt.system).length + tokenize(prompt.user).length;
}
