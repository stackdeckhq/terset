// The two token counters the site shows side by side, and the input cost at
// list price for each. o200k_base comes from bench-results.json; Claude comes
// from claude-counts.json; prices come from prices.ts.
//
// A pending Claude file is a normal state: the site shows o200k_base only.
// A ready Claude file that does not match the bench file case for case is a
// data error, so building the counters throws and the build stops. That covers
// a missing or extra case, a renamed case, other input data, or prices that
// belong to another counter.
import type { BenchFile, CaseRow, CaseSet } from './bench.ts';
import { FITTED_RULES_NOTE, benchHeadline, benchSummary, formatCount, lossesLine, tokenizerNote, totalsNote, underJson } from './bench.ts';
import type { Trio } from './bench-schema.ts';
import type { ClaudeCounts, ClaudeReady, ClaudeRow } from './claude-counts-schema.ts';
import type { Price, Prices } from './prices.ts';
import { SAMPLE_IDS } from './samples.ts';
import type { SampleId } from './samples.ts';

export type CounterId = 'o200k' | 'claude';

export interface Counter extends CaseSet {
  readonly id: CounterId;
  /** The short name in sentences and table headings. */
  readonly name: string;
  /** The switch label: who counts. */
  readonly label: string;
  readonly samples: Readonly<Record<SampleId, Trio>>;
  readonly price: Price;
}

/** Both counters once the bench is ready. Claude is null while its file is pending. */
export interface Counters {
  readonly o200k: Counter;
  readonly claude: Counter | null;
}

/** The counters to show, in switch order: o200k_base first. */
export function counterList(counters: Counters): readonly Counter[] {
  return counters.claude === null ? [counters.o200k] : [counters.o200k, counters.claude];
}

function claudeCases(bench: readonly CaseRow[], claude: ClaudeReady): readonly CaseRow[] {
  const rows = claude.rows.filter((row) => row.source === 'benchmark');
  const names = new Set(bench.map((row) => row.name));
  const extra = rows.filter((row) => !names.has(row.name)).map((row) => row.name);
  if (extra.length > 0) throw new Error(`Claude counts have cases the bench file does not: ${extra.join(', ')}`);
  return bench.map((base): CaseRow => {
    const matches = rows.filter((row) => row.name === base.name);
    const row = matches[0];
    if (row === undefined) throw new Error(`Claude counts have no row for the bench case "${base.name}"`);
    if (matches.length > 1) throw new Error(`Claude counts have ${String(matches.length)} rows for the bench case "${base.name}"`);
    checkInput(row, base.json, `bench case "${base.name}"`);
    if ((row.csv === null) !== (base.csv === null)) throw new Error(`Claude counts and the bench file disagree on whether "${base.name}" has a CSV form`);
    const csvExact = row.csvExact ?? base.csvExact;
    if (csvExact !== base.csvExact) throw new Error(`Claude counts and the bench file disagree on whether the CSV of "${base.name}" reads back exactly`);
    return { name: base.name, json: row.json, jsonPretty: row.jsonPretty, yaml: row.yaml, toon: row.toon, csv: row.csv, csvExact, terset: row.terset };
  });
}

/** Same input on both counters: the Claude row's local o200k_base count of compact JSON must equal the bench file's. */
function checkInput(row: ClaudeRow, o200kJson: number, what: string): void {
  if (row.o200kJson !== undefined && row.o200kJson !== o200kJson) {
    throw new Error(`Claude counts were made from other input data for the ${what}: compact JSON is ${String(row.o200kJson)} o200k_base tokens there and ${String(o200kJson)} here`);
  }
  for (const key of ['json', 'terset', 'toon'] as const) {
    if (row[key] <= 0) throw new Error(`Claude counts have a zero ${key} count for the ${what}`);
  }
}

function claudeSamples(base: Readonly<Record<SampleId, Trio>>, claude: ClaudeReady): Readonly<Record<SampleId, Trio>> {
  const entries = SAMPLE_IDS.map((id): readonly [SampleId, Trio] => {
    const row = claude.rows.find((item) => item.id === `sample:${id}`);
    if (row === undefined) throw new Error(`Claude counts have no row for the sample "${id}"`);
    checkInput(row, base[id].json, `sample "${id}"`);
    return [id, { json: row.json, toon: row.toon, terset: row.terset }];
  });
  return Object.fromEntries(entries) as Record<SampleId, Trio>;
}

/** Pairs the bench file with the Claude counts. Null while the bench is pending. Throws on any mismatch. */
export function buildCounters(bench: BenchFile, claude: ClaudeCounts, prices: Prices): Counters | null {
  if (bench.status === 'pending') return null;
  const o200k: Counter = { id: 'o200k', name: 'o200k_base', label: 'OpenAI o200k_base', cases: bench.cases, samples: bench.samples, price: prices.o200k };
  if (claude.status === 'pending') return { o200k, claude: null };
  if (claude.model !== prices.claude.counter) throw new Error(`The Claude price is for ${prices.claude.counter}, but the counts are from ${claude.model}`);
  return {
    o200k,
    claude: { id: 'claude', name: 'Claude', label: prices.claude.model, cases: claudeCases(bench.cases, claude), samples: claudeSamples(bench.samples, claude), price: prices.claude },
  };
}

/** The headline. With both counters it claims only what holds on both. */
export function countersHeadline(bench: BenchFile, counters: Counters | null): string {
  if (counters === null || counters.claude === null) return benchHeadline(bench);
  const total = String(counters.o200k.cases.length);
  const open = underJson(counters.o200k);
  const claude = underJson(counters.claude);
  if (open === claude) return `Fewer tokens than compact JSON in ${String(open)} of ${total} cases, on both counters.`;
  return `Fewer tokens than compact JSON in ${String(open)} of ${total} cases on o200k_base and ${String(claude)} on Claude.`;
}

function countedTwoWays(claude: Counter): string {
  return `Tokens counted two ways: the o200k_base tokenizer and Claude's token count for ${claude.price.model}. Others will differ.`;
}

/** Which counters made the numbers, in one or two plain sentences. */
export function countersNote(bench: BenchFile, counters: Counters | null): string {
  if (counters === null || counters.claude === null) return tokenizerNote(bench);
  return `${countedTwoWays(counters.claude)} JSON means compact JSON, not pretty printed. ${FITTED_RULES_NOTE}`;
}

/**
 * The counters note for the /benchmark lead. That page names compact JSON and pretty JSON
 * wherever they appear, so it leaves out what "JSON" means.
 */
export function countersPageNote(bench: BenchFile, counters: Counters | null): string {
  if (counters === null || counters.claude === null) return tokenizerNote(bench);
  return `${countedTwoWays(counters.claude)} ${FITTED_RULES_NOTE}`;
}

/** "o200k_base: Terset, fitted rules line included, is under ..." for one counter. */
export function counterSummary(counter: Counter): string {
  return `${counter.name}: ${benchSummary(counter)}`;
}

/** The totals sentence for one counter, named. */
export function counterTotals(counter: Counter): string {
  return `${counter.name}: ${totalsNote(counter)}`;
}

/** The losses line for one counter, named. */
export function counterLosses(counter: Counter): string {
  return `${counter.name}: ${lossesLine(counter)}`;
}

// Cost. Integer cents per 1,000 requests, so every shown difference is exact.

/** US cents for 1,000 requests of `tokens` input tokens at the counter's list price. */
export function centsPerThousand(tokens: number, price: Price): number {
  return Math.round((tokens * price.usdPerMillionInput) / 10);
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

/**
 * The difference in dollars, in words: "$1.60 less", "$0.08 more", "the same".
 * A signed amount beside two prices reads as a third price, so the cell says which way it goes.
 */
export function centsDelta(value: number, base: number): string {
  const change = value - base;
  if (change === 0) return 'the same';
  return `${formatCents(Math.abs(change))} ${change < 0 ? 'less' : 'more'}`;
}

export const COST_TABLE_HEAD = ['Case', 'Terset', 'Compact JSON', 'Terset vs compact JSON'] as const;

export type CostTableRow = readonly [name: string, terset: string, json: string, vsJson: string];

function costCells(name: string, terset: number, json: number, price: Price): CostTableRow {
  const t = centsPerThousand(terset, price);
  const j = centsPerThousand(json, price);
  return [name, formatCents(t), formatCents(j), centsDelta(t, j)];
}

export function costTableRows(counter: Counter): readonly CostTableRow[] {
  return counter.cases.map((row) => costCells(row.name, row.terset, row.json, counter.price));
}

export function costTotalsRow(counter: Counter): CostTableRow {
  const sum = (key: 'terset' | 'json'): number => counter.cases.reduce((total, row) => total + row[key], 0);
  return costCells('Total', sum('terset'), sum('json'), counter.price);
}

/** "$4 per million input tokens, context up to 272K" for one price. */
export function priceLine(price: Price): string {
  const rate = `${formatUsdRate(price.usdPerMillionInput)} per million input tokens`;
  return price.condition === null ? rate : `${rate}, ${price.condition}`;
}

function formatUsdRate(value: number): string {
  return Number.isInteger(value) ? `$${formatCount(value)}` : USD.format(value);
}

/** The cost table's caption for one counter. */
export function costCaption(counter: Counter): string {
  return `Input cost at list price, US dollars per 1,000 requests. ${counter.price.model} at ${priceLine(counter.price)}.`;
}

/** The source line for one counter's price. */
function priceSource(counter: Counter): string {
  const { price } = counter;
  const head = `${price.model} is ${priceLine(price)} ([pricing](${price.source})).`;
  if (counter.id === 'claude') return `${head} It is applied to the Claude counts.`;
  return `${head} It is applied to the \`o200k_base\` counts. Those are tokenizer counts, not counts reported for that model, so the ${price.model} figure assumes that tokenizer.`;
}

/**
 * The cost method in plain sentences, with the source of each price shown and
 * the date read. Claude first: its counts are the model's own.
 */
export function costMethod(counters: Counters, readOn: Prices['readOn']): readonly string[] {
  const shown = counters.claude === null ? [counters.o200k] : [counters.claude, counters.o200k];
  return [
    'Cost is the input tokens of one request times the list price, shown per 1,000 requests of that case. It is input only: no output tokens, no caching and no discounts. It is not a bill.',
    ...shown.map(priceSource),
    shown.length === 1 ? `The pricing page was read on ${readOn}.` : `Both pricing pages were read on ${readOn}.`,
  ];
}

/** How the Claude counts were made, in plain sentences. Empty while they are pending. */
export function claudeMethod(claude: ClaudeCounts): readonly string[] {
  if (claude.status === 'pending') return [];
  const day = claude.countedAt.slice(0, 10);
  return [
    `The Claude counts come from Anthropic's token count endpoint for \`${claude.model}\`, run on ${day} UTC.`,
    `Each text is sent as one user message. The same run also counts the one-letter text "${claude.baseline.text}", which comes back as ${formatCount(claude.baseline.inputTokens)} tokens. Its ${formatCount(claude.baseline.overheadTokens)} tokens of fixed message framing are taken off every count, assuming "${claude.baseline.text}" itself is ${formatCount(claude.baseline.assumedTextTokens)} token.`,
    claude.rulesMode === 'fitted'
      ? 'Terset is sent as rulesFor(text), a newline and the data, in one message, so its Claude counts include the fitted rules line. When rulesFor(text) is empty, the text is sent as the data alone.'
      : 'Terset is sent as the full RULES line, a newline and the data, in one message, so its Claude counts include the full rules line.',
    'Every Claude case was made from the same input as the o200k_base case of the same name. The build checks this by comparing the compact JSON counted locally with o200k_base.',
  ];
}
