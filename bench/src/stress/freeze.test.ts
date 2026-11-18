import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { hash, loadSuite } from '../data.ts';
import { serializeStress, generateStress, REFERENCE_DATE, STRESS_SEED } from './generate.ts';

it('freezes identical bytes in separate processes regardless of timezone and locale', async () => {
  const root = await mkdtemp(join(tmpdir(), 'terset-freeze-'));
  try {
    const script = fileURLToPath(new URL('./freeze.ts', import.meta.url));
    const first = join(root, 'first');
    const second = join(root, 'second');
    execFileSync(process.execPath, [script, first], { env: { ...process.env, TZ: 'Pacific/Honolulu', LANG: 'en_US.UTF-8' } });
    execFileSync(process.execPath, [script, second], { env: { ...process.env, TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8' } });
    const expected = serializeStress(generateStress());
    for (const name of ['datasets.json', 'questions.json'] as const) {
      const bytes = await readFile(join(first, name));
      expect(bytes.equals(await readFile(join(second, name)))).toBe(true);
      expect(bytes.toString('utf8')).toBe(expected[name]);
    }
  } finally { await rm(root, { recursive: true }); }
});

it('matches the committed freeze and its generator source record', async () => {
  const suite = loadSuite('stress');
  const generated = serializeStress(generateStress());
  for (const name of ['datasets.json', 'questions.json'] as const) {
    const bytes = await readFile(new URL(`../../data/stress/${name}`, import.meta.url));
    expect(bytes.toString('utf8')).toBe(generated[name]);
    expect(hash(bytes)).toBe(suite.hashes[name]);
  }
  const source = await readFile(new URL('./generate.ts', import.meta.url));
  expect(suite.source).toEqual({ generatorSource: 'bench/src/stress/generate.ts', generatorSha256: hash(source),
    seed: STRESS_SEED, referenceDate: REFERENCE_DATE });
});
