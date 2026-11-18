// The stress section reads the committed stress file, the file agrees with the
// published runs, and every loss shows as measured.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { HISTORY_NOTE } from './history.ts';
import { BENCH_FILE, CLAUDE_FILE } from './numbers.ts';
import {
  STRESS,
  STRESS_DAMAGE_NOTE,
  STRESS_FORMAT_LABELS,
  STRESS_QUOTED_NOTE,
  STRESS_FREEZE_NOTE,
  STRESS_FREEZE_URL,
  STRESS_GROUP_LABELS,
  stressFoldAbout,
  stressGroupRows,
  stressGroups,
  stressHeadlineNote,
  stressIntro,
  stressLimit,
  stressLimitDetail,
  stressMarkdown,
  stressPageIntro,
  stressMarkdownHead,
  stressReportsLine,
  stressSharedTokensLine,
  stressTableMarks,
  stressTableRows,
} from './stress.ts';
import type { StressAccuracyFile } from './stress.ts';

const REPO = new URL('../../../../', import.meta.url);

interface PublishedRow {
  readonly format: string;
  readonly dataset: string;
  readonly correct: boolean;
  readonly text: string;
  readonly expected: string;
}

/** The rows of one published stress run, read from bench/published. */
function publishedRows(path: string): readonly PublishedRow[] {
  const run = JSON.parse(readFileSync(new URL(`${path}.json`, REPO), 'utf8')) as { readonly rows: readonly PublishedRow[] };
  return run.rows;
}

/** A copy of the committed file with one change made to it. */
function changed(change: (file: StressAccuracyFile) => void): StressAccuracyFile {
  const copy = structuredClone(STRESS);
  change(copy);
  return copy;
}

describe('stress section', () => {
  it('shows every format on every model, Terset first, with the measured scores and tokens', () => {
    expect(stressMarkdownHead(STRESS)).toEqual([
      'Format',
      'Claude Opus 5.5, correct',
      'Claude Opus 5.5, input tokens',
      'GPT 6.1 Sol, correct',
      'GPT 6.1 Sol, input tokens',
      'Claude Haiku 5.5, correct',
      'Claude Haiku 5.5, input tokens',
    ]);
    expect(stressTableRows(STRESS)).toEqual([
      ['Terset', '119 of 120', '512,108', '116 of 120', '368,136', '109 of 120', '512,108'],
      ['Compact JSON', '116 of 120', '1,057,589', '98 of 120', '756,623', '114 of 120', '1,057,589'],
      ['Pretty JSON', '117 of 120', '1,674,107', '111 of 120', '1,372,895', '112 of 120', '1,674,107'],
      ['TOON', '120 of 120', '592,809', '119 of 120', '477,829', '112 of 120', '592,809'],
    ]);
  });

  it('shows each group on every model, losses included', () => {
    expect(stressGroups(STRESS)).toEqual(['scale', 'deep', 'messy', 'damage']);
    expect(stressGroupRows(STRESS, 'messy')).toEqual([
      ['Terset', '40 of 40', '40 of 40', '34 of 40'],
      ['Compact JSON', '40 of 40', '38 of 40', '40 of 40'],
      ['Pretty JSON', '40 of 40', '40 of 40', '39 of 40'],
      ['TOON', '40 of 40', '40 of 40', '39 of 40'],
    ]);
    expect(stressGroupRows(STRESS, 'damage')).toEqual([
      ['Terset', '25 of 25', '25 of 25', '25 of 25'],
      ['Compact JSON', '22 of 25', '7 of 25', '22 of 25'],
      ['Pretty JSON', '22 of 25', '21 of 25', '22 of 25'],
      ['TOON', '25 of 25', '25 of 25', '25 of 25'],
    ]);
    expect(stressGroupRows(STRESS, 'scale').map((row) => row.at(-1))).toEqual(['25 of 30', '27 of 30', '26 of 30', '23 of 30']);
  });

  it('builds every cell from the data, so a changed score changes the table', () => {
    const file = changed((copy) => {
      const haiku = copy.models[2]?.rows[0];
      const messy = haiku?.groups[2];
      if (haiku === undefined || messy === undefined) throw new Error('no Haiku Terset row');
      haiku.correct = 110;
      messy.correct = 35;
    });
    expect(stressTableRows(file)[0]?.[5]).toBe('110 of 120');
    expect(stressGroupRows(file, 'messy')[0]?.[3]).toBe('35 of 40');
    // The breakdown of the six misses no longer fits, so the line refuses to print.
    expect(() => stressLimit(file)).toThrow(/no longer supports it/u);
  });

  it('matches every score and token count in the published runs', () => {
    for (const run of STRESS.publishedRuns) {
      const rows = publishedRows(`${run.publishedPath}/${run.runId}`);
      const model = STRESS.models.find((item) => item.id === run.model);
      if (model === undefined) throw new Error(`no ${run.model}`);
      for (const row of model.rows) {
        const formatRows = rows.filter((item) => item.format === row.format);
        expect(formatRows.filter((item) => item.correct).length, `${run.runId} ${row.format}`).toBe(row.correct);
        expect(formatRows.length).toBe(row.total);
        for (const group of row.groups) {
          const groupRows = formatRows.filter((item) => item.dataset.startsWith(`${group.group}-`));
          expect(groupRows.filter((item) => item.correct).length, `${run.runId} ${row.format} ${group.group}`).toBe(group.correct);
          expect(groupRows.length).toBe(group.total);
        }
      }
    }
  });

  it('states where Terset scored lowest, in plain words', () => {
    expect(stressLimit(STRESS)).toBe(
      'Terset scored lowest on Claude Haiku 5.5, with 109 of 120. It missed 6 of 40 messy-data questions. Four were on sparse data, where many cells are empty. In three of those, the model counted empty cells as present. TOON scored 39 of 40 there.',
    );
    const notLowest = changed((copy) => {
      const terset = copy.models[2]?.rows[0];
      if (terset === undefined) throw new Error('no Haiku Terset row');
      terset.correct = 115;
    });
    expect(() => stressLimit(notLowest)).toThrow(/Terset scored lowest on Claude Haiku 5.5 only/u);
  });

  it('describes the missed messy-data answers as the published Haiku run records them', () => {
    const haiku = STRESS.publishedRuns.find((run) => run.model === 'claude-haiku-5-5');
    if (haiku === undefined) throw new Error('no Haiku run');
    const rows = publishedRows(`${haiku.publishedPath}/${haiku.runId}`).filter((row) => row.dataset.startsWith('messy-'));
    const missed = rows.filter((row) => row.format === 'terset' && !row.correct);
    const sparse = missed.filter((row) => row.dataset === 'messy-sparse');
    expect(missed).toHaveLength(6);
    expect(sparse).toHaveLength(4);
    // Every record counted, as if no cell were empty: the list has 120 records.
    expect(sparse.filter((row) => row.text === '120')).toHaveLength(3);
    expect(rows.filter((row) => row.format === 'toon' && row.correct)).toHaveLength(39);
  });

  it('states the quoted yes or no answers as the published GPT 6.1 Sol run records them', () => {
    const sol = STRESS.publishedRuns.find((run) => run.model === 'gpt-6.1-sol');
    if (sol === undefined) throw new Error('no Sol run');
    const missed = publishedRows(`${sol.publishedPath}/${sol.runId}`).filter((row) => row.format === 'json-compact' && !row.correct);
    const quoted = missed.filter((row) => row.text.trim() === `"${row.expected}"` && ['YES', 'NO'].includes(row.expected));
    expect(missed).toHaveLength(22);
    expect(quoted).toHaveLength(14);
    expect(STRESS_QUOTED_NOTE).toContain('14 of the 22 compact JSON misses');
    expect(STRESS_QUOTED_NOTE).toContain(`${String(120 - missed.length + quoted.length)} of 120`);
  });

  it('puts the quote-mark note right under the headline table in benchmark.md, once', () => {
    const blocks = stressMarkdown(STRESS);
    const table = blocks.findIndex((block) => block.startsWith('| Format |'));
    expect(blocks[table + 1]).toBe(stressHeadlineNote(STRESS));
    expect(blocks[table + 2]).toBe(STRESS_QUOTED_NOTE);
    expect(blocks.filter((block) => block === STRESS_QUOTED_NOTE)).toHaveLength(1);
  });

  it('says the two Claude models reported the same input tokens only because every published call agrees', () => {
    const tokensByCall = (model: string): ReadonlyMap<string, number> => {
      const run = STRESS.publishedRuns.find((item) => item.model === model);
      if (run === undefined) throw new Error(`no ${model} run`);
      const rows = JSON.parse(readFileSync(new URL(`${run.publishedPath}/${run.runId}.json`, REPO), 'utf8')) as { readonly rows: readonly { readonly format: string; readonly questionId: string; readonly inputTokens: number }[] };
      return new Map(rows.rows.map((row) => [`${row.format} ${row.questionId}`, row.inputTokens]));
    };
    const opus = tokensByCall('claude-opus-5-5');
    const haiku = tokensByCall('claude-haiku-5-5');
    expect(opus.size).toBe(480);
    expect([...haiku.keys()].sort()).toEqual([...opus.keys()].sort());
    for (const [call, tokens] of opus) expect(haiku.get(call), call).toBe(tokens);
    expect(stressSharedTokensLine(STRESS)).toBe('Claude Opus 5.5 and Claude Haiku 5.5 reported the same input tokens on every call, so their token columns match.');
    // A changed count on either model stops the line.
    const split = changed((file) => {
      const row = file.models.find((model) => model.id === 'claude-haiku-5-5')?.rows[0];
      if (row !== undefined) row.inputTokens += 1;
    });
    expect(() => stressSharedTokensLine(split)).toThrow(/no longer supports it/u);
  });

  it('keeps the README short but still names the loss and points at this section', () => {
    const readme = readFileSync(new URL('README.md', REPO), 'utf8');
    expect(readme).toContain('Terset scored lowest on Claude Haiku 5.5. Results by group, every loss and the method: [terset.dev/benchmark](https://terset.dev/benchmark#stress).');
  });

  it('opens with the suite, the freeze and the noise, and links the freeze the READMEs record', () => {
    expect(stressIntro(STRESS)).toBe(
      `Each model answered 120 harder questions in four groups, sent in each of four formats. The questions were fixed before any model call. Each run file records the SHA-256 hashes of the question and dataset files. The publish step refuses a run whose hashes differ from the repo. See the [freeze record](${STRESS_FREEZE_URL}). Each model ran once, on 2026-11-18. So a gap of a few questions is within noise.`,
    );
    expect(stressIntro(STRESS)).toContain(STRESS_FREEZE_NOTE);
    expect(STRESS_FREEZE_URL).toBe('https://github.com/stackdeckhq/terset/blob/main/bench/data/stress/README.md');
    const record = readFileSync(new URL('bench/data/stress/README.md', REPO), 'utf8');
    expect(record).toContain('Questions were frozen before any model call.');
  });

  it('splits the page text into open and folded parts with nothing lost', () => {
    const open = stressPageIntro(STRESS);
    expect(open).toBe(
      'Each model answered 120 harder questions in four groups, sent in each of four formats. Each model ran once, on 2026-11-18, so a gap of a few questions is within noise. Terset scored lowest on Claude Haiku 5.5, with 109 of 120.',
    );
    // The fold holds the freeze record and the breakdown of the misses, word for word as in the Markdown.
    expect(stressIntro(STRESS)).toContain(STRESS_FREEZE_NOTE);
    expect(stressLimit(STRESS)).toBe(`Terset scored lowest on Claude Haiku 5.5, with 109 of 120. ${stressLimitDetail(STRESS)}`);
    expect(open).toContain('Terset scored lowest on Claude Haiku 5.5, with 109 of 120.');
    expect(stressFoldAbout(STRESS)).toBe('What Terset missed, how the questions were frozen, and the scale, deep nesting, messy data and damage detection scores on each model.');
  });

  it('links the same three run reports as the README', () => {
    const line = stressReportsLine(STRESS);
    const readme = readFileSync(new URL('README.md', REPO), 'utf8');
    const links = [...line.matchAll(/\[[^\]]+\]\([^)]+\)/gu)].map((match) => match[0]);
    expect(links).toHaveLength(3);
    for (const link of links) expect(readme).toContain(link);
  });

  it('keeps the copy plain: no dashes, the format and group names as in the README', () => {
    const text = stressMarkdown(STRESS).join('\n');
    expect(text).not.toMatch(/[–—]/u);
    expect(Object.values(STRESS_FORMAT_LABELS)).toEqual(['Terset', 'Compact JSON', 'Pretty JSON', 'TOON']);
    expect(Object.values(STRESS_GROUP_LABELS).map((group) => group.label)).toEqual(['Scale', 'Deep nesting', 'Messy data', 'Damage detection']);
    expect(STRESS_DAMAGE_NOTE).toContain('JSON has no row count');
  });

  it('puts the section in benchmark.md, after the accuracy runs and before the method', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    for (const block of stressMarkdown(STRESS)) expect(text).toContain(block);
    expect(text).toContain('| Terset | 119 of 120 | 512,108 | 116 of 120 | 368,136 | 109 of 120 | 512,108 |');
    expect(text.indexOf('### Published runs')).toBeLessThan(text.indexOf('## Stress test'));
    expect(text.indexOf('## Stress test')).toBeLessThan(text.indexOf('## Method'));
  });

  it('has the history note point at the stress test, which is no longer in progress', () => {
    expect(HISTORY_NOTE).toContain('The stress test above');
    expect(HISTORY_NOTE).not.toContain('in progress');
  });

  it('marks only the fewest input tokens on each model, never a score', () => {
    expect(stressTableMarks(STRESS)).toEqual([
      [null, 'is-less', null, 'is-less', null, 'is-less'],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
    ]);
  });
});
