import { rulesFor, encode as encodeTerset } from '@stackdeck/terset';
import { describe, expect, it, vi } from 'vitest';
import { main } from './cli.ts';
import { DATASETS, QUESTIONS } from './data.ts';
import { decode, encode, encodeDataset, primerFor } from './formats.ts';
import { plan } from './plan.ts';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { FORMATS, PUBLISHED_TERSET_FORMAT, formatSchema, modelSchema, tersetFormatSchema } from './schema.ts';

describe('Terset package integration', () => {
  it.each(DATASETS)('uses the package and round trips $name before damage', dataset => {
    const text = encode('terset', dataset.data);
    expect(text).toBe(encodeTerset(dataset.data, { format: PUBLISHED_TERSET_FORMAT }));
    expect(JSON.stringify(decode('terset', text))).toBe(JSON.stringify(dataset.data));
  });

  it('encodes with format 1.2 when a run asks for it', () => {
    const data = { a: { b: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }] } };
    const text = encode('terset', data, tersetFormatSchema.parse('1.2'));
    expect(text).toBe('a/b[3]:\nx\ty\n1\t2\n3\t4\n5\t6');
    expect(primerFor('terset', text)).toContain('Key a/b is field b in object a.');
    expect(encode('terset', data)).toBe(`a: ${JSON.stringify(data.a)}`);
  });

  it('uses the fitted package primer and supports only the four formats', () => {
    expect(primerFor('terset', encodeTerset({ value: 'SAME-DATA' }, { format: PUBLISHED_TERSET_FORMAT }))).toBe('');
    for (const dataset of DATASETS) {
      const text = encodeTerset(dataset.data, { format: PUBLISHED_TERSET_FORMAT });
      expect(primerFor('terset', text)).toBe(rulesFor(text));
    }
    expect(FORMATS).toEqual(['json-compact', 'json-pretty', 'toon', 'terset']);
    expect(formatSchema.options).toEqual(FORMATS);
  });

  it('fits rules to the valid text before structural damage', () => {
    const tasks = plan([modelSchema.parse(fakeModel)], QUESTIONS, ['terset']);
    for (const task of tasks) {
      const dataset = DATASETS.find(dataset => dataset.name === task.question.dataset);
      if (dataset === undefined) throw new Error('Missing dataset');
      const valid = encodeTerset(dataset.data, { format: PUBLISHED_TERSET_FORMAT });
      expect(task.prompt.system).toBe(`Read the supplied data.\n\n${rulesFor(valid)}`);
      expect(task.prompt.user).toContain(encodeDataset('terset', dataset));
    }
  });

  it('selects Terset from the CLI', async () => {
    const output: string[] = [];
    await main(['--dry-run', '--formats', 'terset'], text => output.push(text));
    expect(output.join('\n')).toContain('terset: 244 calls');
    expect(output.join('\n')).toContain('planned calls: 244');
  });

  it('plans all formats by default without constructing a network request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('Network forbidden'));
    vi.stubGlobal('fetch', fetcher);
    try {
      const output: string[] = [];
      await main(['--dry-run'], text => output.push(text));
      expect(output.join('\n')).toContain('planned calls: 976');
      for (const format of FORMATS) expect(output.join('\n')).toContain(`  ${format}: 244 calls`);
      expect(fetcher).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it.each(DATASETS.filter(dataset => dataset.corruption))('retains original N and headers in $name', dataset => {
    const employees = dataset.data.employees;
    if (!Array.isArray(employees)) throw new Error('Missing employees');
    const valid = encode('terset', dataset.data);
    const damaged = encodeDataset('terset', dataset);
    expect(damaged.split('\n').slice(0, 2)).toEqual([`employees[${employees.length}]:`, valid.split('\n')[1]]);
    if (dataset.corruption?.kind === 'control') expect(decode('terset', damaged)).toEqual(dataset.data);
    else {
      expect(damaged).not.toBe(valid);
      expect(() => decode('terset', damaged)).toThrow();
    }
    if (dataset.corruption?.kind === 'truncated') expect(damaged.split('\n')).toHaveLength(employees.length + 2 - dataset.corruption.removeRecordCount);
    if (dataset.corruption?.kind === 'extra-rows') expect(damaged.split('\n')).toHaveLength(employees.length + 2 + dataset.corruption.appendRecords.length);
  });
});
