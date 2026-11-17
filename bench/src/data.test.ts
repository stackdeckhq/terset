import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rulesFor } from '@stackdeck/terset';
import { DATASETS, DATA_HASHES, QUESTIONS, hash, readFrozen, selectQuestions } from './data.ts';
import { decode, encode, encodeDataset, makePrompt } from './formats.ts';
import { FORMATS } from './schema.ts';

describe('frozen upstream inputs', () => {
  it('derives q233 and q234 expected fields from the frozen repositories', () => {
    const repositories = DATASETS.find(d => d.name === 'github')?.data.repositories;
    if (!Array.isArray(repositories)) throw new Error('Missing repositories');
    const first = repositories[0];
    if (!first || typeof first !== 'object' || Array.isArray(first)) throw new Error('Missing repository');
    const fields = Object.keys(first);
    expect(QUESTIONS.find(q => q.id === 'q233')?.groundTruth).toBe(fields.join(','));
    expect(QUESTIONS.find(q => q.id === 'q234')?.groundTruth).toBe(fields[6]);
  });
  it('matches both recorded SHA-256 hashes', () => {
    for (const name of Object.keys(DATA_HASHES) as (keyof typeof DATA_HASHES)[]) {
      expect(hash(readFileSync(new URL(`../data/${name}`, import.meta.url)))).toBe(DATA_HASHES[name]);
      expect(readFrozen(name)).toBeDefined();
    }
    expect(DATASETS).toHaveLength(13);
    expect(QUESTIONS.length).toBeGreaterThan(240);
  });
  it('samples each dataset deterministically, preserving question identities', () => {
    expect(selectQuestions(2)).toEqual(selectQuestions(2));
    for (const dataset of DATASETS) {
      expect(selectQuestions(2).filter(q => q.dataset === dataset.name)).toHaveLength(
        Math.min(2, QUESTIONS.filter(q => q.dataset === dataset.name).length));
    }
    expect(selectQuestions()).toEqual(QUESTIONS);
    expect(() => selectQuestions(0)).toThrow();
  });
});

describe('format equivalence and prompt controls', () => {
  it('decodes every valid format block back to the same source data', () => {
    for (const dataset of DATASETS) {
      for (const format of FORMATS) expect(decode(format, encode(format, dataset.data)), `${dataset.name}/${format}`).toEqual(dataset.data);
    }
  });
  it('uses only its format primer and keeps shared instructions byte equal', () => {
    const question = QUESTIONS[0];
    if (!question) throw new Error('Missing question');
    const prompts = FORMATS.map(format => makePrompt(question, format, 'value: SAME-DATA'));
    const primers = [
      'JSON (compact): Strict JSON without extra whitespace.',
      'JSON: Strict JSON objects/arrays with repeated keys per row.',
      'TOON: Indentation-based. Arrays declare length and fields (e.g., items[N]{f1,f2}:). Rows use single delimiter. Values may be quoted. Keyed maps use key[N:]{fields}: with one `entrykey: values` row per entry. A tabular field may carry sub-fields, e.g. users[N]{name,address{city,country}}:.',
      rulesFor('value: SAME-DATA'),
    ];
    for (const [index, prompt] of prompts.entries()) {
      const primer = primers[index];
      if (primer === undefined) throw new Error('Missing primer');
      expect(prompt.system).toContain(primer);
      expect(prompt.system.replace(primer, '')).toBe('Read the supplied data.\n\n');
      for (const other of primers.filter(p => p !== primer && p !== '')) expect(prompt.system).not.toContain(other);
      expect(prompt.user.replace(`in ${String(FORMATS[index])} format`, 'in FORMAT format')).toBe(
        prompts[0]?.user.replace('in json-compact format', 'in FORMAT format'));
    }
  });
  it('keeps declared table headers while intentionally corrupting rows', () => {
    for (const dataset of DATASETS.filter(d => d.corruption && d.corruption.kind !== 'control')) {
      for (const format of FORMATS) {
        const corrupted = encodeDataset(format, dataset);
        expect(corrupted).not.toBe(encode(format, dataset.data));
        if (format === 'toon' || format === 'terset') {
          expect(corrupted.split('\n')[0]).toBe(encode(format, dataset.data).split('\n')[0]);
        } else {
          expect(() => decode(format, corrupted)).not.toThrow();
        }
      }
    }
  });
});
