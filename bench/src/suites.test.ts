import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { main } from './cli.ts';
import { fakeClient } from './clients.ts';
import { DATASETS, QUESTIONS, hash, loadSuite, selectQuestions } from './data.ts';
import { describePlan, fingerprint, plan } from './plan.ts';
import { run } from './runner.ts';
import { modelSchema, resultSchema } from './schema.ts';

it.each([
  {
    name: 'toon',
    datasetsHash: 'ee0ce056cb7c1cd01fa68d44c343ca72ae2dd1a443b54b82837472771a0c3b7e',
    questionsHash: 'af0121660a4c6a20e4f6b64a4e18b3dde9007799256af5f205fd959a20527b93',
    fingerprintHash: '507047bdd37e01d3b3abf767b49e85a10a1040b614fabcfdcefc6855bbfec57c',
    planHash: '0341cc6972161122a37f4b626d90deb67cd4f9f6c879e49d8bd7cbabc41b2398',
  },
  {
    name: 'stress',
    datasetsHash: 'a827116f254dcb19483e6326f85ddec07d8721cf1849c4c8a504aa562eb63cab',
    questionsHash: '0a1e63fa6db21cc34bae61a4f6fb56aa7828bedb62854149bfbd041f41aa1c37',
    fingerprintHash: '14790263b736f7cf035bbea11797745bfad077fdbec8d340dbba7db96f5a8090',
    planHash: 'ac3b76fcebbfd218bc9db3c7f63e2d85ecf1abaa0f989748cec93618fc5179eb',
  },
] as const)('keeps the frozen $name inputs, format 1.1 plan and fingerprint', ({ name, datasetsHash, questionsHash, fingerprintHash, planHash }) => {
  const suite = loadSuite(name);
  expect(suite.hashes).toEqual({ 'datasets.json': datasetsHash, 'questions.json': questionsHash });
  const tasks = plan([modelSchema.parse(fakeModel)], selectQuestions(undefined, undefined, suite), undefined, suite.datasets, '1.1');
  expect(fingerprint(tasks, 'fake', 128, suite)).toBe(fingerprintHash);
  expect(hash(describePlan(tasks))).toBe(planHash);
});

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

it('selects real questions and prints a three-format dry-run plan', async () => {
  const output: string[] = [];
  await main(['--suite', 'real', '--formats', 'json-compact,toon,terset', '--dry-run',
    '--per-call-max-output-tokens', '2048'], text => output.push(text));
  expect(output[0]).toContain('Datasets: 2; questions: 40; planned calls: 120');
  expect(output[0]).toContain('Model fake: 120 calls');
  expect(output[0]).toContain('Reserved cost (USD), total:');
  expect(output[1]).toBe('Dry run: no calls made and no results written.');

  const suite = loadSuite('real');
  expect(suite.datasets.map(dataset => dataset.name)).toEqual(['usgs-earthquakes', 'nws-gridpoint']);
  expect(selectQuestions(undefined, ['nws-gridpoint'], suite).map(question => question.dataset))
    .toEqual(Array<string>(20).fill('nws-gridpoint'));
  expect(selectQuestions(2, undefined, suite).map(question => question.dataset))
    .toEqual(['usgs-earthquakes', 'usgs-earthquakes', 'nws-gridpoint', 'nws-gridpoint']);
  expect(() => selectQuestions(undefined, ['keyed'], suite)).toThrow();
  expect(resultSchema.shape.suite.parse('real')).toBe('real');
});

it.each([['real-400', 400], ['real-400-pilot', 24]] as const)('loads %s with an 8192-token cap', async (name, count) => {
  const suite = loadSuite(name);
  expect(suite.questions).toHaveLength(count);
  expect(suite.paths['datasets.json']).toBe(loadSuite('real').paths['datasets.json']);
  const output: string[] = [];
  await main(['--suite', name, '--formats', 'terset', '--limit', '1', '--dry-run'], text => output.push(text));
  expect(output[0]).toContain('Datasets: 2; questions: 2; planned calls: 2');
  expect(output[0]).toContain('8192 output tokens per call');
  expect(output[1]).toBe('Dry run: no calls made and no results written.');
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
