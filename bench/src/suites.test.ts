import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { main } from './cli.ts';
import { fakeClient } from './clients.ts';
import { DATASETS, QUESTIONS, loadSuite, selectQuestions } from './data.ts';
import { fingerprint, plan } from './plan.ts';
import { run } from './runner.ts';
import { modelSchema } from './schema.ts';

it('defaults to the identical TOON selection, prompts and fingerprint', async () => {
  const suite = loadSuite('toon');
  expect(suite.datasets).toEqual(DATASETS);
  expect(suite.questions).toEqual(QUESTIONS);
  const model = modelSchema.parse(fakeModel);
  const baseline = plan([model], selectQuestions(2));
  const selected = plan([model], selectQuestions(2, undefined, suite), undefined, suite.datasets);
  expect(selected).toEqual(baseline);
  expect(fingerprint(selected, 'fake', 128, suite)).toBe(fingerprint(baseline, 'fake', 128));
  const implicit: string[] = [];
  const explicit: string[] = [];
  await main(['--dry-run', '--limit', '1'], text => implicit.push(text));
  await main(['--suite', 'toon', '--dry-run', '--limit', '1'], text => explicit.push(text));
  expect(explicit).toEqual(implicit);
  const full: string[] = [];
  await main(['--dry-run'], text => full.push(text));
  const output = full.join('\n');
  expect(output.indexOf('  structural-validation-control:')).toBeLessThan(output.indexOf('  keyed:'));
});

it('loads the frozen stress suite and rejects unknown suite or dataset names', async () => {
  const suite = loadSuite('stress');
  expect(suite.questions).toHaveLength(120);
  expect(suite.datasets).toHaveLength(38);
  expect(selectQuestions(1, undefined, suite)).toHaveLength(38);
  const output: string[] = [];
  await main(['--suite', 'stress', '--dry-run', '--datasets', 'scale-500', '--limit', '1'], text => output.push(text));
  expect(output.join('\n')).toContain('Datasets: 1; questions: 1; planned calls: 4');
  expect(output.join('\n')).not.toContain('  tabular:');
  await expect(main(['--suite', 'stress', '--datasets', 'tabular', '--dry-run'])).rejects.toThrow();
  await expect(main(['--suite', 'other', '--dry-run'])).rejects.toThrow();
});

it('persists stress source and hashes and prevents resuming it under TOON', async () => {
  const suite = loadSuite('stress');
  const model = modelSchema.parse(fakeModel);
  const tasks = plan([model], suite.questions.slice(0, 1), undefined, suite.datasets);
  const directory = await mkdtemp(join(tmpdir(), 'terset-suite-'));
  try {
    const options = { runId: 'suite', directory, tasks, suite, mode: 'fake' as const,
      client: fakeClient(() => tasks[0]?.question.groundTruth ?? ''),
      budgets: { maxCalls: 4, maxInputTokens: 1_000_000, maxOutputTokens: 512, perCallMaxOutputTokens: 128 } };
    const result = await run(options);
    expect(result.status).toBe('complete');
    const saved: unknown = JSON.parse(await readFile(join(directory, 'suite.json'), 'utf8'));
    expect(saved).toHaveProperty('suite', 'stress');
    expect(saved).toHaveProperty('dataHashes', suite.hashes);
    expect(saved).toHaveProperty('generatorSource', 'bench/src/stress/generate.ts');
    expect(saved).not.toHaveProperty('upstreamSha');
    await expect(run({ ...options, suite: loadSuite('toon') })).rejects.toThrow('different plan');
  } finally { await rm(directory, { recursive: true }); }
});
