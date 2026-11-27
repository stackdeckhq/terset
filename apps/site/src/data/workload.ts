// The /workload page: answer accuracy and whole-prompt input tokens on two real files.
// Every figure comes from real-accuracy-results.json, which scripts/accuracy-real.ts
// builds from the published runs. No number is typed here. A claim the data no longer supports
// throws instead of printing, so the page cannot say more than the runs show.
import { formatCount } from './bench.ts';
import { realChange } from './real.ts';
import type { RealAccuracyFile } from './real-accuracy-schema.ts';
import { REPO_URL } from './site.ts';

type Model = RealAccuracyFile['models'][number];
type Row = Model['rows'][number];
type ModelId = Model['id'];
type Format = Row['format'];
type Dataset = RealAccuracyFile['datasets'][number];
type RowDataset = Row['dataset'];
type WrongAnswer = RealAccuracyFile['wrongAnswers'][number];

export const WORKLOAD_MODEL_NAMES: Readonly<Record<ModelId, string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'gpt-6.2-sol': 'GPT 6.2 Sol',
};

export const WORKLOAD_FORMAT_LABELS: Readonly<Record<Format, string>> = {
  'json-compact': 'Compact JSON',
  toon: 'TOON',
  terset: 'Terset',
};

export const WORKLOAD_DATASET_LABELS: Readonly<Record<RowDataset, string>> = {
  'usgs-earthquakes': 'USGS earthquakes',
  'nws-gridpoint': 'NWS forecast grid',
  ALL: 'Both files',
};

/** The base every change is measured from. */
const BASE: Format = 'json-compact';

/** Below this share, a saving is too small to call one. */
const NEAR_TIE = 0.01;

/** The most correct answers two formats may differ by while the page calls accuracy level. */
const LEVEL_SPREAD = 1;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;
const word = (value: number): string => WORDS[value] ?? formatCount(value);

/** "a", "a and b", "a, b and c". */
function listPhrase(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

export function workloadRow(model: Model, dataset: RowDataset, format: Format): Row {
  const row = model.rows.find((item) => item.dataset === dataset && item.format === format);
  if (row === undefined) throw new Error(`${model.id} has no ${format} row for ${dataset}`);
  return row;
}

/** The share of compact JSON's input tokens Terset saved: 1 − terset / compact JSON. Negative when Terset used more. */
export function tersetSaving(model: Model, dataset: RowDataset): number {
  return 1 - workloadRow(model, dataset, 'terset').inputTokens / workloadRow(model, dataset, BASE).inputTokens;
}

export function share(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** The fewest and most correct answers any format had over all questions, on any model. */
export function correctRange(file: RealAccuracyFile): { readonly min: number; readonly max: number } {
  const counts = file.models.flatMap((model) => model.rows.filter((row) => row.dataset === 'ALL').map((row) => row.correct));
  return { min: Math.min(...counts), max: Math.max(...counts) };
}

/** "39 or 40 of 40", or "40 of 40" when every format scored the same. */
function rangePhrase(file: RealAccuracyFile): string {
  const { min, max } = correctRange(file);
  const total = formatCount(file.questions);
  if (min === max) return `${formatCount(min)} of ${total}`;
  if (max - min === 1) return `${formatCount(min)} or ${formatCount(max)} of ${total}`;
  return `${formatCount(min)} to ${formatCount(max)} of ${total}`;
}

/**
 * The page's lead, as measured: accuracy is level and Terset used fewer input tokens.
 * Throws when the formats are more than one answer apart, or when Terset did not use fewer tokens on a model.
 */
export function workloadHeadline(file: RealAccuracyFile): readonly string[] {
  const { min, max } = correctRange(file);
  if (max - min > LEVEL_SPREAD) throw new Error(`Accuracy spread is ${String(max - min)} answers; the headline says accuracy is level`);
  const savings = file.models.map((model) => {
    const saving = tersetSaving(model, 'ALL');
    if (saving <= 0) throw new Error(`Terset did not use fewer input tokens on ${model.id}; the headline says it did`);
    return `${share(saving)} fewer on ${WORKLOAD_MODEL_NAMES[model.id]}`;
  });
  return [
    `Accuracy was level. Every format got ${rangePhrase(file)} questions right on each model.`,
    `Terset used fewer whole-prompt input tokens overall: ${listPhrase(savings)}, against compact JSON.`,
    `A sample of ${formatCount(file.questions)} questions is too small to show a difference in accuracy between formats.`,
  ];
}

/** "33.9% fewer", "6.7% more", "200 fewer tokens" or "as many", against compact JSON. */
function changeWords(value: number, base: number): string {
  const diff = value - base;
  if (diff === 0) return 'as many';
  const more = diff > 0 ? 'more' : 'fewer';
  const change = Math.abs(Math.round((diff / base) * 1000) / 10);
  if (change === 0) return `${formatCount(Math.abs(diff))} ${more} ${Math.abs(diff) === 1 ? 'token' : 'tokens'}`;
  return `${change.toFixed(1)}% ${more}`;
}

/** Each model's change for one format on one file, joined: "33.9% fewer on Claude Opus 5.5 and 30.4% fewer on GPT 6.2 Sol". */
function perModel(file: RealAccuracyFile, dataset: Dataset, format: Format): string {
  return listPhrase(file.models.map((model) => `${changeWords(workloadRow(model, dataset, format).inputTokens, workloadRow(model, dataset, BASE).inputTokens)} on ${WORKLOAD_MODEL_NAMES[model.id]}`));
}

/** The format or formats with the fewest input tokens for one model on one file. */
export function lowestFormats(model: Model, dataset: RowDataset): readonly Format[] {
  const rows = model.rows.filter((row) => row.dataset === dataset);
  const fewest = Math.min(...rows.map((row) => row.inputTokens));
  return rows.filter((row) => row.inputTokens === fewest).map((row) => row.format);
}

function lowestPhrase(file: RealAccuracyFile, dataset: Dataset): string {
  const names = file.models.map((model) => listPhrase(lowestFormats(model, dataset).map((format) => WORKLOAD_FORMAT_LABELS[format])));
  if (names.every((name) => name === names[0])) return `${names[0] ?? ''} used the fewest input tokens on both models.`;
  return `The fewest input tokens: ${listPhrase(file.models.map((model, index) => `${names[index] ?? ''} on ${WORKLOAD_MODEL_NAMES[model.id]}`))}.`;
}

export interface FileResult {
  readonly dataset: Dataset;
  readonly label: string;
  readonly lines: readonly string[];
}

/**
 * Per file, wins and losses alike: which format used the fewest input tokens, then Terset
 * and every other format against compact JSON on each model. A near tie says so in words.
 */
export function fileResults(file: RealAccuracyFile): readonly FileResult[] {
  return file.datasets.map((dataset) => {
    const others = file.formats.filter((format) => format !== BASE && format !== 'terset');
    const nearTie = file.models.every((model) => Math.abs(tersetSaving(model, dataset)) < NEAR_TIE);
    const lines = [
      lowestPhrase(file, dataset),
      `Against compact JSON, Terset used ${perModel(file, dataset, 'terset')}.`,
      ...(nearTie ? [`So on this file Terset saves under ${share(NEAR_TIE)} against compact JSON on both models.`] : []),
      ...others.map((format) => `${WORKLOAD_FORMAT_LABELS[format]} used ${perModel(file, dataset, format)}.`),
    ];
    return { dataset, label: WORKLOAD_DATASET_LABELS[dataset], lines };
  });
}

/** The table head for one model's table. */
export const WORKLOAD_TABLE_HEAD = ['File', 'Format', 'Correct', 'Input tokens', 'vs compact JSON'] as const;

export interface WorkloadCell {
  readonly format: Format;
  readonly label: string;
  readonly correct: string;
  readonly inputTokens: string;
  readonly change: string;
  /** True for the fewest input tokens in this file group, ties included. */
  readonly lowest: boolean;
}

export interface WorkloadGroup {
  readonly dataset: RowDataset;
  readonly label: string;
  readonly rows: readonly WorkloadCell[];
}

/** Compact JSON's own cell in the change column: the reference every other row is set against. */
export const BASE_REFERENCE = '-';

/** One model's table: one group per file, then both files together, each in format order. */
export function workloadGroups(file: RealAccuracyFile, model: Model): readonly WorkloadGroup[] {
  const datasets: readonly RowDataset[] = [...file.datasets, 'ALL'];
  return datasets.map((dataset) => {
    const base = workloadRow(model, dataset, BASE);
    const lowest = lowestFormats(model, dataset);
    return {
      dataset,
      label: WORKLOAD_DATASET_LABELS[dataset],
      rows: file.formats.map((format) => {
        const row = workloadRow(model, dataset, format);
        return {
          format,
          label: WORKLOAD_FORMAT_LABELS[format],
          correct: `${formatCount(row.correct)} of ${formatCount(row.total)}`,
          inputTokens: formatCount(row.inputTokens),
          change: format === BASE ? BASE_REFERENCE : realChange(row.inputTokens, base.inputTokens),
          lowest: lowest.includes(format),
        };
      }),
    };
  });
}

export const WRONG_ANSWERS_HEAD = ['Model', 'Format', 'File', 'Question', 'Expected', 'Model said'] as const;

/** What the "Model said" cell shows for an answer cut off by the output limit. */
export const NO_ANSWER = 'No answer (output limit)';

export type WrongAnswerRow = readonly [model: string, format: string, dataset: string, question: string, expected: string, said: string];

export function wrongAnswerRows(file: RealAccuracyFile): readonly WrongAnswerRow[] {
  return file.wrongAnswers.map((answer) => [
    WORKLOAD_MODEL_NAMES[answer.model],
    WORKLOAD_FORMAT_LABELS[answer.format],
    WORKLOAD_DATASET_LABELS[answer.dataset],
    `${answer.questionId}: ${answer.prompt}`,
    answer.expected,
    answer.hitOutputCap ? NO_ANSWER : answer.text,
  ]);
}

/** "in all three formats", or the formats by name when only some hit the limit. */
function formatsPhrase(file: RealAccuracyFile, formats: readonly Format[]): string {
  if (formats.length === file.formats.length) return `in all ${word(formats.length)} formats`;
  return `in ${listPhrase(file.formats.filter((format) => formats.includes(format)).map((format) => WORKLOAD_FORMAT_LABELS[format]))}`;
}

/**
 * One note per model and question where the answer hit the output limit, then why it was not rerun.
 * Empty when no answer hit the limit.
 */
export function outputCapNotes(file: RealAccuracyFile): readonly string[] {
  const groups = new Map<string, { readonly answer: WrongAnswer; readonly formats: Format[] }>();
  for (const answer of file.wrongAnswers.filter((item) => item.hitOutputCap)) {
    const key = `${answer.model}\u0000${answer.questionId}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { answer, formats: [answer.format] });
    else group.formats.push(answer.format);
  }
  if (groups.size === 0) return [];
  const limit = formatCount(file.perCallMaxOutputTokens);
  const notes = [...groups.values()].map(({ answer, formats }) => {
    const times = formats.length === 1 ? 'It' : 'Each time it';
    return `${WORKLOAD_MODEL_NAMES[answer.model]} returned no answer to ${answer.questionId} ${formatsPhrase(file, formats)}. ${times} used the whole output limit of ${limit} tokens before it wrote one. The limit is the same in every format.`;
  });
  return [...notes, 'We did not rerun with a higher limit, because that would change the method after seeing the results.'];
}

export interface WorkloadLink {
  readonly label: string;
  readonly href: string;
}

const blob = (path: string): string => `${REPO_URL}/blob/main/${path}`;

/** The raw run files of each model, then the frozen questions and their freeze record, on the main branch. */
export function workloadLinks(file: RealAccuracyFile): readonly WorkloadLink[] {
  const runs = file.publishedRuns.flatMap((run) => {
    const name = WORKLOAD_MODEL_NAMES[run.model];
    return [
      { label: `${name} run, every answer (${run.runId}.json)`, href: blob(`${run.publishedPath}/${run.runId}.json`) },
      { label: `${name} run, report (${run.runId}.md)`, href: blob(`${run.publishedPath}/${run.runId}.md`) },
    ];
  });
  return [
    ...runs,
    { label: 'The frozen questions and answers (questions.json)', href: blob('bench/data/real/suite/questions.json') },
    { label: 'Sources, hashes and the question freeze (README.md)', href: blob('bench/data/real/README.md') },
  ];
}

export interface WorkloadPrice {
  readonly model: string;
  readonly line: string;
  readonly sourceUrl: string;
}

/** The list price each run used, with the date it was read. */
export function workloadPrices(file: RealAccuracyFile): readonly WorkloadPrice[] {
  return file.publishedRuns.map((run) => ({
    model: WORKLOAD_MODEL_NAMES[run.model],
    line: `$${String(run.price.inputPerMillion)} per million input tokens and $${String(run.price.outputPerMillion)} per million output tokens, read on ${run.price.dateRead}.`,
    sourceUrl: run.price.sourceUrl,
  }));
}

/** The method in short lines. Each states only what bench/README.md and bench/data/real/README.md support. */
export function workloadMethod(file: RealAccuracyFile, frozenOn: string): readonly string[] {
  const perFile = file.models[0]?.rows.find((row) => row.dataset === file.datasets[0])?.total;
  if (perFile === undefined) throw new Error('No per-file question count');
  const runs = file.publishedRuns.length;
  return [
    `Both files were fetched and frozen byte for byte on ${frozenOn}, before any token count.`,
    `Code wrote the ${formatCount(file.questions)} questions, ${formatCount(perFile)} per file, and computed each answer from the data. They were frozen before any model call. None was removed after.`,
    `Each question went once to each model in each format, with the whole file in the prompt, at temperature zero.`,
    'Code scored every answer against the expected answer. No model judged them.',
    `One run per model, ${word(runs)} runs in all, so there is no estimate of run to run variance.`,
    'Input tokens are what each API reported for the whole prompt: the instructions, the format notes, the file and the question.',
  ];
}
