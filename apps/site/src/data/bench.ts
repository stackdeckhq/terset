// Pure helpers over a bench file, pending or ready. No Vite and no fixture here,
// so Node scripts and the site share them. numbers.ts picks the file the site shows.
// Most helpers take any set of cases, so the o200k_base file and the Claude
// counts share them. A pending bench file has no cases and gives empty text.
// Types only from the schema, so the browser code does not load zod.
import type { BenchFile, BenchPending, BenchReady, CaseRow } from './bench-schema.ts';

export type { BenchFile, BenchReady, CaseRow };

/** Measured rows from one counter, in bench order. A ready bench file is one. */
export interface CaseSet {
  readonly cases: readonly CaseRow[];
}

/** A pending bench file, or measured rows. */
export type CaseSource = BenchPending | CaseSet;

/** The fixture is used only when asked for in dev; otherwise the committed file. */
export function selectBench(file: BenchFile, fixture: BenchReady | null, useFixture: boolean): BenchFile {
  return useFixture && fixture !== null ? fixture : file;
}

export const PENDING_LABEL = 'Pending';
export const PENDING_TITLE = 'Token counts are pending.';
export const PENDING_NOTE = 'Numbers will appear here once the measured results are published.';

const NUMBER = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return NUMBER.format(value);
}

/** A count, or the pending label when there is none yet. */
export function countOrPending(value: number | undefined): string {
  return value === undefined ? PENDING_LABEL : formatCount(value);
}

/** A CSV count for a table cell: n/a when there is none, marked when it lost data. */
export function csvCell(row: CaseRow): string {
  if (row.csv === null) return 'n/a';
  return row.csvExact === true ? formatCount(row.csv) : `${formatCount(row.csv)} lossy`;
}

/** A percent change already rounded to one decimal, signed with a true minus sign: "−21.7%", "+3.0%", "0.0%". */
export function formatChange(change: number): string {
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return `${sign}${Math.abs(change).toFixed(1)}%`;
}

/** Signed change from `base` to `value`, one decimal, with a true minus sign. */
export function pct(value: number, base: number): string {
  return formatChange(Math.round(((value - base) / base) * 1000) / 10);
}

/** One plain phrase with no sign: "8.7% fewer tokens than JSON", "3.0% more tokens than TOON" or "As many tokens as JSON". */
export function compareTokens(value: number, base: number, name: string): string {
  const change = Math.round(((value - base) / base) * 1000) / 10;
  if (change === 0) return `As many tokens as ${name}`;
  return `${Math.abs(change).toFixed(1)}% ${change < 0 ? 'fewer' : 'more'} tokens than ${name}`;
}

/** Every count summed over all cases. CSV is left out: it exists only for some cases. */
export interface BenchTotals {
  readonly terset: number;
  readonly json: number;
  readonly jsonPretty: number;
  readonly yaml: number;
  readonly toon: number;
}

export function benchTotals(bench: CaseSet): BenchTotals {
  const sum = (key: keyof BenchTotals): number => bench.cases.reduce((total, row) => total + row[key], 0);
  return { terset: sum('terset'), json: sum('json'), jsonPretty: sum('jsonPretty'), yaml: sum('yaml'), toon: sum('toon') };
}

/** The footnote under the totals chart on home: how to read it, in the method's words. */
export function totalsChartNote(bench: CaseSet): string {
  return `Lower is better. Sum of ${String(bench.cases.length)} cases, rules line included. ${TOON_BEST_NOTE}`;
}

/** The bench table's columns, Terset first. The page and benchmark.md both use them. */
export const BENCH_TABLE_HEAD = ['Case', 'Terset', 'Compact JSON', 'Pretty JSON', 'YAML', 'TOON best', 'CSV', 'Terset vs compact JSON', 'Terset vs TOON'] as const;

/** One cell per BENCH_TABLE_HEAD column, in the same order. */
export type BenchTableRow = readonly [name: string, terset: string, json: string, jsonPretty: string, yaml: string, toon: string, csv: string, vsJson: string, vsToon: string];

function tableCells(name: string, counts: BenchTotals, csv: string): BenchTableRow {
  return [name, formatCount(counts.terset), formatCount(counts.json), formatCount(counts.jsonPretty), formatCount(counts.yaml), formatCount(counts.toon), csv, pct(counts.terset, counts.json), pct(counts.terset, counts.toon)];
}

/** One row of cells per case, in BENCH_TABLE_HEAD order. */
export function benchTableRows(bench: CaseSet): readonly BenchTableRow[] {
  return bench.cases.map((row) => tableCells(row.name, row, csvCell(row)));
}

/** The totals row. CSV is n/a: it exists only for some cases. */
export function benchTotalsRow(bench: CaseSet): BenchTableRow {
  return tableCells('Total', benchTotals(bench), 'n/a');
}

/** "17.2% fewer than compact JSON (53,248)", with no sign. */
function totalVs(value: number, base: number, name: string): string {
  const change = Math.round(((value - base) / base) * 1000) / 10;
  const amount = change === 0 ? 'as many as' : `${Math.abs(change).toFixed(1)}% ${change < 0 ? 'fewer' : 'more'} than`;
  return `${amount} ${name} (${formatCount(base)})`;
}

/** The totals over all cases in one sentence, computed from the data. Empty while pending. */
export function totalsNote(bench: CaseSource): string {
  if (!('cases' in bench)) return '';
  const totals = benchTotals(bench);
  const versus = [
    totalVs(totals.terset, totals.json, 'compact JSON'),
    totalVs(totals.terset, totals.jsonPretty, 'pretty JSON'),
    totalVs(totals.terset, totals.yaml, 'YAML'),
    `and ${totalVs(totals.terset, totals.toon, "TOON's best")}`,
  ];
  return `Over all ${String(bench.cases.length)} cases, Terset totals ${formatCount(totals.terset)} tokens: ${versus.join(', ')}.`;
}

/** Share of `base`, as a percentage number. */
export function share(value: number, base: number): number {
  return (value / base) * 100;
}

/** Cases where Terset is smaller than compact JSON. */
export function underJson(bench: CaseSet): number {
  return bench.cases.filter((row) => row.terset < row.json).length;
}

/** Cases where Terset is smaller than TOON's best. */
export function underToon(bench: CaseSet): number {
  return bench.cases.filter((row) => row.terset < row.toon).length;
}

/** Cases where compact JSON is smaller than or equal to Terset with its rules line. A tie is not a Terset win. */
export function jsonWins(bench: CaseSet): readonly CaseRow[] {
  return bench.cases.filter((row) => row.json <= row.terset);
}

/** The benchmark headline, computed from the data. Neutral while pending. */
export function benchHeadline(bench: BenchFile): string {
  if (bench.status === 'pending') return PENDING_TITLE;
  return `Fewer tokens than TOON in ${String(underToon(bench))} of ${String(bench.cases.length)} cases.`;
}

/** One line on the cases, computed from the data. */
export function benchSummary(bench: CaseSource): string {
  if (!('cases' in bench)) return `${bench.reason} ${PENDING_NOTE}`;
  const total = String(bench.cases.length);
  return `Terset, fitted rules line included, is under TOON's best in ${String(underToon(bench))} of ${total} cases and under compact JSON in ${String(underJson(bench))} of ${total}.`;
}

/** The cases JSON wins or ties, as one plain sentence. Empty when there are none. */
export function jsonWinsNote(bench: CaseSource): string {
  if (!('cases' in bench)) return '';
  const wins = jsonWins(bench);
  if (wins.length === 0) return '';
  const list = wins.map((row) => `${row.name.toLowerCase()} (${formatCount(row.json)} vs ${formatCount(row.terset)})`).join(' and ');
  return `Compact JSON is smaller than or equal to Terset on ${list}.`;
}

/** What plain CSV cannot hold, whatever the counter. */
const CSV_LIMITS = 'It has no types, it merges null, absent and empty text, and it cannot hold nesting.';

/** The same limits as one line of its own, for lists that give the CSV sizes per counter. */
export const CSV_LIMITS_LINE = 'On every counter, plain CSV has no types, merges null, absent and empty text, and cannot hold nesting.';

/** The CSV note, computed from the data: where it is smaller, its limits, and where it is larger. Empty when there is no CSV figure under Terset. */
export function csvNote(bench: CaseSource): string {
  const { smaller, larger } = csvSizes(bench);
  return smaller === '' ? '' : `${smaller} ${CSV_LIMITS}${larger}`;
}

/**
 * The CSV note without its limits, for "When to keep something else" on /benchmark, which
 * states the limits once for every counter. Empty when there is no CSV figure under Terset.
 */
export function csvSizeNote(bench: CaseSource): string {
  const { smaller, larger } = csvSizes(bench);
  return smaller === '' ? '' : `${smaller}${larger}`;
}

/** Where plain CSV is smaller than Terset and where it is larger, as sentences. Empty text when there is no CSV figure under Terset. */
function csvSizes(bench: CaseSource): { readonly smaller: string; readonly larger: string } {
  if (!('cases' in bench)) return { smaller: '', larger: '' };
  const smaller = bench.cases.filter((row) => row.csv !== null && row.csvExact === true && row.csv < row.terset);
  // The case where CSV loses most against Terset, so the note shows the clearest cost.
  const widest = bench.cases.reduce<CaseRow | undefined>((best, row) => {
    if (row.csv === null || row.csv <= row.terset) return best;
    return best === undefined || row.csv - row.terset > (best.csv ?? 0) - best.terset ? row : best;
  }, undefined);
  if (smaller.length === 0) return { smaller: '', larger: '' };
  const gaps = smaller.map((row) => row.terset - (row.csv ?? row.terset));
  const range = `${String(Math.min(...gaps))} to ${String(Math.max(...gaps))}`;
  const larger = widest === undefined ? '' : ` On ${widest.name.toLowerCase()} it is larger: ${formatCount(widest.csv ?? 0)} vs ${formatCount(widest.terset)}.`;
  return { smaller: `Plain CSV is ${range} tokens smaller on ${String(smaller.length)} flat, uniform lists, because it needs no rules line.`, larger };
}

/** The cases where compact JSON ties Terset and where it is smaller, each said as what it is. Empty when Terset is under compact JSON everywhere. */
export function jsonKeepNote(bench: CaseSource): string {
  if (!('cases' in bench)) return '';
  const list = (rows: readonly CaseRow[]): string => rows.map((row) => `${row.name.toLowerCase()} (${formatCount(row.json)} vs ${formatCount(row.terset)})`).join(' and ');
  const ties = bench.cases.filter((row) => row.json === row.terset);
  const smaller = bench.cases.filter((row) => row.json < row.terset);
  return [ties.length === 0 ? '' : `Compact JSON ties Terset on ${list(ties)}.`, smaller.length === 0 ? '' : `Compact JSON is smaller than Terset on ${list(smaller)}.`].filter((text) => text !== '').join(' ');
}

/** The cases where TOON's best is smaller than Terset and where it ties, each said as what it is. Empty when Terset is under TOON everywhere. */
export function toonKeepNote(bench: CaseSource): string {
  if (!('cases' in bench)) return '';
  // Case names hold commas, so each list uses semicolons.
  const list = (rows: readonly CaseRow[]): string => rows.map((row) => `${row.name} (${formatCount(row.toon)} vs ${formatCount(row.terset)})`).join('; ');
  const total = String(bench.cases.length);
  const smaller = bench.cases.filter((row) => row.toon < row.terset);
  const ties = bench.cases.filter((row) => row.toon === row.terset);
  return [
    smaller.length === 0 ? '' : `TOON's best is smaller than Terset in ${String(smaller.length)} of ${total} cases: ${list(smaller)}.`,
    ties.length === 0 ? '' : `TOON's best ties Terset in ${String(ties.length)} of ${total} cases: ${list(ties)}.`,
  ]
    .filter((text) => text !== '')
    .join(' ');
}

/** Bench cases whose name starts with this are the file lists. The losses line says how much of Terset's total they hold. */
export const FILE_LIST_PREFIX = 'File list';

/**
 * "A", "A and B", or "A; B; and C". Case names hold commas, so three or more use semicolons,
 * and so do two when either name has a comma: "A; B, long text".
 */
function caseNames(rows: readonly CaseRow[]): string {
  const names = rows.map((item) => item.name);
  const last = names.at(-1) ?? '';
  if (names.length < 3) return names.join(names.some((name) => name.includes(',')) ? '; ' : ' and ');
  return `${names.slice(0, -1).join('; ')}; and ${last}`;
}

/** The middle of the per-case savings against one base, in percent, rounded to one decimal. Even counts take the mean of the two middle values. */
function medianSaving(rows: readonly CaseRow[], base: (item: CaseRow) => number): number {
  const savings = rows.map((item) => ((base(item) - item.terset) / base(item)) * 100).sort((a, b) => a - b);
  const high = savings[Math.floor(savings.length / 2)];
  const low = savings[Math.ceil(savings.length / 2) - 1];
  if (high === undefined || low === undefined) throw new Error('The losses line has no cases to take a median of');
  return Math.round(((low + high) / 2) * 10) / 10;
}

/**
 * The losses line for one counter: every case where TOON's best is smaller than Terset,
 * the share of Terset's total the file lists hold, and the median saving per case.
 * Throws when the data stops supporting a sentence: no file-list case, or a median that saves nothing.
 */
export function lossesLine(bench: CaseSet): string {
  if (bench.cases.length === 0) throw new Error('The losses line has no cases to read');
  const losses = bench.cases.filter((item) => item.toon < item.terset);
  const lossText =
    losses.length === 0
      ? `TOON's best is smaller than Terset on none of the ${String(bench.cases.length)} cases.`
      : `TOON's best is smaller than Terset on ${String(losses.length)} ${losses.length === 1 ? 'case' : 'cases'}: ${caseNames(losses)}.`;

  const fileLists = bench.cases.filter((item) => item.name.startsWith(FILE_LIST_PREFIX));
  if (fileLists.length === 0) throw new Error(`The losses line names the file-list cases, and no case name starts with "${FILE_LIST_PREFIX}" any more`);
  const fileShare = String(Math.round(share(fileLists.reduce((total, item) => total + item.terset, 0), benchTotals(bench).terset)));
  const fileText = fileLists.length === 1 ? `The file-list case holds ${fileShare}% of Terset's total.` : `The ${String(fileLists.length)} file-list cases hold ${fileShare}% of Terset's total.`;

  const json = medianSaving(bench.cases, (item) => item.json);
  if (json <= 0) throw new Error('The losses line says the median case saves tokens against compact JSON, and the data no longer supports it');
  const toon = medianSaving(bench.cases, (item) => item.toon);
  if (toon <= 0) throw new Error("The losses line says the median case saves tokens against TOON's best, and the data no longer supports it");
  const medianText = `Per case, the median saving is ${json.toFixed(1)}% against compact JSON and ${toon.toFixed(1)}% against TOON's best.`;

  return `${lossText} ${fileText} ${medianText}`;
}

/** What every Terset count holds besides the data. Every note beside a headline count says it. */
export const FITTED_RULES_NOTE = 'Each Terset count includes rulesFor(text), the rules line fitted to that text.';

export function tokenizerNote(bench: BenchFile): string {
  if (bench.status === 'pending') return 'Counts will use one named tokenizer. Others will differ. JSON will mean compact JSON, not pretty printed.';
  return `Tokens counted with one tokenizer, ${bench.tokenizer}. Others will differ. JSON means compact JSON, not pretty printed. ${FITTED_RULES_NOTE}`;
}

export const QUALITY_NOTE = 'Token counts say nothing about answer quality. Terset is about fewer tokens.';

/** How to read a token table. */
export const TOKENS_NOTE = 'Counts are tokens. Lower is better.';

/** What the "TOON best" column holds, in the method's words. */
export const TOON_BEST_NOTE = "TOON best is the smaller of TOON's comma and tab forms.";

/** The note above each sample token table on /benchmark and in benchmark.md: how to read its columns, in the method's words. */
export const BENCH_TABLE_NOTE = `${TOKENS_NOTE} ${TOON_BEST_NOTE} CSV is n/a when the data is not one list of records. Lossy means the CSV did not read back to the same typed data.`;

/** The `@toon-format/toon` version every TOON count and size uses. numbers.test.ts checks it against the installed package. */
export const TOON_VERSION = '4.4.0';

/** Where the eleven case inputs come from. Both counters use the same inputs. */
export const CASE_SOURCE_NOTE =
  'All 11 case inputs are made-up data in this repository: `apps/site/src/data/count-cases.json`, built by `pnpm cases` from seed 20261117. `pnpm numbers` recounts them with o200k_base.';
