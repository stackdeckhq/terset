import { rulesFor, decode as decodeTerset, encode as encodeTerset } from '@stackdeck/terset';
import { decode as decodeToon, encode as encodeToon } from '@toon-format/toon';
import { encode as tokenize } from 'gpt-tokenizer/encoding/o200k_base';
import { DEFAULT_TERSET_FORMAT, jsonRootSchema } from './schema.ts';
import type { Corruption, Dataset, Format, JsonRoot, Question, TersetFormat } from './schema.ts';

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

export function encode(format: Format, data: JsonRoot, tersetFormat: TersetFormat = DEFAULT_TERSET_FORMAT): string {
  switch (format) {
    case 'json-compact': return JSON.stringify(data);
    case 'json-pretty': return JSON.stringify(data, null, 2);
    case 'toon': return encodeToon(data);
    case 'terset': return encodeTerset(data, { format: tersetFormat });
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
  const targetKey = corruption.targetKey ?? 'employees';
  const rows = copy[targetKey];
  if (!Array.isArray(rows)) throw new Error('Invalid structural fixture: target must be a top-level list');
  switch (corruption.kind) {
    case 'control': break;
    case 'truncated': {
      const start = corruption.startIndex ?? rows.length - corruption.removeRecordCount;
      if (start < 0 || start + corruption.removeRecordCount > rows.length) throw new Error('Invalid structural fixture: removal range');
      rows.splice(start, corruption.removeRecordCount);
      break;
    }
    case 'extra-rows': {
      // Appended rows must fit the existing table header, or TOON and Terset
      // would print them in another layout under the original header.
      const first: unknown = rows[0];
      const fields = first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first).join('\n') : undefined;
      if (corruption.appendRecords.some(record => Object.keys(record).join('\n') !== fields)) {
        throw new Error('Invalid structural fixture: appended fields differ');
      }
      rows.push(...corruption.appendRecords);
      break;
    }
    case 'duplicate-row': {
      const row = rows[corruption.targetRecordIndex];
      if (row === undefined) throw new Error('Invalid structural fixture: duplicate index');
      rows.splice(corruption.targetRecordIndex + 1, 0, structuredClone(row));
      break;
    }
    case 'width-mismatch':
    case 'missing-fields':
      for (const index of corruption.targetRecordIndices) {
        const employee = rows[index];
        if (!employee || Array.isArray(employee) || typeof employee !== 'object') throw new Error('Invalid structural fixture');
        if (!(corruption.targetFieldName in employee)) throw new Error('Invalid structural fixture: missing field');
        rows[index] = Object.fromEntries(Object.entries(employee).filter(([field]) => field !== corruption.targetFieldName));
      }
  }
  return copy;
}

// Keep table headers intact while editing the encoded record rows. This mirrors
// the upstream corruption seam. JSON keeps valid framing after the edit.
export function encodeDataset(format: Format, dataset: Dataset, tersetFormat: TersetFormat = DEFAULT_TERSET_FORMAT): string {
  const text = encode(format, dataset.data, tersetFormat);
  const corruption = dataset.corruption;
  if (!corruption || corruption.kind === 'control') return text;
  const damaged = corruptJson(dataset.data, corruption);
  if (format === 'json-compact' || format === 'json-pretty') return encode(format, damaged);
  const targetKey = corruption.targetKey ?? 'employees';
  const sourceRows = dataset.data[targetKey];
  if (!Array.isArray(sourceRows) || Object.keys(dataset.data).length !== 1) throw new Error('Invalid structural fixture: one top-level list required');
  const lines = text.split('\n');
  const headerCount = format === 'toon' ? 1 : 2;
  if (lines.length !== sourceRows.length + headerCount) throw new Error('Invalid structural fixture: single-line table rows required');
  const headers = lines.slice(0, headerCount);
  let rows = lines.slice(headerCount);
  switch (corruption.kind) {
    case 'truncated': rows.splice(corruption.startIndex ?? rows.length - corruption.removeRecordCount, corruption.removeRecordCount); break;
    case 'extra-rows': {
      const extended = encode(format, damaged, tersetFormat).split('\n');
      if (extended[1] !== lines[1] && format === 'terset') throw new Error('Invalid structural fixture: appended fields differ');
      rows.push(...extended.slice(headerCount + sourceRows.length));
      break;
    }
    case 'duplicate-row': rows.splice(corruption.targetRecordIndex + 1, 0, ...rows.slice(corruption.targetRecordIndex, corruption.targetRecordIndex + 1)); break;
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

const DATA_START = 'Given the following data in ';
const DATA_END = '\n```';
const QUESTION_START = '\n\nQuestion: ';

export function makePrompt(question: Question, format: Format, data: string, primer = primerFor(format, data)): Prompt {
  const label = format;
  return {
    system: `Read the supplied data.\n\n${primer}`,
    user: `${DATA_START}${label} format:\n\n\`\`\`\n${data}${DATA_END}${QUESTION_START}${question.prompt}\n\nAnswer format requirements:\n- Provide only the value itself, no explanation\n- For numbers: output digits only (no commas, currency symbols, or units)\n- For dates/field names: use the exact string from the data\n- For lists: output comma-separated values with no spaces\n\nAnswer:`,
  };
}

export function splitDataPrefix(user: string): [dataPrefix: string, suffix: string] | undefined {
  if (!user.startsWith(DATA_START)) return undefined;
  const marker = DATA_END + QUESTION_START;
  const boundary = user.indexOf(marker);
  if (boundary < 0 || boundary !== user.lastIndexOf(marker)) return undefined;
  const end = boundary + DATA_END.length;
  return [user.slice(0, end), user.slice(end)];
}

export function estimateInputTokens(prompt: Prompt): number {
  return tokenize(prompt.system).length + tokenize(prompt.user).length;
}
