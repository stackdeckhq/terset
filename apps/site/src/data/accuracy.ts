// Answer accuracy from the one published benchmark run of each model: the tables, the
// summary and the method, for /benchmark, /benchmark.md, the home page and the READMEs.
// Every figure comes from accuracy-results.json, which `pnpm accuracy` writes.
// The copy is kept short: the tables carry the detail. It states only what the data supports. Each claim is checked against
// the data when it is built, and a claim the data no longer supports throws
// instead of printing.
import raw from './accuracy-results.json' with { type: 'json' };
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel, AccuracyRow } from './accuracy-schema.ts';
import { formatCount } from './bench.ts';
import { REPO_URL, SITE_URL } from './site.ts';

export type { AccuracyFile, AccuracyModel, AccuracyRow };

/** Typed without zod, so the browser skips it. data-check.ts proves it against AccuracyFileSchema. */
export const ACCURACY = raw as AccuracyFile;

export const FORMAT_LABELS: Readonly<Record<AccuracyFormat, string>> = {
  terset: 'Terset',
  'json-compact': 'Compact JSON',
  'json-pretty': 'Pretty JSON',
  toon: 'TOON',
};

/** Says what the two JSON rows mean, under the tables on the page, in /benchmark.md and in the READMEs. */
export const ACCURACY_FORMAT_NOTE = 'Pretty JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.';

export const ACCURACY_TABLE_HEAD = ['Format', 'Correct', 'Accuracy', '95% interval', 'Input tokens', 'Cost', 'Terset costs less by'] as const;

/**
 * The Terset cell in the cost column, which every other row is set against. A plain hyphen,
 * so the page, /benchmark.md and the READMEs (which carry no en or em dash) show the same cell.
 */
export const TERSET_REFERENCE = '-';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

/** Small counts as words, larger ones as figures. */
export function countWord(value: number): string {
  return WORDS[value] ?? formatCount(value);
}

export function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

export function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatRow(model: AccuracyModel, format: AccuracyFormat): AccuracyRow {
  const row = model.rows.find((item) => item.format === format);
  if (row === undefined) throw new Error(`${model.name} has no ${format} row`);
  return row;
}

/**
 * The share of a format's total cost that Terset saves, from the unrounded costs: 1 − terset / other.
 * The same base as the cost card, so the table and the card give one number.
 */
export function tersetCostSaving(cost: number, tersetCost: number): number {
  return 1 - tersetCost / cost;
}

/**
 * The "Terset costs less by" cell, one decimal: "29.8%" when Terset is cheaper,
 * "Costs 5.0% more" when the format is cheaper, "0.0%" for a tie.
 */
export function costLessCell(cost: number, tersetCost: number): string {
  const saving = tersetCostSaving(cost, tersetCost);
  if (Math.round(saving * 1000) === 0) return '0.0%';
  return saving > 0 ? percent(saving) : `Costs ${percent(-saving)} more`;
}

/** The table cells for one model, Terset first. */
export function accuracyTableRows(model: AccuracyModel): readonly (readonly string[])[] {
  const terset = formatRow(model, 'terset');
  return model.rows.map((row) => [
    FORMAT_LABELS[row.format],
    `${formatCount(row.correct)} of ${formatCount(row.total)}`,
    percent(row.correct / row.total),
    `${percent(row.low)} to ${percent(row.high)}`,
    formatCount(row.inputTokens),
    usd(row.totalCost),
    row.format === 'terset' ? TERSET_REFERENCE : costLessCell(row.totalCost, terset.totalCost),
  ]);
}

/**
 * The note on runs under the tables and in the READMEs: one run per model, and when.
 * Throws unless each model has exactly one published run.
 */
export function accuracyRunsNote(file: AccuracyFile): string {
  const note = `Each model ran once, with every format, on ${runDates(file)}. Each table shows that one run.`;
  assertClaim(file.publishedRuns.length === file.models.length && file.models.every((model) => file.publishedRuns.filter((run) => run.model === model.id).length === 1), note);
  return note;
}

export const ACCURACY_RUNS_HEAD = ['Run', 'Date', 'Model', 'Failed attempts'] as const;

/** One row per published run, in model order: its date, its model and how many attempts failed and were retried. */
export function publishedRunsRows(file: AccuracyFile): readonly (readonly string[])[] {
  return file.publishedRuns.map((run) => {
    const model = file.models.find((item) => item.id === run.model);
    if (model === undefined) throw new Error(`No model ${run.model} in the accuracy data`);
    return [run.runId, run.runOn, model.name, run.failedRequests === 0 ? '0' : `${formatCount(run.failedRequests)}, retried`];
  });
}

/** The published runs table in Markdown, for /benchmark.md. */
export function publishedRunsMarkdownTable(file: AccuracyFile): string {
  return [markdownRow(ACCURACY_RUNS_HEAD), markdownRow(ACCURACY_RUNS_HEAD.map(() => '---')), ...publishedRunsRows(file).map(markdownRow)].join('\n');
}

/** The line under the published runs table. */
export const PUBLISHED_RUNS_NOTE = 'The one run behind each model\'s table.';

const ACCURACY_FORMAT_COUNT = Object.keys(FORMAT_LABELS).length;

/** How a signed change cell is marked: a saving in the accent tone, a loss plain and muted, or not at all. */
export type SignMark = 'is-less' | 'is-more' | null;

/** The mark for a signed change cell: "−25.0%" is a saving, "+26.4%" a loss, anything else plain. */
export function signMark(cell: string): SignMark {
  return cell.startsWith('−') ? 'is-less' : cell.startsWith('+') ? 'is-more' : null;
}

/**
 * How a "Terset costs less by" cell is marked, from the costs. A saving is a Terset win,
 * in the accent tone. A format cheaper than Terset is plain and muted. A tie is not marked.
 */
export type OverTersetMark = 'terset-cheaper' | 'terset-pricier' | null;

export function overTersetMark(cost: number, tersetCost: number): OverTersetMark {
  const saving = tersetCostSaving(cost, tersetCost);
  if (Math.round(saving * 1000) === 0) return null;
  return saving > 0 ? 'terset-cheaper' : 'terset-pricier';
}

/** Any mark a per-model table cell can carry. */
export type CellMark = SignMark | OverTersetMark;

/**
 * The marks for one model's table, in the same shape as accuracyTableRows without the format name.
 * The lowest input tokens and the lowest cost are marked as savings, ties included.
 * The last column is marked by whether Terset is cheaper. Correct, accuracy and the interval are never marked.
 */
export function accuracyTableMarks(model: AccuracyModel): readonly (readonly CellMark[])[] {
  const fewestTokens = Math.min(...model.rows.map((row) => row.inputTokens));
  const lowestCost = Math.min(...model.rows.map((row) => row.totalCost));
  const terset = formatRow(model, 'terset');
  return model.rows.map((row) => [
    null,
    null,
    null,
    row.inputTokens === fewestTokens ? 'is-less' : null,
    row.totalCost === lowestCost ? 'is-less' : null,
    row.format === 'terset' ? null : overTersetMark(row.totalCost, terset.totalCost),
  ]);
}

/** True when every format's interval overlaps every other format's. */
export function intervalsOverlap(model: AccuracyModel): boolean {
  return Math.max(...model.rows.map((row) => row.low)) <= Math.min(...model.rows.map((row) => row.high));
}

function assertClaim(holds: boolean, claim: string): void {
  if (!holds) throw new Error(`The accuracy copy says "${claim}", and the data no longer supports it`);
}

function modelsPhrase(file: AccuracyFile): string {
  return file.models.length === 2 ? 'both models' : file.models.length === 1 ? 'the model tested' : `all ${countWord(file.models.length)} models`;
}

/** The sentence that opens the accuracy section. */
export function accuracyIntro(file: AccuracyFile): string {
  return `Each model answered the same ${formatCount(file.questions)} questions about the same data, sent in each of four formats. These runs used Terset 1.1.`;
}

/** The result in two lines under the tables. Each claim is checked against the data; the overlap line checks its own. */
export function accuracySummary(file: AccuracyFile): readonly string[] {
  assertClaim(file.models.every((model) => formatRow(model, 'terset').totalCost < formatRow(model, 'json-compact').totalCost), 'Terset cost less than compact JSON');
  const savings = file.models.map((model) => {
    const share = tersetCostSaving(formatRow(model, 'json-compact').totalCost, formatRow(model, 'terset').totalCost);
    return `${percent(share)} less on ${model.name}`;
  });
  return [accuracyOverlapLine(file), `Against compact JSON, Terset cost ${savings.join(' and ')}.`];
}

/**
 * The one sentence every accuracy claim uses. Overlapping intervals mean the test cannot tell
 * the formats apart; they do not show the formats are equally accurate. Throws once any two
 * formats' intervals stop overlapping on any model.
 */
export function accuracyRangesOverlap(file: AccuracyFile): string {
  assertClaim(file.models.every(intervalsOverlap), 'every interval overlaps');
  return `The 95% accuracy ranges of all ${countWord(ACCURACY_FORMAT_COUNT)} formats overlap on ${modelsPhrase(file)}.`;
}

/** The overlap sentence and what it does not prove: under the big numbers on /benchmark, and the first result line. */
export function accuracyOverlapLine(file: AccuracyFile): string {
  return `${accuracyRangesOverlap(file)} That does not prove the formats are equally accurate.`;
}

/** One line for the home page, where the token savings are shown: the token result first, then the overlap. */
export function accuracyHomeLine(file: AccuracyFile): string {
  assertClaim(file.models.every((model) => formatRow(model, 'terset').inputTokens < formatRow(model, 'json-compact').inputTokens), 'Terset used fewer input tokens than compact JSON');
  return `On ${formatCount(file.questions)} questions and ${countWord(file.models.length)} models, Terset 1.1 used fewer input tokens than compact JSON. ${accuracyRangesOverlap(file)}`;
}

/** How each kind of data is named: in the table, and inside a sentence. */
export const KIND_LABELS: Readonly<Record<AccuracyKindId, { readonly label: string; readonly phrase: string }>> = {
  tabular: { label: 'Flat tables', phrase: 'flat tables' },
  analytics: { label: 'Analytics', phrase: 'analytics' },
  github: { label: 'GitHub repos', phrase: 'GitHub repos' },
  'event-logs': { label: 'Event logs', phrase: 'event logs' },
  nested: { label: 'Nested orders', phrase: 'nested orders' },
  'nested-group': { label: 'Nested groups', phrase: 'nested groups' },
  keyed: { label: 'Keyed objects', phrase: 'keyed objects' },
  'nested-config': { label: 'Nested config', phrase: 'nested config' },
  'structure-control': { label: 'Structure: control', phrase: 'the control structure check' },
  'structure-truncated': { label: 'Structure: truncated', phrase: 'the truncated structure check' },
  'structure-extra-rows': { label: 'Structure: extra rows', phrase: 'the extra rows structure check' },
  'structure-width-mismatch': { label: 'Structure: width mismatch', phrase: 'the width mismatch structure check' },
  'structure-missing-fields': { label: 'Structure: missing fields', phrase: 'the missing fields structure check' },
};

/** Short model names for the column heads of the kind table, where the full names are too wide. */
const SHORT_MODEL_NAMES: Readonly<Record<string, string>> = {
  'claude-opus-5-5': 'Opus',
  'gpt-6.1-sol': 'Sol',
};

export function shortModelName(model: AccuracyModel): string {
  return SHORT_MODEL_NAMES[model.id] ?? model.name;
}

/** The formats Terset is set against in the kind table, in column order. */
export const KIND_BASES = ['json-compact', 'toon'] as const satisfies readonly AccuracyFormat[];

/** The column group head for each base. */
export const KIND_BASE_LABELS: Readonly<Record<(typeof KIND_BASES)[number], string>> = {
  'json-compact': 'vs compact JSON',
  toon: 'vs TOON',
};

export const ACCURACY_KIND_NOTE = 'Input tokens, primers included, counted the same way as the tables. Minus means Terset used fewer tokens.';

/** Terset input tokens against a base, as a whole percent: "−40%", "+61%" or "0%". */
export function wholePct(value: number, base: number): string {
  const change = Math.round((value / base - 1) * 100);
  return change === 0 ? '0%' : `${change > 0 ? '+' : '−'}${String(Math.abs(change))}%`;
}

function kindModel(item: AccuracyKind, model: AccuracyModel): AccuracyKind['models'][number] {
  const found = item.models.find((entry) => entry.id === model.id);
  if (found === undefined) throw new Error(`${model.name} has no tokens for ${item.kind}`);
  return found;
}

/** The kind table's columns after Data and Questions: every base, then every model within it. */
export function kindColumns(file: AccuracyFile): readonly { readonly base: (typeof KIND_BASES)[number]; readonly model: AccuracyModel }[] {
  return KIND_BASES.flatMap((base) => file.models.map((model) => ({ base, model })));
}

/** One row per kind of data: label, questions, then Terset against each base for each model. */
export function kindTableRows(file: AccuracyFile): readonly (readonly string[])[] {
  return file.kinds.map((item) => [
    KIND_LABELS[item.kind].label,
    formatCount(item.questions),
    ...kindColumns(file).map(({ base, model }) => {
      const tokens = kindModel(item, model).inputTokens;
      return wholePct(tokens.terset, tokens[base]);
    }),
  ]);
}

/** Flat column heads for the Markdown kind table, where cells cannot span. */
export function kindMarkdownHead(file: AccuracyFile): readonly string[] {
  return ['Data', 'Questions', ...kindColumns(file).map(({ base, model }) => `${KIND_BASE_LABELS[base]}, ${shortModelName(model)}`)];
}

export function kindMarkdownTable(file: AccuracyFile): string {
  const head = kindMarkdownHead(file);
  return [markdownRow(head), markdownRow(head.map(() => '---')), ...kindTableRows(file).map(markdownRow)].join('\n');
}

function listPhrase(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/**
 * The kinds of data where TOON used fewer input tokens than Terset on every model,
 * largest gap first, as one sentence. Null when there is no such kind.
 */
export function accuracyKindLine(file: AccuracyFile): string | null {
  const losses = file.kinds
    .map((item) => {
      const ratios = file.models.map((model) => {
        const tokens = kindModel(item, model).inputTokens;
        return tokens.terset / tokens.toon;
      });
      return { item, ratios };
    })
    .filter(({ ratios }) => ratios.every((ratio) => ratio > 1))
    .sort((a, b) => Math.min(...b.ratios) - Math.min(...a.ratios));
  if (losses.length === 0) return null;
  return `TOON used fewer tokens than Terset on ${listPhrase(losses.map(({ item }) => KIND_LABELS[item.kind].phrase))}.`;
}

/** The lines under the tables on /benchmark and in /benchmark.md: the result, then where TOON used fewer tokens. */
export function accuracyLines(file: AccuracyFile): readonly string[] {
  const kindLine = accuracyKindLine(file);
  return [...accuracySummary(file), ...(kindLine === null ? [] : [kindLine])];
}

/** One link per published folder, named by its run date. Runs from one day share a folder. */
function publishedLinks(file: AccuracyFile): string {
  const folders = new Map(file.publishedRuns.map((run) => [run.publishedPath, run.runOn]));
  return listPhrase([...folders].map(([path, runOn]) => `[${runOn}](${REPO_URL}/tree/main/${path})`));
}

/** The dates of every published run, oldest first, each once. */
function runDates(file: AccuracyFile): string {
  return listPhrase([...new Set(file.publishedRuns.map((run) => run.runOn))].sort());
}

/** Small counts as capitalized words, to open a sentence. */
function sentenceCount(value: number): string {
  const word = countWord(value);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/**
 * Whether any request in the tables failed, and what happened to it. A request can fail
 * more than once before it is answered, so the line counts failed attempts.
 */
export function failedCallsLine(file: AccuracyFile): string {
  if (file.failedCalls === 0) return 'None failed.';
  if (file.failedCalls === 1) return 'One attempt failed and was retried in the same run. It stays in the run file.';
  return `${sentenceCount(file.failedCalls)} attempts failed and were retried in the same run. Each stays in its run file.`;
}

/** How the input tokens were counted. The schema allows only tokens as each model reported them. */
export const INPUT_TOKENS_LINE = 'Input tokens are as each model reported them.';

/** How cost is made, in one sentence. */
export function costLine(file: AccuracyFile): string {
  const reads = listPhrase([...new Set(file.models.map((model) => model.priceReadOn))]);
  return `Cost is at API list price: input and output tokens times list prices read on ${reads}.`;
}

/** How the run was made, in at most five short lines. Inline Markdown: code spans and links. */
export function accuracyMethod(file: AccuracyFile): readonly string[] {
  return [
    `Tables use ${formatCount(file.calls)} answered calls from runs on ${runDates(file)}. ${failedCallsLine(file)} These runs used Terset 1.1 with fitted rules for each text.`,
    // The short hash fits a phone column; the link keeps the full one.
    `Questions from the open [TOON benchmark](https://github.com/toon-format/toon) (MIT), commit [${file.upstreamSha.slice(0, 7)}](https://github.com/toon-format/toon/commit/${file.upstreamSha}).`,
    'Temperature 0 where the model accepts it, scored by fixed rules with no model judge.',
    `${costLine(file)} ${INPUT_TOKENS_LINE}`,
    `Every answer and its score: ${publishedLinks(file)}. The questions and the steps to run it yourself: [bench](${REPO_URL}/tree/main/bench).`,
  ];
}

const markdownRow = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;

/** One model's table in Markdown, for /benchmark.md. */
export function accuracyMarkdownTable(model: AccuracyModel): string {
  return [markdownRow(ACCURACY_TABLE_HEAD), markdownRow(ACCURACY_TABLE_HEAD.map(() => '---')), ...accuracyTableRows(model).map(markdownRow)].join('\n');
}

/** The accuracy block both READMEs carry, word for word. */
export function accuracyReadmeBlock(file: AccuracyFile): string {
  return [
    '### Answer accuracy',
    accuracyHomeLine(file),
    ...file.models.flatMap((model) => [`#### ${model.name}`, accuracyReadmeTable(model)]),
    ACCURACY_FORMAT_NOTE,
    accuracyRunsNote(file),
    accuracySummary(file).join('\n'),
    `${costLine(file)} ${INPUT_TOKENS_LINE} Temperature 0 where the model accepts it. These runs used Terset 1.1 with fitted rules for each text.`,
    `Method and limits: [terset.dev/benchmark](${SITE_URL}/benchmark#accuracy). Every answer and its score: ${publishedLinks(file)}.`,
  ].join('\n\n');
}

/** One model's table for the READMEs: the same cells with a plain hyphen for minus. */
export function accuracyReadmeTable(model: AccuracyModel): string {
  const line = (cells: readonly string[]): string => `| ${cells.map((cell) => cell.replace('−', '-')).join(' | ')} |`;
  return [line(ACCURACY_TABLE_HEAD), line(ACCURACY_TABLE_HEAD.map(() => '---')), ...accuracyTableRows(model).map(line)].join('\n');
}
