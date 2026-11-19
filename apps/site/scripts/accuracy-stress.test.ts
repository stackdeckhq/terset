// The stress publication, checked on small fixture runs built from the frozen questions.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { questionSchema } from '../../../bench/src/schema.ts';
import { score } from '../../../bench/src/scoring.ts';
import { STRESS_OUTPUT, STRESS_PUBLISHED_RUNS, buildStressAccuracy, stressAccuracyText, stressReadmeBlock, updateStressReadme } from './accuracy-stress.ts';
import type { StressRunFile } from './accuracy-stress.ts';
import { wilson95 } from './accuracy-runs.ts';
import { ACCURACY_FORMATS } from '../src/data/accuracy-schema.ts';
import type { AccuracyFormat } from '../src/data/accuracy-schema.ts';
import { STRESS_MODELS, StressAccuracyFileSchema } from '../src/data/accuracy-stress-schema.ts';

type StressRun = z.infer<typeof StressRunFile>;
type StressModelId = (typeof STRESS_MODELS)[number];

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const QUESTIONS = z.array(questionSchema).parse(JSON.parse(readFileSync(`${REPO}bench/data/stress/questions.json`, 'utf8')));
const sha256 = (path: string): string => createHash('sha256').update(readFileSync(`${REPO}${path}`)).digest('hex');
const PRICES: Readonly<Record<StressModelId, readonly [number, number]>> = { 'claude-opus-5-5': [4, 20], 'gpt-6.1-sol': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };
/** The sparse field-count questions. The build keeps the Haiku Terset answers to them. */
const SPARSE_COUNTS = ['s057', 's059', 's061'];
/**
 * The Haiku answers the fixture gets wrong: Terset misses two long-list questions and one
 * sparse count, compact JSON and TOON miss one long-list question, and pretty JSON misses none.
 */
const HAIKU_MISSES: Readonly<Partial<Record<AccuracyFormat, readonly string[]>>> = {
  terset: ['s010', 's020', 's057'],
  'json-compact': ['s010'],
  toon: ['s010'],
};

const SOURCES = STRESS_MODELS.map((model) => ({ path: `bench/published/2099-01-01/fixture-stress-${model}.json`, model }));

/** One run of every frozen question in every format. Every answer is right except the Haiku misses above. */
function fixtureRun(model: StressModelId): StressRun {
  const [inputPerMillion, outputPerMillion] = PRICES[model];
  const rows = ACCURACY_FORMATS.flatMap((format, f) => QUESTIONS.map((question) => {
    const text = model === 'claude-haiku-5-5' && (HAIKU_MISSES[format] ?? []).includes(question.id) ? '-1' : question.groundTruth;
    return { model, format, dataset: question.dataset, questionId: question.id, text, expected: question.groundTruth, correct: score(text, question), inputTokens: 100 + f, outputTokens: 5, reservedInputTokens: 200 };
  }));
  const summary = ACCURACY_FORMATS.map((format) => {
    const own = rows.filter((row) => row.format === format);
    const correct = own.filter((row) => row.correct).length;
    const inputTokens = own.reduce((sum, row) => sum + row.inputTokens, 0);
    const outputTokens = own.reduce((sum, row) => sum + row.outputTokens, 0);
    const { low, high } = wilson95(correct, own.length);
    return { model, format, dataset: 'ALL', metrics: { correct, total: own.length, inputTokens, outputTokens, totalCost: (inputTokens * inputPerMillion + outputTokens * outputPerMillion) / 1_000_000, wilson95: { lower: low, upper: high } } };
  });
  return {
    runId: basename(SOURCES.find((source) => source.model === model)?.path ?? '', '.json'),
    fingerprint: 'fixture-plan', mode: 'http', status: 'complete', suite: 'stress',
    plannedCalls: rows.length, rows, failures: [], summary,
    inputReservation: { margin: 1.25, allowance: 64 },
    models: [{ id: model, api: 'fixture', temperature: 'zero', outputTokenParameter: 'max_tokens', price: { inputPerMillion, outputPerMillion, sourceUrl: 'https://example.invalid/prices', dateRead: '2026-11-17' } }],
    generatorSource: 'bench/src/stress/generate.ts', generatorSha256: sha256('bench/src/stress/generate.ts'),
    seed: 20261117, referenceDate: '2026-11-17T00:00:00.000Z',
    dataHashes: { 'datasets.json': sha256('bench/data/stress/datasets.json'), 'questions.json': sha256('bench/data/stress/questions.json') },
    encoders: { '@toon-format/toon': '4.4.0', '@stackdeck/terset': '0.3.0' },
    tokenizer: 'o200k_base', budgets: { perCallMaxOutputTokens: 16000 },
  };
}

function freshStressRuns(): StressRun[] {
  return STRESS_MODELS.map(fixtureRun);
}

function build(runs: readonly unknown[]): ReturnType<typeof buildStressAccuracy> {
  return buildStressAccuracy(runs, SOURCES);
}

describe('stress accuracy', () => {
  it('lists one run per model, from 2026-11-19', () => {
    expect(STRESS_PUBLISHED_RUNS).toEqual([
      { path: 'bench/published/2026-11-19/stress-opus-2026-11-19.json', model: 'claude-opus-5-5' },
      { path: 'bench/published/2026-11-19/stress-sol-2026-11-19.json', model: 'gpt-6.1-sol' },
      { path: 'bench/published/2026-11-19/stress-haiku-2026-11-19.json', model: 'claude-haiku-5-5' },
    ]);
  });

  it('publishes each model from its one run, with reported input tokens and group totals', () => {
    const file = build(freshStressRuns());
    expect(file.questions).toBe(120);
    expect(file.calls).toBe(120 * 4 * 3);
    expect(file.publishedRuns).toEqual(SOURCES.map((source) => ({ runId: basename(source.path, '.json'), runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: source.model })));
    expect(file.models.map((model) => model.rows.map((row) => row.correct))).toEqual([[120, 120, 120, 120], [120, 120, 120, 120], [117, 119, 120, 119]]);
    for (const model of file.models) {
      expect(model.inputTokensFrom).toBe('model-report');
      for (const [f, row] of model.rows.entries()) {
        expect(row.total).toBe(120);
        expect(row.inputTokens).toBe(120 * (100 + f));
        expect(row.groups.map((group) => [group.group, group.total])).toEqual([['scale', 30], ['deep', 25], ['messy', 40], ['damage', 25]]);
        expect(row.groups.reduce((sum, group) => sum + group.correct, 0)).toBe(row.correct);
        expect(row.groups.reduce((sum, group) => sum + group.inputTokens, 0)).toBe(row.inputTokens);
      }
    }
  });

  it('keeps the sparse field-count answers for the Haiku Terset row only', () => {
    const file = build(freshStressRuns());
    for (const model of file.models) {
      for (const row of model.rows) {
        const expected = model.id === 'claude-haiku-5-5' && row.format === 'terset' ? SPARSE_COUNTS : [];
        expect(row.sparseFieldCounts.map((answer) => answer.questionId), `${model.id} ${row.format}`).toEqual(expected);
      }
    }
    const haiku = file.models[2]?.rows[0]?.sparseFieldCounts;
    expect(haiku?.every((answer) => answer.dataset === 'messy-sparse' && answer.rowCount === 120)).toBe(true);
    expect(haiku?.map((answer) => [answer.text, answer.correct])).toEqual([['-1', false], ['83', true], ['81', true]]);
  });

  it.each([
    ['datasets hash', (run) => { run.dataHashes['datasets.json'] = 'a'.repeat(64); }, 'stress datasets.json hash differs from the repository'],
    ['questions hash', (run) => { run.dataHashes['questions.json'] = 'a'.repeat(64); }, 'stress questions.json hash differs from the repository'],
    ['extra data hash', (run) => { run.dataHashes['other.json'] = 'a'.repeat(64); }, 'stress data hash files differ from the repository'],
    ['missing data hash', (run) => { delete run.dataHashes['datasets.json']; }, 'stress data hash files differ from the repository'],
    ['generator hash', (run) => { run.generatorSha256 = 'a'.repeat(64); }, 'stress generator hash differs from the repository'],
    ['generator source', (run) => { run.generatorSource = 'other.ts'; }, 'stress generator source must be bench/src/stress/generate.ts'],
    ['seed', (run) => { run.seed += 1; }, 'stress seed must be 20261117'],
    ['TOON encoder', (run) => { run.encoders['@toon-format/toon'] = '4.5.0'; }, 'stress @toon-format/toon encoder version must be 4.4.0'],
    ['Terset encoder', (run) => { run.encoders['@stackdeck/terset'] = '0.2.4'; }, 'stress @stackdeck/terset encoder version must be 0.3.0'],
    ['output cap', (run) => { run.budgets.perCallMaxOutputTokens = 2048; }, 'stress per-call output cap must be 16000'],
    ['reference date', (run) => { run.referenceDate = '2020-01-01T00:00:00.000Z'; }, 'stress reference date must be 2026-11-17T00:00:00.000Z'],
    ['tokenizer', (run) => { run.tokenizer = 'other'; }, 'stress tokenizer must be o200k_base'],
    ['input reservation', (run) => { run.inputReservation.allowance += 1; }, 'stress input reservation must be margin 1.25 and allowance 64'],
    ['price', (run) => { const model = run.models[0]; if (model) model.price.inputPerMillion = 0.01; }, 'stress claude-opus-5-5 price differs from the recorded price'],
  ] satisfies [string, (run: StressRun) => void, string][])('refuses a consistent change to every run: %s', (_name, change, message) => {
    const runs = freshStressRuns();
    runs.forEach(change);
    expect(() => build(runs)).toThrow(new Error(`fixture-stress-claude-opus-5-5: ${message}`));
  });

  it.each([
    ['unknown question', (run) => { for (const row of run.rows) if (row.questionId === 's001') row.questionId = 'other'; }, 'terset other: stress question is not in questions.json'],
    ['missing question', (run) => { run.rows.shift(); run.plannedCalls -= 1; }, 'terset: stress question set differs from questions.json'],
    ['duplicate question', (run) => { const row = run.rows[0]; if (row) run.rows.push({ ...row }); run.plannedCalls += 1; }, 'terset s001: stress question was answered twice'],
    ['question dataset', (run) => { const row = run.rows[0]; if (row) row.dataset = 'messy-other'; }, 'terset s001: stress dataset differs from questions.json'],
    ['expected answer', (run) => { const row = run.rows[0]; if (row) row.expected = 'other'; }, 'terset s001: stress expected answer differs from questions.json'],
    ['correct flag', (run) => { const row = run.rows[0]; if (row) row.correct = !row.correct; }, 'terset s001: stress correct flag differs from re-scoring the answer'],
    ['answer text', (run) => { const row = run.rows[0]; if (row) row.text = 'not an answer'; }, 'terset s001: stress correct flag differs from re-scoring the answer'],
  ] satisfies [string, (run: StressRun) => void, string][])('checks frozen questions even when every run has the same tamper: %s', (_name, change, message) => {
    const runs = freshStressRuns();
    runs.forEach(change);
    expect(() => build(runs)).toThrow(new Error(`fixture-stress-claude-opus-5-5 ${message}`));
  });

  it.each([
    ['data hashes', (run) => { run.dataHashes['datasets.json'] = 'a'.repeat(64); }, ': stress datasets.json hash differs from the repository'],
    ['question hashes', (run) => { run.dataHashes['questions.json'] = 'a'.repeat(64); }, ': stress questions.json hash differs from the repository'],
    ['generator hash', (run) => { run.generatorSha256 = 'a'.repeat(64); }, ': stress generator hash differs from the repository'],
    ['generator source', (run) => { run.generatorSource = 'other.ts'; }, ': stress generator source must be bench/src/stress/generate.ts'],
    ['seed', (run) => { run.seed += 1; }, ': stress seed must be 20261117'],
    ['reference date', (run) => { run.referenceDate = '2026-11-18T00:00:00.000Z'; }, ': stress reference date must be 2026-11-17T00:00:00.000Z'],
    ['tokenizer', (run) => { run.tokenizer = 'other'; }, ': stress tokenizer must be o200k_base'],
    ['TOON encoder', (run) => { run.encoders['@toon-format/toon'] = '4.5.0'; }, ': stress @toon-format/toon encoder version must be 4.4.0'],
    ['Terset encoder', (run) => { run.encoders['@stackdeck/terset'] = '0.2.4'; }, ': stress @stackdeck/terset encoder version must be 0.3.0'],
    ['output cap', (run) => { run.budgets.perCallMaxOutputTokens = 2048; }, ': stress per-call output cap must be 16000'],
    ['input reservation', (run) => { run.inputReservation.allowance += 1; }, ': stress input reservation must be margin 1.25 and allowance 64'],
    ['price', (run) => { const model = run.models[0]; if (model) model.price.outputPerMillion += 1; }, ': stress gpt-6.1-sol price differs from the recorded price'],
    ['question set', (run) => { const row = run.rows[0]; if (row) row.questionId = 'other'; }, ' terset other: stress question is not in questions.json'],
    ['question dataset', (run) => { const row = run.rows[0]; if (row) row.dataset = 'scale-other'; }, ' terset s001: stress dataset differs from questions.json'],
  ] satisfies [string, (run: StressRun) => void, string][])('refuses stress runs with differing %s', (_name, change, message) => {
    const runs = freshStressRuns();
    const run = runs[1];
    if (run === undefined) throw new Error('No Sol run');
    change(run);
    expect(() => build(runs)).toThrow(new Error(`fixture-stress-gpt-6.1-sol${message}`));
  });

  it('requires every listed run, in model order, with the listed id and exactly its one model', () => {
    const missing = freshStressRuns();
    missing.pop();
    expect(() => build(missing)).toThrow(new Error('Expected every published stress run'));
    expect(() => buildStressAccuracy(freshStressRuns().reverse(), [...SOURCES].reverse())).toThrow(/stress model list/u);
    const id = freshStressRuns();
    const run = id[0];
    if (run === undefined) throw new Error('No Opus run');
    run.runId = 'other';
    expect(() => build(id)).toThrow(new Error(`${SOURCES[0]?.path ?? ''} holds run other`));
    const extra = freshStressRuns();
    const opus = extra[0];
    const sol = extra[1]?.models[0];
    if (opus === undefined || sol === undefined) throw new Error('No model');
    opus.models.push(sol);
    expect(() => build(extra)).toThrow(new Error('fixture-stress-claude-opus-5-5: a stress run must hold only claude-opus-5-5'));
  });

  it('requires a complete measured stress suite', () => {
    const runs = freshStressRuns();
    const run = runs[0];
    if (run === undefined) throw new Error('No Opus run');
    for (const [patch, message] of [
      [{ suite: 'toon' }, String.raw`Invalid input: expected \"stress\"`],
      [{ mode: 'fake' }, String.raw`Invalid input: expected \"http\"`],
      [{ status: 'partial' }, String.raw`Invalid input: expected \"complete\"`],
    ] as const) {
      expect(() => build([{ ...run, ...patch }, ...runs.slice(1)])).toThrow(message);
    }
  });

  it('refuses incomplete, duplicate or foreign calls, a failure never answered and a changed summary', () => {
    for (const [change, message] of [
      [(run) => { run.plannedCalls += 1; }, 'The run recorded 480 of 481 planned calls'],
      [(run) => { const row = run.rows[0]; if (row) row.model = 'other'; }, 'Unknown row model'],
      [(run) => { const row = run.rows[0]; const next = run.rows[4]; if (row && next) next.questionId = row.questionId; }, 'fixture-stress-claude-opus-5-5 terset s001: stress question was answered twice'],
      [(run) => { run.failures.push({ model: 'claude-opus-5-5', format: 'toon', dataset: 'scale-500', questionId: 'not-asked', status: 'failed' }); }, 'fixture-stress-claude-opus-5-5: a failed request was never answered (claude-opus-5-5 toon scale-500 not-asked)'],
      [(run) => { const summary = run.summary.find((row) => row.dataset === 'ALL'); if (summary) summary.metrics.correct += 1; }, "claude-opus-5-5 terset: the run's summary differs from the figures recomputed from its rows"],
    ] satisfies [(run: StressRun) => void, string][]) {
      const runs = freshStressRuns();
      const run = runs[0];
      if (run === undefined) throw new Error('No Opus run');
      change(run);
      expect(() => build(runs)).toThrow(new Error(message));
    }
  });

  it('keeps the committed stress JSON equal to the published runs', () => {
    expect(readFileSync(STRESS_OUTPUT, 'utf8')).toBe(stressAccuracyText());
  });

  it('keeps each README stress block equal to the committed stress JSON', () => {
    const expected = stressReadmeBlock(StressAccuracyFileSchema.parse(JSON.parse(readFileSync(STRESS_OUTPUT, 'utf8'))));
    for (const path of ['README.md', 'packages/terset/README.md', 'packages/terset-py/README.md']) {
      const text = readFileSync(`${REPO}${path}`, 'utf8');
      expect(text.match(/### Stress accuracy\n[\s\S]*?(?=\n## |\n### |$)/u)?.[0].trim(), path).toBe(expected);
    }
  });

  it('takes the README run date from its data', () => {
    const file = build(freshStressRuns());
    for (const run of file.publishedRuns) run.runOn = '2026-11-20';
    expect(stressReadmeBlock(file)).toContain('Each model ran once, on 2026-11-20.');
  });

  it('inserts or replaces the stress block without changing the TOON block or the next section', () => {
    const file = build(freshStressRuns());
    const before = '### Answer accuracy\n\nExisting TOON table.\n\n## Next\n\nKept.\n';
    const expected = `### Answer accuracy\n\nExisting TOON table.\n\n${stressReadmeBlock(file)}\n\n## Next\n\nKept.\n`;
    expect(updateStressReadme(before, file)).toBe(expected);
    expect(updateStressReadme(expected.replace('117 of 120', '0 of 120'), file)).toBe(expected);
    expect(updateStressReadme(expected, file)).toBe(expected);
  });
});
