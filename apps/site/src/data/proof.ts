// The figures behind the charts on the home page and /benchmark: cost bars per model,
// three big numbers, Terset against TOON and compact JSON on every benchmark data set,
// and the count of data sets where Terset is smaller than TOON.
// Every figure comes from accuracy-results.json and bench-results.json. Each claim is
// checked against the data when it is built, and a claim the data no longer supports throws.
import { ACCURACY_FORMATS } from './accuracy-ids.ts';
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel } from './accuracy-schema.ts';
import { FORMAT_LABELS, KIND_LABELS, countWord, formatMean, formatRow, inputTokensLine, percent, rowRunOn, shortModelName, usd } from './accuracy.ts';
import { benchHeadline, formatCount, underJson, underToon } from './bench.ts';
import type { BenchFile } from './bench.ts';
import type { CounterId, Counters } from './numbers.ts';

/** The tokenizer behind each model's input tokens. */
const MODEL_TOKENIZERS: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Claude tokenizer',
  'gpt-6.1-sol': 'OpenAI tokenizer',
};

export const OPENAI_TOKENIZER = 'OpenAI tokenizer';

export function modelTokenizer(model: AccuracyModel): string {
  const name = MODEL_TOKENIZERS[model.id];
  if (name === undefined) throw new Error(`No tokenizer is named for ${model.id}`);
  return name;
}

function assertClaim(holds: boolean, claim: string): void {
  if (!holds) throw new Error(`The chart copy says "${claim}", and the data no longer supports it`);
}

/** The share of `base` that `value` saves: 0.315 for 31.5% fewer. */
function saving(value: number, base: number): number {
  return 1 - value / base;
}

// Cost bars

export interface CostBar {
  readonly format: AccuracyFormat;
  readonly label: string;
  readonly cost: number;
  readonly costText: string;
  /** The bar's length against the most expensive format for this model, 0 to 1. Bars start at zero. */
  readonly fraction: number;
  /**
   * Where the cost comes from, one short line each so it fits beside the bar:
   * ["run 2026-11-17"] for a single run, or ["mean of 3 runs", "2026-11-17"].
   */
  readonly runs: readonly string[];
  readonly terset: boolean;
  /** The lowest cost for this model. Its number is bold, whichever format it is. */
  readonly cheapest: boolean;
}

/** Cost at API list price of each format for one model, Terset first. */
export function costBars(model: AccuracyModel): readonly CostBar[] {
  const max = Math.max(...model.rows.map((row) => row.totalCost));
  const min = Math.min(...model.rows.map((row) => row.totalCost));
  return ACCURACY_FORMATS.map((format) => {
    const row = formatRow(model, format);
    const runs = row.runs.length === 1 ? [`run ${rowRunOn(row)}`] : [`mean of ${String(row.runs.length)} runs`, rowRunOn(row)];
    return { format, label: FORMAT_LABELS[format], cost: row.totalCost, costText: usd(row.totalCost), fraction: row.totalCost / max, runs, terset: format === 'terset', cheapest: row.totalCost === min };
  });
}

/** One line under the cost bars, on how the cost is made. */
export function costNote(file: AccuracyFile): string {
  const reads = [...new Set(file.models.map((model) => model.priceReadOn))].join(' and ');
  return `Cost for all ${formatCount(file.questions)} questions at API list price: input and output tokens times list prices read on ${reads}.`;
}

// Big numbers

export interface BigValue {
  readonly model: string;
  /** The whole value as plain text, such as "31.5%" or "243/244". */
  readonly text: string;
  /** Presentation only: the part of `text` printed large, such as "31.5%" or "243". */
  readonly figure: string;
  /** Presentation only: the rest of `text`, printed small and quiet, such as "/244". Empty when there is none. */
  readonly tail: string;
}

export interface BigNumber {
  readonly id: 'tokens' | 'cost' | 'answers';
  readonly values: readonly BigValue[];
  readonly label: string;
  /** True when the number is a Terset win, shown in the accent. A tie stays plain. */
  readonly win: boolean;
}

/** The heading over the big numbers: "Fewer tokens on the 244-question test". */
export function proofHeading(file: AccuracyFile): string {
  return `Fewer tokens on the ${formatCount(file.questions)}-question test`;
}

/** The lowest and highest right answers of any format on one model, each a mean of that format's runs. */
function answerRange(model: AccuracyModel): string {
  const scores = model.rows.map((row) => row.correct);
  const lowest = Math.min(...scores);
  const highest = Math.max(...scores);
  return lowest === highest ? formatMean(lowest) : `${formatMean(lowest)} to ${formatMean(highest)}`;
}

/**
 * Three big numbers: fewer input tokens and lower cost than compact JSON, and the range of right
 * answers across every format. The range shows that no format stands apart, not a Terset win.
 */
export function bigNumbers(file: AccuracyFile): readonly BigNumber[] {
  assertClaim(file.models.every((model) => formatRow(model, 'terset').inputTokens < formatRow(model, 'json-compact').inputTokens), 'fewer input tokens than compact JSON');
  assertClaim(file.models.every((model) => formatRow(model, 'terset').totalCost < formatRow(model, 'json-compact').totalCost), 'cheaper than compact JSON');
  assertClaim(file.models.every((model) => model.rows.length === ACCURACY_FORMATS.length), 'the answers card covers every format');
  const per = (parts: (model: AccuracyModel) => readonly [figure: string, tail: string]): readonly BigValue[] =>
    file.models.map((model) => {
      const [figure, tail] = parts(model);
      return { model: shortModelName(model), text: `${figure}${tail}`, figure, tail };
    });
  const runs = [...new Set(file.models.flatMap((model) => model.rows.map((row) => row.runs.length)))];
  const formats = `all ${countWord(ACCURACY_FORMATS.length)} formats`;
  const answers = runs.length === 1 && runs[0] === 1 ? `right answers across ${formats}` : runs.length === 1 ? `right answers across ${formats}, each a mean of ${String(runs[0])} runs` : `right answers across ${formats}, each a mean of its runs`;
  return [
    { id: 'tokens', values: per((model) => [percent(saving(formatRow(model, 'terset').inputTokens, formatRow(model, 'json-compact').inputTokens)), '']), label: 'fewer input tokens than compact JSON', win: true },
    { id: 'cost', values: per((model) => [percent(saving(formatRow(model, 'terset').totalCost, formatRow(model, 'json-compact').totalCost)), '']), label: 'lower cost than compact JSON', win: true },
    { id: 'answers', values: per((model) => [answerRange(model), ` of ${formatCount(file.questions)}`]), label: answers, win: false },
  ];
}

/** Which tokenizer the token numbers use, in one line. */
export function bigNumbersNote(file: AccuracyFile): string {
  return `Input tokens: ${file.models.map((model) => `${model.name} on the ${modelTokenizer(model)}`).join(', ')}. ${inputTokensLine(file)}`;
}

// Data sets

/** Within half a percent, Terset and the other format count as a tie. */
export const TIE_SHARE = 0.005;

/** The line under the data set chart. */
export const DATASET_NOTE = `Input tokens per data set, counted the same way as the tables. JSON here is compact JSON. Left of zero, Terset used fewer. Within ${String(TIE_SHARE * 100)}% counts as a tie.`;

export type Verdict = 'fewer' | 'tie' | 'more';

export interface Comparison {
  /** Terset's tokens against the base as a signed share: −0.399 for 39.9% fewer. */
  readonly change: number;
  readonly verdict: Verdict;
  /** "−39.9%", "+4.6%" or "Tie". */
  readonly text: string;
}

export function compare(terset: number, base: number): Comparison {
  const change = terset / base - 1;
  if (Math.abs(change) < TIE_SHARE) return { change, verdict: 'tie', text: 'Tie' };
  const text = `${change > 0 ? '+' : '−'}${(Math.abs(change) * 100).toFixed(1)}%`;
  return { change, verdict: change < 0 ? 'fewer' : 'more', text };
}

export interface DatasetRow {
  readonly kind: AccuracyKindId;
  readonly label: string;
  readonly questions: number;
  readonly terset: number;
  readonly toon: number;
  readonly json: number;
  readonly vsToon: Comparison;
  readonly vsJson: Comparison;
}

function kindTokens(item: AccuracyKind, model: AccuracyModel): AccuracyKind['models'][number]['inputTokens'] {
  const found = item.models.find((entry) => entry.id === model.id);
  if (found === undefined) throw new Error(`${model.name} has no tokens for ${item.kind}`);
  return found.inputTokens;
}

/** Terset against TOON and compact JSON on every data set, for one model. */
export function datasetRows(file: AccuracyFile, model: AccuracyModel): readonly DatasetRow[] {
  return file.kinds.map((item) => {
    const tokens = kindTokens(item, model);
    return {
      kind: item.kind,
      label: KIND_LABELS[item.kind].label,
      questions: item.questions,
      terset: tokens.terset,
      toon: tokens.toon,
      json: tokens['json-compact'],
      vsToon: compare(tokens.terset, tokens.toon),
      vsJson: compare(tokens.terset, tokens['json-compact']),
    };
  });
}

/** How many rows fall under each verdict. */
function tally(rows: readonly DatasetRow[], pick: (row: DatasetRow) => Comparison): Readonly<Record<Verdict, number>> {
  const count = (verdict: Verdict): number => rows.filter((row) => pick(row).verdict === verdict).length;
  return { fewer: count('fewer'), tie: count('tie'), more: count('more') };
}

function againstPhrase(counts: Readonly<Record<Verdict, number>>, total: number, base: string): string {
  const extra = [counts.tie > 0 ? `${String(counts.tie)} tie` : '', counts.more > 0 ? `${String(counts.more)} more` : ''].filter(Boolean).join(', ');
  return `than ${base} on ${String(counts.fewer)} of ${String(total)}${extra === '' ? '' : ` (${extra})`}.`;
}

/** One short line per model: "Fewer tokens than TOON on 12 of 13 (1 tie). Fewer than compact JSON on 12 of 13 (1 more)." */
export function datasetSummary(rows: readonly DatasetRow[]): string {
  const toon = againstPhrase(tally(rows, (row) => row.vsToon), rows.length, 'TOON');
  const json = againstPhrase(tally(rows, (row) => row.vsJson), rows.length, 'compact JSON');
  return `Fewer tokens ${toon} Fewer ${json}`;
}

/**
 * The data set fold's summary: what the fold holds, then the result in one line. Models with
 * the same result share it; otherwise each model gets its own.
 */
export function datasetFoldAbout(file: AccuracyFile): string {
  const results = file.models.map((model) => ({ model, rows: datasetRows(file, model) }));
  const sets = [...new Set(results.map(({ rows }) => rows.length))];
  if (sets.length !== 1) throw new Error('Expected the same data sets on every model');
  const lines = results.map(({ rows }) => datasetSummary(rows));
  const [first] = lines;
  if (first === undefined) throw new Error('Expected a model');
  const what = `Input tokens on each of the ${String(sets[0])} data sets, per model, against compact JSON and TOON.`;
  if (lines.length > 1 && lines.every((line) => line === first)) return `${what} ${lines.length === 2 ? 'Both models' : 'Every model'}: ${first}`;
  return `${what} ${results.map(({ model }, index) => `${shortModelName(model)}: ${lines[index] ?? ''}`).join(' ')}`;
}

/** The largest saving and the largest loss across every model and both bases, as positive shares. They set the chart's shared scale. */
export function datasetScale(file: AccuracyFile): { readonly save: number; readonly lose: number } {
  const changes = file.models.flatMap((model) => datasetRows(file, model).flatMap((row) => [row.vsToon.change, row.vsJson.change]));
  const step = 0.05;
  const up = (value: number): number => Math.max(step, Math.ceil(value / step - 1e-9) * step);
  return { save: up(Math.max(0, ...changes.map((change) => -change))), lose: up(Math.max(0, ...changes)) };
}

/** The chart claims as plain lines for /benchmark.md, each naming its tokenizer. */
export function proofLines(file: AccuracyFile, counters: Counters | null): readonly string[] {
  const [tokens, cost] = bigNumbers(file);
  if (tokens === undefined || cost === undefined) throw new Error('Expected the token and cost numbers');
  const line = (item: BigNumber): string => `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)}: ${item.values.map((value) => `${value.text} on ${value.model}`).join(' and ')}.`;
  const toon = smallerThanToon(file, counters);
  return [
    `${line(tokens)} Each model counts with its own tokenizer.`,
    // The overlap line follows these lines in /benchmark.md, as it follows the cards on the page.
    line(cost),
    ...(toon === null ? [] : [smallerThanToonLine(toon)]),
    ...file.models.map((model) => `${model.name} (${modelTokenizer(model)}): ${datasetSummary(datasetRows(file, model))}`),
  ];
}

// Smaller than TOON

export interface ToonCount {
  readonly smaller: number;
  readonly total: number;
  readonly text: string;
  readonly tokenizer: string;
  readonly note: string;
}

/**
 * Data sets where Terset is smaller than TOON on the OpenAI tokenizer: the sample cases on
 * o200k_base, plus every benchmark data set as the OpenAI model reported it.
 */
export function smallerThanToon(file: AccuracyFile, counters: Counters | null): ToonCount | null {
  if (counters === null) return null;
  const openai = file.models.filter((model) => modelTokenizer(model) === OPENAI_TOKENIZER);
  const model = openai[0];
  if (model === undefined || openai.length > 1) throw new Error('Expected one model on the OpenAI tokenizer');
  const cases = counters.o200k.cases;
  const rows = datasetRows(file, model);
  const smaller = cases.filter((row) => row.terset < row.toon).length + rows.filter((row) => row.terset < row.toon).length;
  const total = cases.length + rows.length;
  return {
    smaller,
    total,
    text: `Smaller than TOON on ${String(smaller)} of ${String(total)} data sets`,
    tokenizer: OPENAI_TOKENIZER,
    note: `The ${String(cases.length)} sample cases on o200k_base and the ${String(rows.length)} benchmark data sets as ${model.name} reported them.`,
  };
}

/** The count with its tokenizer and its two sources, as one line: on /benchmark under Sample cases, and in benchmark.md. */
export function smallerThanToonLine(toon: ToonCount): string {
  return `${toon.text} (${toon.tokenizer}). ${toon.note}`;
}

// The home headline

export interface HomeHeadline {
  readonly title: string;
  /** The tokenizer behind the title. Null while the numbers are pending. */
  readonly tag: string | null;
  /** A second, plain line under the title. Null while the numbers are pending. */
  readonly line: string | null;
}

/**
 * The home page's token headline for one chart tab: the TOON result, then compact JSON on
 * a plain line, tagged with who counted. A tie with TOON is not counted as fewer.
 * Both tabs state the measured count and throw when Terset is under TOON in no case, or
 * under compact JSON in half the cases or fewer. Claude throws when its counts are pending.
 */
export function homeHeadline(bench: BenchFile, counters: Counters | null, id: CounterId = 'o200k'): HomeHeadline {
  if (counters === null) return { title: benchHeadline(bench), tag: null, line: null };
  const counter = id === 'o200k' ? counters.o200k : counters.claude;
  if (counter === null) throw new Error('The Claude headline needs the Claude counts, and they are pending');
  const total = counter.cases.length;
  const toon = underToon(counter);
  const json = underJson(counter);
  const where = `${counter.name} has it under`;
  if (toon === 0) throw new Error(`The home headline needs Terset under TOON in at least one case, but ${where} TOON in 0 of ${String(total)}`);
  if (json * 2 <= total) throw new Error(`The home headline needs Terset under compact JSON in most cases, but ${where} compact JSON in ${String(json)} of ${String(total)}`);
  return {
    title: `Fewer tokens than TOON in ${String(toon)} of ${String(total)} cases.`,
    tag: id === 'o200k' ? OPENAI_TOKENIZER : counter.label,
    line: `Fewer than compact JSON in ${String(json)} of ${String(total)}.`,
  };
}
