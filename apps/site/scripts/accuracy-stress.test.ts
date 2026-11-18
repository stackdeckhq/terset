import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { STRESS_OUTPUT, STRESS_PUBLISHED_RUNS, StressRunFile, buildStressAccuracy, stressAccuracyText, stressReadmeBlock, updateStressReadme } from './accuracy-stress.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

function freshStressRuns(): z.infer<typeof StressRunFile>[] {
  return STRESS_PUBLISHED_RUNS.map((source) => StressRunFile.parse(JSON.parse(readFileSync(`${REPO}${source.path}`, 'utf8'))));
}

describe('stress accuracy', () => {
  it('publishes each measured score once, with reported input tokens and group totals', () => {
    const runs = freshStressRuns();
    const file = buildStressAccuracy(runs);
    expect(file.aggregation).toBe('single-run-per-model');
    expect(file.models.map((model) => model.rows.map((row) => row.correct))).toEqual([
      [119, 116, 117, 120],
      [116, 98, 111, 119],
      [109, 114, 112, 112],
    ]);
    for (const model of file.models) {
      expect(model.inputTokensFrom).toBe('model-report');
      for (const row of model.rows) {
        const reported = runs.flatMap((run) => run.rows).filter((entry) => entry.model === model.id && entry.format === row.format);
        expect(row.inputTokens).toBe(reported.reduce((sum, entry) => sum + entry.inputTokens, 0));
        expect(row.total).toBe(120);
        expect(row.runId).toContain('-16k-2026-11-18');
        expect(row.runOn).toBe('2026-11-18');
        expect(row.groups.map((group) => [group.group, group.total])).toEqual([['scale', 30], ['deep', 25], ['messy', 40], ['damage', 25]]);
        expect(row.groups.reduce((sum, group) => sum + group.correct, 0)).toBe(row.correct);
        expect(row.groups.reduce((sum, group) => sum + group.inputTokens, 0)).toBe(row.inputTokens);
      }
    }
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
    ['Terset encoder', (run) => { run.encoders['@stackdeck/terset'] = '0.2.5'; }, 'stress @stackdeck/terset encoder version must be 0.2.4'],
    ['output cap', (run) => { run.budgets.perCallMaxOutputTokens = 2048; }, 'stress per-call output cap must be 16000'],
    ['reference date', (run) => { run.referenceDate = '2020-01-01T00:00:00.000Z'; }, 'stress reference date must be 2026-11-17T00:00:00.000Z'],
    ['tokenizer', (run) => { run.tokenizer = 'other'; }, 'stress tokenizer must be o200k_base'],
    ['input reservation', (run) => { run.inputReservation.allowance += 1; }, 'stress input reservation must be margin 1.25 and allowance 64'],
    ['price', (run) => { const model = run.models[0]; if (model) model.price.inputPerMillion = 0.01; }, 'stress claude-opus-5-5 price differs from the recorded price'],
  ] satisfies [string, (run: z.infer<typeof StressRunFile>) => void, string][])('refuses a consistent change to every run: %s', (_name, change, message) => {
    const runs = freshStressRuns();
    runs.forEach(change);
    expect(() => buildStressAccuracy(runs)).toThrow(new Error(`stress-opus-16k-2026-11-18: ${message}`));
  });

  it.each([
    ['unknown question', (run) => { for (const row of run.rows) if (row.questionId === 's001') row.questionId = 'other'; }, 'terset other: stress question is not in questions.json'],
    ['missing question', (run) => { run.rows.shift(); run.plannedCalls -= 1; }, 'json-compact: stress question set differs from questions.json'],
    ['duplicate question', (run) => { const row = run.rows[0]; if (row) run.rows.push({ ...row }); run.plannedCalls += 1; }, 'json-compact s001: stress question was answered twice'],
    ['question dataset', (run) => { const row = run.rows[0]; if (row) row.dataset = 'messy-other'; }, 'json-compact s001: stress dataset differs from questions.json'],
    ['expected answer', (run) => { const row = run.rows[0]; if (row) row.expected = 'other'; }, 'json-compact s001: stress expected answer differs from questions.json'],
    ['correct flag', (run) => { const row = run.rows[0]; if (row) row.correct = !row.correct; }, 'json-compact s001: stress correct flag differs from re-scoring the answer'],
    ['answer text', (run) => { const row = run.rows[0]; if (row) row.text = 'not an answer'; }, 'json-compact s001: stress correct flag differs from re-scoring the answer'],
  ] satisfies [string, (run: z.infer<typeof StressRunFile>) => void, string][])('checks frozen questions even when every run has the same tamper: %s', (_name, change, message) => {
    const runs = freshStressRuns();
    runs.forEach(change);
    expect(() => buildStressAccuracy(runs)).toThrow(new Error(`stress-opus-16k-2026-11-18 ${message}`));
  });

  it.each([
    ['data hashes', (run) => { run.dataHashes['datasets.json'] = 'a'.repeat(64); }, 'stress-sol-16k-2026-11-18: stress datasets.json hash differs from the repository'],
    ['question hashes', (run) => { run.dataHashes['questions.json'] = 'a'.repeat(64); }, 'stress-sol-16k-2026-11-18: stress questions.json hash differs from the repository'],
    ['generator hash', (run) => { run.generatorSha256 = 'a'.repeat(64); }, 'stress-sol-16k-2026-11-18: stress generator hash differs from the repository'],
    ['generator source', (run) => { run.generatorSource = 'other.ts'; }, 'stress-sol-16k-2026-11-18: stress generator source must be bench/src/stress/generate.ts'],
    ['seed', (run) => { run.seed += 1; }, 'stress-sol-16k-2026-11-18: stress seed must be 20261117'],
    ['reference date', (run) => { run.referenceDate = '2026-11-18T00:00:00.000Z'; }, 'stress-sol-16k-2026-11-18: stress reference date must be 2026-11-17T00:00:00.000Z'],
    ['tokenizer', (run) => { run.tokenizer = 'other'; }, 'stress-sol-16k-2026-11-18: stress tokenizer must be o200k_base'],
    ['TOON encoder', (run) => { run.encoders['@toon-format/toon'] = '4.5.0'; }, 'stress-sol-16k-2026-11-18: stress @toon-format/toon encoder version must be 4.4.0'],
    ['Terset encoder', (run) => { run.encoders['@stackdeck/terset'] = '0.2.5'; }, 'stress-sol-16k-2026-11-18: stress @stackdeck/terset encoder version must be 0.2.4'],
    ['output cap', (run) => { run.budgets.perCallMaxOutputTokens = 2048; }, 'stress-sol-16k-2026-11-18: stress per-call output cap must be 16000'],
    ['input reservation', (run) => { run.inputReservation.allowance += 1; }, 'stress-sol-16k-2026-11-18: stress input reservation must be margin 1.25 and allowance 64'],
    ['question set', (run) => { const row = run.rows[0]; if (row) row.questionId = 'other'; }, 'stress-sol-16k-2026-11-18 json-compact other: stress question is not in questions.json'],
    ['question dataset', (run) => { const row = run.rows[0]; if (row) row.dataset = 'scale-other'; }, 'stress-sol-16k-2026-11-18 json-compact s001: stress dataset differs from questions.json'],
  ] satisfies [string, (run: z.infer<typeof StressRunFile>) => void, string][])('refuses stress runs with differing %s', (_name, change, message) => {
    const runs = freshStressRuns();
    const run = runs[1];
    if (run === undefined) throw new Error('No Sol run');
    change(run);
    expect(() => buildStressAccuracy(runs)).toThrow(new Error(message));
  });

  it('requires every listed run, the listed id and exactly its one model', () => {
    const missing = freshStressRuns();
    missing.pop();
    expect(() => buildStressAccuracy(missing)).toThrow(new Error('Expected every published stress run'));
    const id = freshStressRuns();
    const run = id[0];
    if (run === undefined) throw new Error('No Opus run');
    run.runId = 'other';
    expect(() => buildStressAccuracy(id)).toThrow(new Error(`${STRESS_PUBLISHED_RUNS[0]?.path ?? ''} holds run other`));
    const extra = freshStressRuns();
    const opus = extra[0];
    const sol = extra[1]?.models[0];
    if (opus === undefined || sol === undefined) throw new Error('No model');
    opus.models.push(sol);
    expect(() => buildStressAccuracy(extra)).toThrow(new Error('stress-opus-16k-2026-11-18: a stress run must hold only claude-opus-5-5'));
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
      expect(() => buildStressAccuracy([{ ...run, ...patch }, ...runs.slice(1)])).toThrow(message);
    }
  });

  it('refuses incomplete, duplicate or foreign calls and a changed summary', () => {
    for (const [change, message] of [
      [(run) => { run.plannedCalls += 1; }, 'The run recorded 480 of 481 planned calls'],
      [(run) => { const row = run.rows[0]; if (row) row.model = 'other'; }, 'Unknown row model'],
      [(run) => { const row = run.rows[0]; const next = run.rows[4]; if (row && next) next.questionId = row.questionId; }, 'stress-opus-16k-2026-11-18 json-compact s001: stress question was answered twice'],
      [(run) => { const summary = run.summary.find((row) => row.dataset === 'ALL'); if (summary) summary.metrics.correct += 1; }, "claude-opus-5-5 json-compact: the run's summary differs from the figures recomputed from its rows"],
    ] satisfies [(run: z.infer<typeof StressRunFile>) => void, string][]) {
      const runs = freshStressRuns();
      const run = runs[0];
      if (run === undefined) throw new Error('No Opus run');
      change(run);
      expect(() => buildStressAccuracy(runs)).toThrow(new Error(message));
    }
  });

  it('keeps the committed stress JSON equal to the published runs', () => {
    expect(readFileSync(STRESS_OUTPUT, 'utf8')).toBe(stressAccuracyText());
  });

  it('keeps each README stress block equal to the published runs', () => {
    const expected = stressReadmeBlock(buildStressAccuracy(freshStressRuns()));
    for (const path of ['README.md', 'packages/terset/README.md', 'packages/terset-py/README.md']) {
      const text = readFileSync(`${REPO}${path}`, 'utf8');
      expect(text.match(/### Stress accuracy\n[\s\S]*?(?=\n## |\n### |$)/u)?.[0].trim(), path).toBe(expected);
    }
  });

  it('takes the README introduction date and question count from its data', () => {
    const file = buildStressAccuracy(freshStressRuns());
    file.questions = 121;
    for (const run of file.publishedRuns) run.runOn = '2026-11-19';
    expect(stressReadmeBlock(file)).toContain('One run per model on 2026-11-19, with 121 harder questions in all four formats.');
  });

  it('inserts or replaces the stress block without changing the TOON block or the next section', () => {
    const file = buildStressAccuracy(freshStressRuns());
    const before = '### Answer accuracy\n\nExisting TOON table.\n\n## Next\n\nKept.\n';
    const expected = `### Answer accuracy\n\nExisting TOON table.\n\n${stressReadmeBlock(file)}\n\n## Next\n\nKept.\n`;
    expect(updateStressReadme(before, file)).toBe(expected);
    expect(updateStressReadme(expected.replace('119 of 120', '0 of 120'), file)).toBe(expected);
    expect(updateStressReadme(expected, file)).toBe(expected);
  });
});
