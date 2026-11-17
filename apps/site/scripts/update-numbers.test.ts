import { readFileSync } from 'node:fs';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { describe, expect, it } from 'vitest';
import { RULES, rulesFor } from '../src/lib/format.ts';
import { OUTPUT as CASES_FILE } from './update-cases.ts';
import { OUTPUT, buildNumbers } from './update-numbers.ts';

describe('local token measurements', () => {
  it('counts raw cases with the current counted and nested table syntax', () => {
    const data = [
      { address: { city: 'Paris', stats: { n: 1 } } },
      { address: { city: 'Rome', stats: { n: 2 } } },
    ];
    const file = buildNumbers(JSON.stringify({ cases: [{ name: 'Nested records', data }] }));
    expect(file.status).toBe('ready');
    if (file.status !== 'ready') return;
    expect(file.rulesTokens).toBe(tokens(RULES).length);
    expect(file.cases).toHaveLength(1);
    expect(file.cases[0]).toMatchObject({
      name: 'Nested records',
      json: tokens(JSON.stringify(data)).length,
      terset: tokens('[2]\naddress.city\taddress.stats.n\nParis\t1\nRome\t2').length + tokens(rulesFor('[2]\naddress.city\taddress.stats.n\nParis\t1\nRome\t2')).length,
      csvExact: false,
    });
    expect(JSON.stringify(file)).not.toContain('Paris');
  });

  it('still accepts measured rows and refuses stale primer or YAML metadata', () => {
    const measured = {
      rulesTokens: tokens(RULES).length,
      yamlVersion: '2.9.1',
      cases: [{ name: 'Measured', json: 100, jsonPretty: 120, yaml: 110, toon: 90, csv: null, csvExact: null, terset: 95 }],
    };
    expect(buildNumbers(JSON.stringify(measured))).toMatchObject({ status: 'ready', ...measured });
    expect(() => buildNumbers(JSON.stringify({ ...measured, rulesTokens: 40 }))).toThrow(`this RULES line is ${String(tokens(RULES).length)} tokens`);
    expect(() => buildNumbers(JSON.stringify({ ...measured, yamlVersion: '1.0.0' }))).toThrow('this site installs yaml 2.9.1');
  });

  it('keeps missing input pending and rejects duplicate raw case names', () => {
    expect(buildNumbers(undefined).status).toBe('pending');
    const row = { name: 'Duplicate', data: { privateValue: 'kept outside output' } };
    expect(() => buildNumbers(JSON.stringify({ cases: [row, row] }))).toThrow('cases need unique names and slugs');
  });

  it('keeps the published counts equal to a fresh count of the committed case inputs', () => {
    const published: unknown = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    expect(published).toEqual(buildNumbers(readFileSync(CASES_FILE, 'utf8')));
  });
});
