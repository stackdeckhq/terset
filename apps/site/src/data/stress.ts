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
 * run, and stress.test.ts checks the miss count against the committed Sol compact JSON score.
 */
export const STRESS_QUOTED_NOTE = 'On GPT 6.1 Sol, 11 of the 20 compact JSON misses were correct yes or no answers wrapped in quote marks. The scorer was fixed before the runs and does not remove quote marks from yes or no answers, so they count as wrong. With them counted, compact JSON would score 111 of 120.';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

function countWord(value: number): string {
  return WORDS[value] ?? formatCount(value);
}

function assertClaim(holds: boolean, claim: string): void {
  if (!holds) throw new Error(`The stress copy says "${claim}", and the data no longer supports it`);
}

/**
 * Where the stress test stands beside the tuning note, and Terset's place on each model.
 * Format 1.1 was shaped by an earlier stress run, so the note says the test is not held out.
 */
export function stressHeldOutNote(file: StressAccuracyFile): string {
  const best = (model: StressModel): number => Math.max(...model.rows.map((row) => row.correct));
  const tied = file.models.filter((model) => {
    const top = best(model);
    return stressRow(model, 'terset').correct === top && model.rows.filter((row) => row.correct === top).length > 1;
  });
  const behind = file.models.filter((model) => !tied.includes(model));
  const [trailing] = behind;
  const leader = trailing === undefined ? [] : trailing.rows.filter((row) => row.correct === best(trailing));
  const result = `Terset tied for the top score on two of the three models and was one answer behind TOON on ${trailing?.name ?? 'the third'}.`;
  assertClaim(file.models.length === 3
    && file.models.every((model) => model.rows.every((row) => row.total === file.questions))
    && tied.length === 2 && trailing !== undefined && behind.length === 1
    && leader.length === 1 && leader[0]?.format === 'toon'
    && best(trailing) - stressRow(trailing, 'terset').correct === 1, result);
  const frozenOn = file.source.referenceDate.slice(0, 10);
  assertClaim(frozenOn === '2026-11-17', 'The stress questions were frozen on 2026-11-17');
  return `The stress questions were frozen on ${frozenOn} before any model call. Format 1.1 came after that. Its named cells were designed to fix sparse-record misses seen in an earlier stress run, and were checked on new data from the same stress generator. So the stress test is not a held-out check of format 1.1. ${result}`;
}

function listPhrase(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/** "119 of 120". */
export function stressScore(score: { readonly correct: number; readonly total: number }): string {
  return `${formatCount(score.correct)} of ${formatCount(score.total)}`;
}

/** A row's score, overall or for one group. */
export function stressResultScore(row: StressRow, group?: StressGroup): string {
  return stressScore(group === undefined ? row : stressGroup(row, group));
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
export function stressScope(file: StressAccuracyFile): string {
  const groups = stressGroups(file);
  assertClaim(file.models.every((model) => model.rows.every((row) => row.total === file.questions)), `every format answered all ${String(file.questions)} questions`);
  return `Each model answered ${formatCount(file.questions)} harder questions in ${countWord(groups.length)} groups, sent in each of ${countWord(stressFormats(file).length)} formats.`;
}

/** The sentences that open the section in /benchmark.md. Inline Markdown links the freeze record. */
export function stressIntro(file: StressAccuracyFile): string {
  return [stressScope(file), STRESS_FREEZE_NOTE, stressRunsNote(file)].join(' ');
}

/** How many runs each cell comes from, shared with the README. */
export function stressRunsNote(file: StressAccuracyFile): string {
  const note = `Each model ran once, on ${stressRunDates(file)}. Each cell is that one run. These runs used Terset 1.1.`;
  assertClaim(file.publishedRuns.length === file.models.length && file.models.every((model) => file.publishedRuns.filter((run) => run.model === model.id).length === 1), note);
  return note;
}

/**
 * The open text of the stress section on /benchmark: what was asked, the repeat counts
 * and where Terset scored lowest. The freeze record and the breakdown of the misses sit
 * in the section's fold, from STRESS_FREEZE_NOTE and stressLimitDetail.
 */
export function stressPageIntro(file: StressAccuracyFile): string {
  return [stressScope(file), stressRunsNote(file), stressLimitParts(file).headline].join(' ');
}

/**
 * Where Terset missed, in plain words: mostly long lists, plus one sparse field count
 * on Claude Haiku 5.5. It throws if those facts change.
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
 * The long-list weak spot for "When to keep something else".
 * The same checked facts as stressLimit.
 */
export function stressKeepElse(file: StressAccuracyFile): string {
  const { haiku, leader } = stressLimitParts(file);
  return `Long lists on Haiku: Terset got ${stressResultScore(stressRow(haiku, 'terset'), 'scale')} questions, where ${formatName(leader.format)} got ${formatCount(stressGroup(leader, 'scale').correct)}.`;
}

/** A format's name inside a sentence, as the notes write them: "pretty JSON", "TOON". */
function formatName(format: AccuracyFormat): string {
  const label = STRESS_FORMAT_LABELS[format];
  return format.startsWith('json-') ? `${label.charAt(0).toLowerCase()}${label.slice(1)}` : label;
}

interface StressLimitParts {
  readonly headline: string;
  readonly detail: string;
  readonly haiku: StressModel;
  /** The one format with the best long-list score on Haiku. */
  readonly leader: StressRow;
}

function stressLimitParts(file: StressAccuracyFile): StressLimitParts {
  const misses = (group?: StressGroup): number => file.models.reduce((sum, model) => {
    const score = group === undefined ? stressRow(model, 'terset') : stressGroup(stressRow(model, 'terset'), group);
    return sum + score.total - score.correct;
  }, 0);
  const all = misses();
  const scale = misses('scale');
  const headline = `Of Terset's ${formatCount(all)} misses across the three models, ${formatCount(scale)} were on long lists.`;
  assertClaim(file.models.length === 3 && scale * 2 > all, headline);

  const haiku = stressModel(file, 'claude-haiku-5-5');
  const terset = stressRow(haiku, 'terset');
  const top = Math.max(...haiku.rows.map((row) => stressGroup(row, 'scale').correct));
  const leaders = haiku.rows.filter((row) => stressGroup(row, 'scale').correct === top);
  const [leader] = leaders;
  const longLists = `On ${haiku.name} it got ${stressResultScore(terset, 'scale')} long-list questions, where ${leader === undefined ? 'the best format' : formatName(leader.format)} got ${formatCount(top)}.`;
  assertClaim(leader !== undefined && leaders.length === 1 && leader.format !== 'terset', longLists);

  const other = `Its one other miss was a field count on sparse records, on ${haiku.name}.`;
  const sparseMisses = terset.sparseFieldCounts.filter((answer) => !answer.correct);
  assertClaim(all - scale === 1
    && stressGroup(terset, 'messy').total - stressGroup(terset, 'messy').correct === 1
    && sparseMisses.length === 1 && sparseMisses[0]?.dataset === 'messy-sparse'
    && /^How many records include a .+ field, counting null and empty values\?$/u.test(sparseMisses[0].prompt), other);
  if (leader === undefined) throw new Error('No long-list leader on Haiku');
  return { headline, detail: `${longLists} ${other}`, haiku, leader };
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
      return field === 'correct' ? stressResultScore(row) : formatCount(row.inputTokens);
    }),
  ]);
}

/**
 * The marks for the headline table, in the same shape as stressTableRows without the format
 * name. The fewest input tokens on each model are marked as a saving, shared counts included, as in the
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
  return stressFormats(file).map((format) => [STRESS_FORMAT_LABELS[format], ...file.models.map((model) => stressResultScore(stressRow(model, format), group))]);
}

/** How input tokens were counted. The schema allows only tokens as each model reported them. */
export function stressTokensNote(file: StressAccuracyFile): string {
  return `Input tokens are for all ${formatCount(file.questions)} questions, as each model reported them.`;
}

/**
 * Why two token columns in the headline table are the same: the two Claude models reported the
 * same input tokens. This file holds the totals per format, so the check is on those totals.
 * It throws unless exactly those two models match on every format.
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
