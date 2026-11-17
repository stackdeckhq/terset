// Answer accuracy from selected published benchmark runs: the tables, the summary and
// the method, for /benchmark, /benchmark.md, the home page and the READMEs.
// Every figure comes from accuracy-results.json, which `pnpm accuracy` writes.
// The copy is kept short: the tables carry the detail. It states only what the data supports. Each claim is checked against
// the data when it is built, and a claim the data no longer supports throws
// instead of printing.
import raw from './accuracy-results.json' with { type: 'json' };
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyKindId, AccuracyModel, AccuracyRow } from './accuracy-schema.ts';
import { formatCount, pct } from './bench.ts';
import { REPO_URL, SITE_URL } from './site.ts';

export type { AccuracyFile, AccuracyModel, AccuracyRow };

/** Typed without zod, so the browser skips it. data-check.ts proves it against AccuracyFileSchema. */
export const ACCURACY = raw as AccuracyFile;

export const FORMAT_LABELS: Readonly<Record<AccuracyFormat, string>> = {
  terset: 'Terset',
  'json-compact': 'Compact JSON',
  'json-pretty': 'JSON',
  toon: 'TOON',
};

/** Says what the two JSON rows mean, under the tables on the page, in /benchmark.md and in the READMEs. */
export const ACCURACY_FORMAT_NOTE = 'JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.';

export const ACCURACY_TABLE_HEAD = ['Format', 'Correct', 'Accuracy', '95% interval', 'Input tokens', 'Cost', 'Costs more than Terset', 'Run date'] as const;

/** The Terset cell in the cost column, which every other row is set against. */
export const TERSET_REFERENCE = 'Reference';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

/** Small counts as words, larger ones as figures. */
function countWord(value: number): string {
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
 * How much more a format's total cost is than Terset's, from the unrounded costs, one decimal:
 * "+33.3%" when Terset is cheaper, "−5.0%" when the format is cheaper, "0.0%" for a tie.
 */
export function costOverTerset(cost: number, tersetCost: number): string {
  return pct(cost, tersetCost);
}

/** The table cells for one model, Terset first. The last cell is how much more each format cost than Terset. */
export function accuracyTableRows(model: AccuracyModel): readonly (readonly string[])[] {
  const terset = formatRow(model, 'terset');
  return model.rows.map((row) => [
    FORMAT_LABELS[row.format],
    `${formatCount(row.correct)} of ${formatCount(row.total)}`,
    percent(row.correct / row.total),
    `${percent(row.low)} to ${percent(row.high)}`,
    formatCount(row.inputTokens),
    usd(row.totalCost),
    row.format === 'terset' ? TERSET_REFERENCE : costOverTerset(row.totalCost, terset.totalCost),
    row.runOn,
  ]);
}

/** How a signed change cell is marked: a saving in the accent tone, a loss plain and muted, or not at all. */
export type SignMark = 'is-less' | 'is-more' | null;

/** The mark for a signed change cell: "−25.0%" is a saving, "+26.4%" a loss, anything else plain. */
export function signMark(cell: string): SignMark {
  return cell.startsWith('−') ? 'is-less' : cell.startsWith('+') ? 'is-more' : null;
}

/**
 * How a "Costs more than Terset" cell is marked. A plus means Terset is cheaper, a Terset win,
 * in the accent tone. A minus means that format is cheaper than Terset, plain and muted.
 */
export type OverTersetMark = 'terset-cheaper' | 'terset-pricier' | null;

export function overTersetMark(cell: string): OverTersetMark {
  return cell.startsWith('+') ? 'terset-cheaper' : cell.startsWith('−') ? 'terset-pricier' : null;
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
  return accuracyTableRows(model).map((cells, index) => {
    const row = model.rows[index];
    if (row === undefined) throw new Error(`${model.name} has no row ${String(index)}`);
    return [null, null, null, row.inputTokens === fewestTokens ? 'is-less' : null, row.totalCost === lowestCost ? 'is-less' : null, overTersetMark(cells[6] ?? ''), null];
  });
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
  return `Each model answered the same ${formatCount(file.questions)} questions about the same data, sent in each of four formats.`;
}

/** The result in two sentences under the tables. Each claim is checked against the data first. */
export function accuracySummary(file: AccuracyFile): readonly string[] {
  assertClaim(file.models.every(intervalsOverlap), 'every interval overlaps');
  assertClaim(file.models.every((model) => formatRow(model, 'terset').totalCost < formatRow(model, 'json-compact').totalCost), 'Terset cost less than compact JSON');
  const savings = file.models.map((model) => {
    const share = 1 - formatRow(model, 'terset').totalCost / formatRow(model, 'json-compact').totalCost;
    return `${percent(share)} less on ${model.name}`;
  });
  return [
    `Accuracy is a tie. On ${formatCount(file.questions)} questions, every format's 95% interval overlaps every other format's, on ${modelsPhrase(file)}.`,
    `Against compact JSON, Terset cost ${savings.join(' and ')}.`,
  ];
}

/** One line for the home page, where the token savings are shown. */
export function accuracyHomeLine(file: AccuracyFile): string {
  assertClaim(file.models.every(intervalsOverlap), 'every interval overlaps');
  assertClaim(file.models.every((model) => formatRow(model, 'terset').inputTokens < formatRow(model, 'json-compact').inputTokens), 'Terset used fewer input tokens than compact JSON');
  return `On ${formatCount(file.questions)} questions and ${countWord(file.models.length)} models, accuracy is a tie. Terset used fewer input tokens than compact JSON.`;
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

function publishedLinks(file: AccuracyFile): string {
  return file.publishedRuns.map((run) => `[${run.runOn}](${REPO_URL}/tree/main/${run.publishedPath})`).join(' and ');
}

/** The date of the run Terset's rows come from. */
export function tersetRunOn(file: AccuracyFile): string {
  const run = file.publishedRuns.find((item) => item.formats.includes('terset'));
  if (run === undefined) throw new Error('No published run holds Terset');
  return run.runOn;
}

/** How the input tokens were counted, in one sentence: the counted models first, then the rest. */
export function inputTokensLine(file: AccuracyFile): string {
  const counted = file.models.filter((model) => model.inputTokensFrom === 'anthropic-token-count');
  const reported = file.models.filter((model) => model.inputTokensFrom === 'model-report');
  const names = (models: readonly AccuracyModel[]): string => listPhrase(models.map((model) => model.name));
  if (counted.length === 0) return 'Input tokens are as each model reported them.';
  const countedPart = `${names(counted)} input tokens were counted with Anthropic's token counting endpoint over the exact request`;
  return reported.length === 0 ? `${countedPart}.` : `${countedPart}; ${names(reported)} input tokens are as the model reported them.`;
}

/** How cost is made, in one sentence. */
export function costLine(file: AccuracyFile): string {
  const reads = listPhrase([...new Set(file.models.map((model) => model.priceReadOn))]);
  return `Cost is at API list price: input and output tokens times list prices read on ${reads}.`;
}

/** How the run was made, in at most five short lines. Inline Markdown: code spans and links. */
export function accuracyMethod(file: AccuracyFile): readonly string[] {
  return [
    `Tables use ${formatCount(file.calls)} calls from runs on ${file.publishedRuns.map((run) => run.runOn).join(' and ')}; none failed. Terset was rerun with fitted rules, which send only the rules each text needs. The other formats did not change.`,
    // The short hash fits a phone column; the link keeps the full one.
    `Questions from the open [TOON benchmark](https://github.com/toon-format/toon) (MIT), commit [${file.upstreamSha.slice(0, 7)}](https://github.com/toon-format/toon/commit/${file.upstreamSha}).`,
    'Temperature 0 where the model accepts it, scored by fixed rules with no model judge.',
    `${costLine(file)} ${inputTokensLine(file)}`,
    `Every answer and its score: ${publishedLinks(file)}. Each row names its run date.`,
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
    accuracySummary(file).join('\n'),
    `${costLine(file)} ${inputTokensLine(file)} Temperature 0 where the model accepts it. Terset was rerun on ${tersetRunOn(file)} with fitted rules, which send only the rules each text needs. The other formats did not change. Each row names its run date.`,
    `Method and limits: [terset.dev/benchmark](${SITE_URL}/benchmark#accuracy). Every answer and its score: ${publishedLinks(file)}.`,
  ].join('\n\n');
}

/** One model's table for the READMEs: the same cells with a plain hyphen for minus. */
export function accuracyReadmeTable(model: AccuracyModel): string {
  const line = (cells: readonly string[]): string => `| ${cells.map((cell) => cell.replace('−', '-')).join(' | ')} |`;
  return [line(ACCURACY_TABLE_HEAD), line(ACCURACY_TABLE_HEAD.map(() => '---')), ...accuracyTableRows(model).map(line)].join('\n');
}
