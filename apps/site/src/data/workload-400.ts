// The 400-question section of /workload. Every figure comes from real-400-accuracy-results.json,
// which `pnpm accuracy` builds from the published runs. No result is typed here. A claim the data
// no longer supports throws instead of printing, so the section cannot say more than the runs show.
// The schema file is imported for its type only, so zod stays out of the browser bundle.
import { formatCount } from './bench.ts';
import type { Real400AccuracyFile } from './real-400-accuracy-schema.ts';
import type { WorkloadLink } from './workload.ts';
import {
  NEAR_TIE,
  NO_ANSWER,
  WORKLOAD_DATASET_LABELS,
  WORKLOAD_FORMAT_LABELS,
  WORKLOAD_MODEL_NAMES,
  blob,
  listPhrase,
  lowestFormats,
  share,
  tersetSaving,
  word,
  workloadRow,
} from './workload.ts';

type Model = Real400AccuracyFile['models'][number];
type Format = Real400AccuracyFile['formats'][number];
type Kind = Model['wrongByKind'][number]['kind'];
type Pair = Model['paired'][number];
type Run = Real400AccuracyFile['publishedRuns'][number];

/** The size of the separate pilot. The test checks it against bench/data/real/suite-400/pilot.json. */
export const PILOT_QUESTIONS = 24;

/** The usual bar for a statistically significant gap: p under this. */
export const SIGNIFICANCE = 0.05;

export const REAL_400_KIND_LABELS: Readonly<Record<Kind, string>> = {
  'field-retrieval': 'Field retrieval',
  count: 'Count',
  extreme: 'Extreme',
  'nested-lookup': 'Nested lookup',
  'count-two-conditions': 'Count with two conditions',
  compare: 'Compare',
  position: 'Position',
  rank: 'Rank',
};

/** A format's name inside a sentence. */
const FORMAT_IN_TEXT: Readonly<Record<Format, string>> = {
  'json-compact': 'compact JSON',
  toon: 'TOON',
  terset: 'Terset',
};

const capitalize = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** The minus sign the tables use, so a negative reads the same as in the change column. */
function signed(value: number, digits: number, plus: boolean): string {
  const magnitude = Math.abs(value).toFixed(digits);
  if (Number(magnitude) === 0) return magnitude;
  if (value < 0) return `−${magnitude}`;
  return plus ? `+${magnitude}` : magnitude;
}

/** Up to two decimals, trailing zeros dropped: 0.5, 0.25, 1. Every gap of n questions in 400 fits. */
const shortNumber = (value: number): string => String(Number(value.toFixed(2)));

function modelKinds(file: Real400AccuracyFile): readonly Kind[] {
  const first = file.models[0];
  if (first === undefined) throw new Error('No model');
  return first.wrongByKind.map((entry) => entry.kind);
}

/** Questions per file, read from the per-file rows. Throws when the files differ. */
export function real400PerFile(file: Real400AccuracyFile): number {
  const totals = new Set(file.models.flatMap((model) => model.rows.filter((row) => row.dataset !== 'ALL').map((row) => row.total)));
  const [total] = totals;
  if (totals.size !== 1 || total === undefined) throw new Error('The files have different question counts');
  return total;
}

/** Questions of each kind in each file. Throws when the kinds do not split a file evenly. */
export function real400PerKind(file: Real400AccuracyFile): number {
  const perKind = real400PerFile(file) / modelKinds(file).length;
  if (!Number.isInteger(perKind)) throw new Error('The kinds do not split a file evenly');
  return perKind;
}

/** Throws unless every paired gap has p at or above the bar and an interval that includes zero. */
function checkNoSignificantGap(file: Real400AccuracyFile): void {
  for (const model of file.models) {
    for (const pair of model.paired) {
      const what = `${model.id} against ${pair.comparisonFormat}`;
      if (pair.pValue < SIGNIFICANCE) throw new Error(`${what} has p = ${pair.pValue}; the page says no gap is significant`);
      if (pair.interval95Points.lower > 0 || pair.interval95Points.upper < 0) throw new Error(`${what}: the 95% interval leaves out zero; the page says no gap is significant`);
    }
  }
}

/** The files where Terset is within NEAR_TIE of compact JSON on every model, with the formats that used the fewest tokens on every model. */
function nearTieLine(file: Real400AccuracyFile): string | undefined {
  const lines = file.datasets
    .filter((dataset) => file.models.every((model) => Math.abs(tersetSaving(model, dataset)) < NEAR_TIE))
    .map((dataset) => {
      const lowest = file.formats.filter((format) => file.models.every((model) => lowestFormats(model, dataset).includes(format)));
      const tail = lowest.length === 0 || lowest.includes('terset') ? '' : `, and ${listPhrase(lowest.map((format) => FORMAT_IN_TEXT[format]))} used the fewest`;
      return `On the ${WORKLOAD_DATASET_LABELS[dataset]}, Terset used about as many input tokens as compact JSON${tail}.`;
    });
  return lines.length === 0 ? undefined : `Per file it differs. ${lines.join(' ')}`;
}

/**
 * The section's lead, as measured: accuracy is level, no gap is significant, and Terset used fewer
 * input tokens on both files together. Throws when a gap is significant or Terset did not save tokens.
 */
export function real400Headline(file: Real400AccuracyFile): readonly string[] {
  checkNoSignificantGap(file);
  const counts = file.models.map((model) => {
    const parts = file.formats.map((format, index) => {
      const correct = formatCount(workloadRow(model, 'ALL', format).correct);
      return index === 0 ? `${correct} of ${formatCount(file.questions)} right in ${FORMAT_IN_TEXT[format]}` : `${correct} in ${FORMAT_IN_TEXT[format]}`;
    });
    return `${WORKLOAD_MODEL_NAMES[model.id]} got ${listPhrase(parts)}.`;
  });
  const savings = file.models.map((model, index) => {
    const saving = tersetSaving(model, 'ALL');
    if (saving <= 0) throw new Error(`Terset did not use fewer input tokens on ${model.id}; the section says it did`);
    const name = WORKLOAD_MODEL_NAMES[model.id];
    return index === 0 ? `${share(saving)} fewer input tokens than compact JSON on ${name}` : `${share(saving)} fewer on ${name}`;
  });
  const perFile = nearTieLine(file);
  return [
    'Accuracy was level across the three formats. No gap between them is statistically significant.',
    ...counts,
    `Both files together, Terset used ${listPhrase(savings)}.`,
    ...(perFile === undefined ? [] : [perFile]),
  ];
}

/** How the 400 questions were made and run, in short lines. Each states only what bench/data/real/README.md supports. */
export function real400Intro(file: Real400AccuracyFile): readonly string[] {
  const kinds = modelKinds(file);
  return [
    `The same two files, asked ${formatCount(file.questions)} new questions: ${formatCount(real400PerFile(file))} per file, ${formatCount(real400PerKind(file))} of each of ${word(kinds.length)} kinds.`,
    `The kinds are ${listPhrase(kinds.map((kind) => REAL_400_KIND_LABELS[kind].toLowerCase()))}.`,
    'Code wrote the questions and computed each answer from the data. They were frozen before any model call. None was removed after.',
    `A separate pilot of ${formatCount(PILOT_QUESTIONS)} questions ran first. It changed no question, and its scores are not in these tables.`,
    `The output limit was ${formatCount(file.perCallMaxOutputTokens)} tokens per call, the same in every format.`,
    'Each model answered every question in each format, with the whole file in the prompt. These runs used Terset 1.1. Code scored every answer. No model judged them.',
  ];
}

export const PAIRED_HEAD = ['Model', 'Terset against', 'Only Terset right', 'Only the other right', 'Gap, points', '95% interval, points', 'Exact p'] as const;

export interface PairedRow {
  readonly comparison: string;
  readonly tersetOnly: string;
  readonly otherOnly: string;
  readonly gap: string;
  readonly interval: string;
  readonly p: string;
}

export interface PairedGroup {
  readonly id: Model['id'];
  readonly model: string;
  readonly rows: readonly PairedRow[];
}

/** The test cells of a paired row: the signed gap, its 95% interval and the exact p. Shared with the weather 1.2 table. */
export function pairedTestCells(pair: Pick<Pair, 'gapPoints' | 'interval95Points' | 'pValue'>): Pick<PairedRow, 'gap' | 'interval' | 'p'> {
  const gap = Number(pair.gapPoints.toFixed(2)) === 0 ? '0' : `${pair.gapPoints < 0 ? '−' : '+'}${shortNumber(Math.abs(pair.gapPoints))}`;
  return {
    gap,
    interval: `${signed(pair.interval95Points.lower, 1, false)} to ${signed(pair.interval95Points.upper, 1, false)}`,
    p: pair.pValue < 0.001 ? '< 0.001' : String(Number(pair.pValue.toFixed(3))),
  };
}

function pairedRow(pair: Pair): PairedRow {
  return {
    comparison: WORKLOAD_FORMAT_LABELS[pair.comparisonFormat],
    tersetOnly: formatCount(pair.tersetOnly),
    otherOnly: formatCount(pair.otherOnly),
    ...pairedTestCells(pair),
  };
}

/** Per model, Terset against each other format on the same questions. */
export function pairedGroups(file: Real400AccuracyFile): readonly PairedGroup[] {
  return file.models.map((model) => ({ id: model.id, model: WORKLOAD_MODEL_NAMES[model.id], rows: model.paired.map(pairedRow) }));
}

/** How to read the paired table. Throws when a gap is significant, since the last line says none is. */
export function pairedReading(file: Real400AccuracyFile): readonly string[] {
  checkNoSignificantGap(file);
  return [
    'This compares answers to the same question asked in two formats. It counts only the questions one format got right and the other got wrong.',
    'The gap is Terset\'s share of right answers minus the other format\'s, in percentage points.',
    `The exact McNemar test gives p. A gap counts as statistically significant when p is under ${String(SIGNIFICANCE)}. No p here is under it, and every 95% interval includes zero.`,
  ];
}

/** The head of a wrong-answers-by-kind table. */
export function kindHead(file: Real400AccuracyFile): readonly string[] {
  return ['Question kind', ...file.formats.map((format) => WORKLOAD_FORMAT_LABELS[format])];
}

export interface KindRow {
  readonly kind: Kind;
  readonly label: string;
  readonly cells: readonly string[];
}

export interface KindTable {
  readonly rows: readonly KindRow[];
  readonly total: readonly string[];
}

/** One model's wrong answers by question kind and format, with a total per format. Throws when a total does not match the score. */
export function kindTable(file: Real400AccuracyFile, model: Model): KindTable {
  const rows = model.wrongByKind.map((entry) => ({
    kind: entry.kind,
    label: REAL_400_KIND_LABELS[entry.kind],
    cells: file.formats.map((format) => formatCount(entry.counts[format])),
  }));
  const total = file.formats.map((format) => {
    const sum = model.wrongByKind.reduce((acc, entry) => acc + entry.counts[format], 0);
    const row = workloadRow(model, 'ALL', format);
    if (sum !== row.total - row.correct) throw new Error(`${model.id} ${format}: wrong answers by kind add to ${sum}, the score says ${row.total - row.correct}`);
    return formatCount(sum);
  });
  return { rows, total };
}

export const WRONG_400_HEAD = ['Format', 'File', 'Kind', 'Question', 'Expected', 'Model said'] as const;

export type Wrong400Row = readonly [format: string, dataset: string, kind: string, question: string, expected: string, said: string];

export interface Wrong400Group {
  readonly id: Model['id'];
  readonly model: string;
  readonly rows: readonly Wrong400Row[];
}

/** Every wrong answer, under its model, in the order of the data. */
export function wrong400Groups(file: Real400AccuracyFile): readonly Wrong400Group[] {
  return file.models.map((model) => ({
    id: model.id,
    model: WORKLOAD_MODEL_NAMES[model.id],
    rows: file.wrongAnswers
      .filter((answer) => answer.model === model.id)
      .map((answer) => [
        WORKLOAD_FORMAT_LABELS[answer.format],
        WORKLOAD_DATASET_LABELS[answer.dataset],
        REAL_400_KIND_LABELS[answer.kind],
        `${answer.questionId}: ${answer.prompt}`,
        answer.expected,
        answer.hitOutputCap ? NO_ANSWER : answer.text,
      ] as const),
  }));
}

/** "36 wrong of 2,400 answers: 4 on one model and 32 on the other." */
export function real400WrongSummary(file: Real400AccuracyFile): string {
  const answers = file.questions * file.formats.length * file.models.length;
  const perModel = wrong400Groups(file).map((group) => `${formatCount(group.rows.length)} on ${group.model}`);
  return `${formatCount(file.wrongAnswers.length)} wrong of ${formatCount(answers)} answers: ${listPhrase(perModel)}.`;
}

/**
 * The scorer compares the whole answer, so an answer that shows working before the right value is wrong.
 * This names each such answer, so a reader can judge the strict score. Null when there is none.
 */
export function real400StrictNote(file: Real400AccuracyFile): string | null {
  const near = file.wrongAnswers
    .filter((answer) => answer.text.trim().split('\n').at(-1)?.trim().toLowerCase() === answer.expected.toLowerCase())
    .map((answer) => `${WORKLOAD_MODEL_NAMES[answer.model]}, ${WORKLOAD_FORMAT_LABELS[answer.format]}, ${answer.questionId}`);
  if (near.length === 0) return null;
  const count = near.length === 1 ? 'One wrong answer' : `${capitalize(word(near.length))} wrong answers`;
  const stays = near.length === 1 ? 'It stays' : 'They stay';
  return `Scoring is strict: the answer must be the value alone. ${count} ended with the expected value after other text: ${near.join('; ')}. ${stays} counted as wrong.`;
}

/**
 * What happened during the runs. A run with a kept charge was stopped by a time limit and resumed,
 * as bench/README.md records. Throws when that run did not answer every question in each format.
 */
export function real400RunNotes(file: Real400AccuracyFile): readonly string[] {
  const resumed = file.publishedRuns
    .filter((run) => run.retainedCharges > 0)
    .map((run) => {
      const model = file.models.find((item) => item.id === run.model);
      if (model === undefined || file.formats.some((format) => workloadRow(model, 'ALL', format).total !== file.questions)) {
        throw new Error(`${run.runId} did not answer every question in each format`);
      }
      const calls = run.retainedCharges === 1 ? 'One interrupted call stays' : `${capitalize(word(run.retainedCharges))} interrupted calls stay`;
      return `A time limit stopped the full ${WORKLOAD_MODEL_NAMES[run.model]} run once. It resumed with the same run id and answered all ${formatCount(file.questions)} questions in each format. ${calls} in the run's budget ledger as a charge. The retry gave the scored answer.`;
    });
  return [
    ...resumed,
    `One run per model, ${word(file.publishedRuns.length)} runs in all, so there is no estimate of run to run variance.`,
    'The pilot runs are linked below for reference. Their scores are not in these tables.',
  ];
}

function runLinks(runs: readonly Run[], what: 'run' | 'pilot'): readonly WorkloadLink[] {
  return runs.flatMap((run) => {
    const name = WORKLOAD_MODEL_NAMES[run.model];
    return [
      { label: `${name} ${what}, every answer (${run.runId}.json)`, href: blob(`${run.publishedPath}/${run.runId}.json`) },
      { label: `${name} ${what}, report (${run.runId}.md)`, href: blob(`${run.publishedPath}/${run.runId}.md`) },
    ];
  });
}

/** The raw files of each full run, then each pilot run, then the frozen questions and their freeze record, on the main branch. */
export function real400Links(file: Real400AccuracyFile): readonly WorkloadLink[] {
  return [
    ...runLinks(file.publishedRuns, 'run'),
    ...runLinks(file.pilotRuns, 'pilot'),
    { label: `The ${formatCount(file.questions)} frozen questions and answers (questions.json)`, href: blob('bench/data/real/suite-400/questions.json') },
    { label: `The ${formatCount(PILOT_QUESTIONS)} pilot questions (pilot.json)`, href: blob('bench/data/real/suite-400/pilot.json') },
    { label: 'Sources, hashes and the question freeze (README.md)', href: blob('bench/data/real/README.md') },
  ];
}
