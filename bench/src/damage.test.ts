import { expect, it } from 'vitest';
import { decode, encode, encodeDataset } from './formats.ts';
import { datasetSchema, FORMATS } from './schema.ts';

const records = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, label: `row-${index + 1}` }));
function row(index: number): { id: number; label: string } {
  const record = records[index];
  if (!record) throw new Error('Missing fixture row');
  return record;
}
const fixture = { name: 'damage-fixture', description: 'Row damage', data: { items: records },
  metadata: { supportsCSV: true, structureClass: 'tabular', tabularEligibility: 1 } };

it.each(FORMATS)('damages a named list in %s with middle removal and duplicate rows', format => {
  const cases = [
    { corruption: { kind: 'truncated', targetKey: 'items', removeRecordCount: 2, startIndex: 1 }, expected: [row(0), row(3), row(4)] },
    { corruption: { kind: 'truncated', targetKey: 'items', removeRecordCount: 1 }, expected: records.slice(0, -1) },
    { corruption: { kind: 'duplicate-row', targetKey: 'items', targetRecordIndex: 2 }, expected: [...records.slice(0, 3), row(2), ...records.slice(3)] },
    { corruption: { kind: 'extra-rows', targetKey: 'items', appendRecords: [{ id: 6, label: 'extra' }] }, expected: [...records, { id: 6, label: 'extra' }] },
    { corruption: { kind: 'missing-fields', targetKey: 'items', targetRecordIndices: [2], targetFieldName: 'label' }, expected: records.map((row, i) => i === 2 ? { id: row.id } : row) },
  ];
  for (const { corruption, expected } of cases) {
    const dataset = datasetSchema.parse({ ...fixture, corruption });
    const damaged = encodeDataset(format, dataset);
    if (format === 'json-compact' || format === 'json-pretty') expect(decode(format, damaged)).toEqual({ items: expected });
    else {
      const headerCount = format === 'toon' ? 1 : 2;
      const valid = encode(format, fixture.data).split('\n');
      expect(damaged.split('\n').slice(0, headerCount)).toEqual(valid.slice(0, headerCount));
      if (corruption.kind !== 'missing-fields') {
        expect(damaged.split('\n').slice(headerCount)).toEqual(
          encode(format, { items: expected }).split('\n').slice(headerCount));
      }
      expect(() => decode(format, damaged)).toThrow();
    }
  }
});

it.each(FORMATS)('rejects appended rows whose fields differ from the list in %s', format => {
  for (const appendRecords of [[{ id: 6, label: 'extra', more: 1 }], [{ label: 'extra', id: 6 }], [{ id: 6 }]]) {
    const dataset = datasetSchema.parse({ ...fixture, corruption: { kind: 'extra-rows', targetKey: 'items', appendRecords } });
    expect(() => encodeDataset(format, dataset)).toThrow('Invalid structural fixture: appended fields differ');
  }
});

it.each(FORMATS)('rejects row positions outside the target list in %s', format => {
  const dataset = datasetSchema.parse({ ...fixture,
    corruption: { kind: 'duplicate-row', targetKey: 'items', targetRecordIndex: 5 } });
  expect(() => encodeDataset(format, dataset)).toThrow('Invalid structural fixture');
});
