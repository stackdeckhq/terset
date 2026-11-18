// The stress test on /benchmark and in /benchmark.md: harder questions in four groups,
// one run per model. Every figure comes from accuracy-stress-results.json, which
// `pnpm accuracy` writes from the published runs. A claim the data no longer supports
// throws instead of printing. Losses show as measured.
import raw from './accuracy-stress-results.json' with { type: 'json' };
import type { AccuracyFormat } from './accuracy-schema.ts';
import type { StressAccuracyFile } from './accuracy-stress-schema.ts';
import { formatCount } from './bench.ts';
import { REPO_URL } from './site.ts';

export type { StressAccuracyFile };
export type StressModel = StressAccuracyFile['models'][number];
export type StressRow = StressModel['rows'][number];
export type StressGroupScore = StressRow['groups'][number];
export type StressGroup = StressGroupScore['group'];

/** Typed without zod, so the browser skips it. data-check.ts proves it against StressAccuracyFileSchema. */
export const STRESS: StressAccuracyFile = raw as StressAccuracyFile;

/** The freeze record stays available after the branch is squash-merged. */
export const STRESS_FREEZE_URL = `${REPO_URL}/blob/main/bench/data/stress/README.md`;
export const STRESS_FREEZE_NOTE = `The questions were fixed before any model call. Each run file records the SHA-256 hashes of the question and dataset files. The publish step refuses a run whose hashes differ from the repo. See the [freeze record](${STRESS_FREEZE_URL}).`;

/** The format names the stress tables use, as in the README stress block. */
export const STRESS_FORMAT_LABELS: Readonly<Record<AccuracyFormat, string>> = {
  terset: 'Terset',
  'json-compact': 'Compact JSON',
  'json-pretty': 'Pretty JSON',
  toon: 'TOON',
};

/** Each group's name and one sentence on what it tests. */
export const STRESS_GROUP_LABELS: Readonly<Record<StressGroup, { readonly label: string; readonly tests: string }>> = {
  scale: { label: 'Scale', tests: 'Questions about long lists of records.' },
  deep: { label: 'Deep nesting', tests: 'Records nested many levels deep.' },
  messy: { label: 'Messy data', tests: 'Records with missing fields, mixed shapes and tricky text.' },
  damage: { label: 'Damage detection', tests: 'Each list is clean or damaged, and the model says which.' },
};

export const STRESS_FORMAT_NOTE = 'Pretty JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.';

export const STRESS_DAMAGE_NOTE = 'JSON has no row count, so compact and pretty JSON cannot show rows cut from the end. The damage group includes those cases.';

/**
 * A scoring effect that lowers one JSON score. The counts come from the published GPT 6.1 Sol
 * run, and stress.test.ts checks them against it and against the README.
 */
export const STRESS_QUOTED_NOTE = 'On GPT 6.1 Sol, 14 of the 22 compact JSON misses were correct yes or no answers wrapped in quote marks. The scorer was fixed before the runs and does not remove quote marks from yes or no answers, so they count as wrong. With them counted, compact JSON would score 112 of 120.';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

function countWord(value: number): string {
  return WORDS[value] ?? formatCount(value);
}

function assertClaim(holds: boolean, claim: string): void {
  if (!holds) throw new Error(`The stress copy says "${claim}", and the data no longer supports it`);
}

function listPhrase(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/** "119 of 120". */
export function stressScore(score: { readonly correct: number; readonly total: number }): string {
  return `${formatCount(score.correct)} of ${formatCount(score.total)}`;
}

export function stressModel(file: StressAccuracyFile, id: StressModel['id']): StressModel {
  const found = file.models.find((model) => model.id === id);
  if (found === undefined) throw new Error(`No ${id} in the stress data`);
  return found;
}

export function stressRow(model: StressModel, format: AccuracyFormat): StressRow {
  const found = model.rows.find((row) => row.format === format);
  if (found === undefined) throw new Error(`${model.name} has no ${format} stress row`);
  return found;
}

export function stressGroup(row: StressRow, group: StressGroup): StressGroupScore {
  const found = row.groups.find((item) => item.group === group);
  if (found === undefined) throw new Error(`No ${group} score for ${row.format}`);
  return found;
}

/** The groups in the order the data gives them. */
export function stressGroups(file: StressAccuracyFile): readonly StressGroup[] {
  return file.models[0]?.rows[0]?.groups.map((item) => item.group) ?? [];
}

/** The formats in table order, Terset first, as the data gives them. */
function stressFormats(file: StressAccuracyFile): readonly AccuracyFormat[] {
  return file.models[0]?.rows.map((row) => row.format) ?? [];
}

/** The dates of every stress run, oldest first, each once. */
export function stressRunDates(file: StressAccuracyFile): string {
  return listPhrase([...new Set(file.publishedRuns.map((run) => run.runOn))].sort());
}

/** What was asked, shared by the Markdown intro and the page intro. */
function stressScope(file: StressAccuracyFile): string {
  const groups = stressGroups(file);
  assertClaim(file.models.every((model) => model.rows.every((row) => row.total === file.questions)), `every format answered all ${String(file.questions)} questions`);
  return `Each model answered ${formatCount(file.questions)} harder questions in ${countWord(groups.length)} groups, sent in each of ${countWord(stressFormats(file).length)} formats.`;
}

/** The sentences that open the section in /benchmark.md. Inline Markdown links the freeze record. */
export function stressIntro(file: StressAccuracyFile): string {
  return [stressScope(file), STRESS_FREEZE_NOTE, `Each model ran once, on ${stressRunDates(file)}. So a gap of a few questions is within noise.`].join(' ');
}

/**
 * The open text of the stress section on /benchmark: what was asked, the one-run caveat
 * and where Terset scored lowest. The freeze record and the breakdown of the misses sit
 * in the section's fold, from STRESS_FREEZE_NOTE and stressLimitDetail.
 */
export function stressPageIntro(file: StressAccuracyFile): string {
  return [stressScope(file), `Each model ran once, on ${stressRunDates(file)}, so a gap of a few questions is within noise.`, stressLimitParts(file).headline].join(' ');
}

/**
 * Where Terset scored lowest, in plain words. The breakdown of the missed messy-data
 * answers comes from the published Claude Haiku 5.5 run, and stress.test.ts checks it
 * against that run. It throws if the scores it describes change.
 */
export function stressLimit(file: StressAccuracyFile): string {
  const { headline, detail } = stressLimitParts(file);
  return `${headline} ${detail}`;
}

/** The missed messy-data answers behind the lowest score, for the fold on /benchmark. */
export function stressLimitDetail(file: StressAccuracyFile): string {
  return stressLimitParts(file).detail;
}

/** What the stress fold on /benchmark holds, in one sentence built from the group names. */
export function stressFoldAbout(file: StressAccuracyFile): string {
  const labels = stressGroups(file).map((group) => STRESS_GROUP_LABELS[group].label.toLowerCase());
  return `What Terset missed, how the questions were frozen, and the ${listPhrase(labels)} scores on each model.`;
}

/**
 * The lowest stress score as one short line for "When to keep something else": the model, the
 * score and the sparse data behind most of the misses. The same checked facts as stressLimit.
 */
export function stressKeepElse(file: StressAccuracyFile): string {
  const { model, score, missed, sparse } = stressLimitParts(file);
  return `Stress test: on ${model}, Terset scored lowest of the ${countWord(stressFormats(file).length)} formats, with ${score}. ${sparse} of its ${countWord(missed)} messy-data misses were on sparse data, where many cells are empty.`;
}

interface StressLimitParts {
  readonly headline: string;
  readonly detail: string;
  readonly model: string;
  readonly score: string;
  readonly missed: number;
  readonly sparse: string;
}

function stressLimitParts(file: StressAccuracyFile): StressLimitParts {
  const lowest = file.models.filter((model) => {
    const terset = stressRow(model, 'terset');
    return model.rows.every((row) => row.format === 'terset' || row.correct > terset.correct);
  });
  assertClaim(lowest.length === 1 && lowest[0]?.id === 'claude-haiku-5-5', 'Terset scored lowest on Claude Haiku 5.5 only');
  const haiku = stressModel(file, 'claude-haiku-5-5');
  const terset = stressRow(haiku, 'terset');
  const messy = stressGroup(terset, 'messy');
  const toon = stressGroup(stressRow(haiku, 'toon'), 'messy');
  const missed = messy.total - messy.correct;
  assertClaim(missed === 6, 'Terset missed six messy-data questions on Claude Haiku 5.5');
  // The sparse-data count is read from the published run's answers; stress.test.ts checks it.
  const sparse = 'Four';
  return {
    model: haiku.name,
    score: stressScore(terset),
    missed,
    sparse,
    headline: `Terset scored lowest on ${haiku.name}, with ${stressScore(terset)}.`,
    detail: [
      `It missed ${formatCount(missed)} of ${formatCount(messy.total)} messy-data questions.`,
      `${sparse} were on sparse data, where many cells are empty.`,
      'In three of those, the model counted empty cells as present.',
      `TOON scored ${stressScore(toon)} there.`,
    ].join(' '),
  };
}

/** The headline table's columns after Format: each model's score, then its input tokens. */
export function stressColumns(file: StressAccuracyFile): readonly { readonly model: StressModel; readonly field: 'correct' | 'inputTokens' }[] {
  return file.models.flatMap((model) => [{ model, field: 'correct' as const }, { model, field: 'inputTokens' as const }]);
}

export const STRESS_FIELD_LABELS = { correct: 'Correct', inputTokens: 'Input tokens' } as const;

/** One row per format, Terset first: the format name, then each model's score and input tokens. */
export function stressTableRows(file: StressAccuracyFile): readonly (readonly string[])[] {
  return stressFormats(file).map((format) => [
    STRESS_FORMAT_LABELS[format],
    ...stressColumns(file).map(({ model, field }) => {
      const row = stressRow(model, format);
      return field === 'correct' ? stressScore(row) : formatCount(row.inputTokens);
    }),
  ]);
}

/**
 * The marks for the headline table, in the same shape as stressTableRows without the format
 * name. The fewest input tokens on each model are marked as a saving, ties included, as in the
 * per-model accuracy tables. Scores are never marked.
 */
export function stressTableMarks(file: StressAccuracyFile): readonly (readonly ('is-less' | null)[])[] {
  return stressFormats(file).map((format) => stressColumns(file).map(({ model, field }) => {
    if (field === 'correct') return null;
    const fewest = Math.min(...model.rows.map((row) => row.inputTokens));
    return stressRow(model, format).inputTokens === fewest ? 'is-less' : null;
  }));
}

/** One row per format for one group, Terset first: the format name, then each model's score. */
export function stressGroupRows(file: StressAccuracyFile, group: StressGroup): readonly (readonly string[])[] {
  return stressFormats(file).map((format) => [STRESS_FORMAT_LABELS[format], ...file.models.map((model) => stressScore(stressGroup(stressRow(model, format), group)))]);
}

/** How input tokens were counted. The schema allows only tokens as each model reported them. */
export function stressTokensNote(file: StressAccuracyFile): string {
  return `Input tokens are for all ${formatCount(file.questions)} questions, as each model reported them.`;
}

/**
 * Why two token columns in the headline table are the same: the two Claude models reported the
 * same input tokens. This file holds the totals per format; stress.test.ts checks every call in
 * the published runs. It throws unless exactly those two models match on every format.
 */
export function stressSharedTokensLine(file: StressAccuracyFile): string {
  const formats = stressFormats(file);
  const same = (a: StressModel, b: StressModel): boolean => formats.every((format) => stressRow(a, format).inputTokens === stressRow(b, format).inputTokens);
  const pairs = file.models.flatMap((a, index) => file.models.slice(index + 1).filter((b) => same(a, b)).map((b) => [a, b] as const));
  const [pair] = pairs;
  const ids = pair === undefined ? [] : pair.map((model) => model.id).sort();
  assertClaim(pairs.length === 1 && ids.join() === 'claude-haiku-5-5,claude-opus-5-5', 'Claude Opus 5.5 and Claude Haiku 5.5 reported the same input tokens');
  const [first, second] = pair ?? [];
  return `${first?.name ?? ''} and ${second?.name ?? ''} reported the same input tokens on every call, so their token columns match.`;
}

/** The notes under the headline table: how tokens were counted, the shared Claude counts, and the two JSON forms. */
export function stressHeadlineNote(file: StressAccuracyFile): string {
  return `${stressTokensNote(file)} ${stressSharedTokensLine(file)} ${STRESS_FORMAT_NOTE}`;
}

/** One link per published run report, named by its model. Inline Markdown. */
export function stressReportsLine(file: StressAccuracyFile): string {
  const links = file.publishedRuns.map((run) => `[${stressModel(file, run.model).name}](${REPO_URL}/blob/main/${run.publishedPath}/${run.runId}.md)`);
  return `Every answer and its score: ${listPhrase(links)}.`;
}

const markdownRow = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;

function markdownTable(head: readonly string[], rows: readonly (readonly string[])[]): string {
  return [markdownRow(head), markdownRow(head.map(() => '---')), ...rows.map(markdownRow)].join('\n');
}

/** Flat column heads for the Markdown headline table, where cells cannot span. */
export function stressMarkdownHead(file: StressAccuracyFile): readonly string[] {
  return ['Format', ...stressColumns(file).map(({ model, field }) => `${model.name}, ${STRESS_FIELD_LABELS[field].toLowerCase()}`)];
}

/** The section for /benchmark.md, with the same facts in the same order as the page. */
export function stressMarkdown(file: StressAccuracyFile): readonly string[] {
  return [
    '## Stress test',
    stressIntro(file),
    stressLimit(file),
    `### All ${formatCount(file.questions)} questions`,
    markdownTable(stressMarkdownHead(file), stressTableRows(file)),
    stressHeadlineNote(file),
    STRESS_QUOTED_NOTE,
    ...stressGroups(file).flatMap((group) => [
      `### ${STRESS_GROUP_LABELS[group].label}`,
      STRESS_GROUP_LABELS[group].tests,
      markdownTable(['Format', ...file.models.map((model) => model.name)], stressGroupRows(file, group)),
      ...(group === 'damage' ? [STRESS_DAMAGE_NOTE] : []),
    ]),
    stressReportsLine(file),
  ];
}
