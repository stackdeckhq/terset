// The benchmark text. The /benchmark page and /benchmark.md both read it,
// and every number comes from the bench file and the Claude counts passed in.
// A pending bench file gives a marked pending document with no counts in it.
// A pending Claude file gives the o200k_base document alone.
import { ACCURACY, ACCURACY_FORMAT_NOTE, ACCURACY_KIND_NOTE, PUBLISHED_RUNS_NOTE, accuracyIntro, accuracyLines, accuracyOverlapLine, accuracyMarkdownTable, accuracyMethod, accuracyRunsNote, kindMarkdownTable, publishedRunsMarkdownTable } from './accuracy.ts';
import type { AccuracyFile } from './accuracy.ts';
import { BENCH_TABLE_HEAD, BENCH_TABLE_NOTE, CASE_SOURCE_NOTE, CSV_LIMITS_LINE, PENDING_NOTE, TOKENS_NOTE, TOON_BEST_NOTE, TOON_VERSION, PENDING_TITLE, QUALITY_NOTE, benchSummary, benchTableRows, benchTotals, benchTotalsRow, csvSizeNote, formatCount, jsonKeepNote, lossesLine, toonKeepNote, totalsNote } from './bench.ts';
import type { BenchFile } from './bench.ts';
import type { ClaudeCounts } from './claude-counts-schema.ts';
import { COST_TABLE_HEAD, buildCounters, claudeMethod, costCaption, costMethod, costTableRows, costTotalsRow, counterList, counterLosses, counterSummary, counterTotals } from './counters.ts';
import type { Counter, Counters } from './counters.ts';
import { BYTES, bytesLine } from './bytes.ts';
import { PRICES } from './prices.ts';
import { proofLines } from './proof.ts';
import { REAL, REAL_TABLE_HEAD, realIntro, realKeepElse, realLines, realMethod, realTableRows } from './real.ts';
import type { RealData } from './real-data-schema.ts';
import { SIZE_LINE } from './size.ts';
import { STRESS, stressKeepElse, stressMarkdown } from './stress.ts';
import type { StressAccuracyFile } from './stress.ts';
import { SWEEP, SWEEP_TABLE_HEAD, SWEEP_TABLE_NOTE, sweepIntro, sweepLines, sweepMethod, sweepTableRows, sweepTitle } from './sweep.ts';
import { TUNING_DETAIL, TUNING_NOTE } from './tuning.ts';
import { workedExampleMarkdown } from './worked-example.ts';

export const BENCHMARK_TITLE = 'Terset benchmark';

const NO_CLAUDE: ClaudeCounts = { status: 'pending' };

/** Both counters for a bench file, or null while it is pending. */
export function benchCounters(bench: BenchFile, claude: ClaudeCounts = NO_CLAUDE): Counters | null {
  return buildCounters(bench, claude, PRICES);
}

/** One line per counter, named, or the plain line when there is only one counter. Empty lines are dropped. */
function perCounter(counters: Counters, line: (counter: Counter) => string): readonly string[] {
  const list = counterList(counters);
  const lines = list.map((counter) => {
    const text = line(counter);
    return text === '' || list.length === 1 ? text : `${counter.name}: ${text}`;
  });
  return lines.filter((text) => text !== '');
}

export function benchmarkSummary(bench: BenchFile, counters: Counters | null = benchCounters(bench)): readonly string[] {
  if (bench.status === 'pending') return [PENDING_TITLE, bench.reason, PENDING_NOTE];
  if (counters === null || counters.claude === null) return [benchSummary(bench), totalsNote(bench), lossesLine(bench), QUALITY_NOTE];
  return [...counterList(counters).flatMap((counter) => [counterSummary(counter), counterTotals(counter), counterLosses(counter)]), QUALITY_NOTE];
}

/** The losses line per counter, named when there are two, for the sample section on /benchmark. Empty while pending. */
export function benchmarkLosses(bench: BenchFile, counters: Counters | null): readonly string[] {
  if (bench.status === 'pending') return [];
  if (counters === null || counters.claude === null) return [lossesLine(bench)];
  return counterList(counters).map(counterLosses);
}

/**
 * The lines under the sample cases card on /benchmark. The card already shows the
 * summary of the counter on view, or the pending note, so these lines leave it out.
 */
/** The full totals sentence per counter, for the sample tables fold on /benchmark. Empty while pending. */
export function benchmarkSampleTotals(bench: BenchFile, counters: Counters | null): readonly string[] {
  if (bench.status === 'pending') return [];
  if (counters === null || counters.claude === null) return [totalsNote(bench)];
  return counterList(counters).map(counterTotals);
}

/** Terset's total under one base, as "26.8%". Throws when Terset is not under it, so the line never says "fewer" over a loss. */
function fewerShare(terset: number, base: number, name: string): string {
  const change = Math.round(((terset - base) / base) * 1000) / 10;
  if (change >= 0) throw new Error(`The sample line says Terset totals fewer tokens than ${name}, and the data no longer supports it`);
  return `${Math.abs(change).toFixed(1)}%`;
}

/**
 * The one open line under the sample chart on /benchmark: the total saving against compact JSON
 * and TOON's best, per counter. The full totals sit in the fold. Empty while pending.
 */
export function sampleTotalsLine(bench: BenchFile, counters: Counters | null): string {
  if (bench.status === 'pending' || counters === null) return '';
  const shares = counterList(counters).map((counter) => {
    const totals = benchTotals(counter);
    return { name: counter.name, json: fewerShare(totals.terset, totals.json, 'compact JSON'), toon: fewerShare(totals.terset, totals.toon, "TOON's best") };
  });
  const [first, ...rest] = shares;
  if (first === undefined) return '';
  const others = rest.map((item) => `, and ${item.json} and ${item.toon} fewer on ${item.name}`).join('');
  return `Over all ${String(bench.cases.length)} cases, Terset totals ${first.json} fewer tokens than compact JSON and ${first.toon} fewer than TOON's best on ${first.name}${others}.`;
}

export function benchmarkMethod(bench: BenchFile, claude: ClaudeCounts = NO_CLAUDE): readonly string[] {
  const paired = bench.status === 'ready' && claude.status === 'ready';
  return [
    bench.status === 'ready'
      ? paired
        ? `The o200k_base counts use the \`${bench.tokenizer}\` tokenizer, run locally.`
        : `Every count uses one tokenizer, \`${bench.tokenizer}\`.`
      : 'Every count will use one named tokenizer.',
    ...(bench.status === 'ready' ? claudeMethod(claude) : []),
    ...(bench.status === 'ready' ? [CASE_SOURCE_NOTE, sweepMethod(SWEEP, paired)] : []),
    'Every format gets the same input, root arrays included.',
    'Compact JSON is `JSON.stringify(value)`, with no spaces and no line breaks. It is the main baseline: every headline percentage is against it.',
    'Pretty JSON is `JSON.stringify(value, null, 2)`, with a 2-space indent.',
    bench.status === 'ready'
      ? `YAML is the \`yaml\` package, version ${bench.yamlVersion}, \`stringify\` with default options.`
      : 'YAML will be the `yaml` package, `stringify` with default options.',
    `TOON is the \`@toon-format/toon\` package, version ${TOON_VERSION}, the smaller of its comma and tab forms for each case.`,
    'CSV is plain comma CSV for data that is one list of records, and n/a otherwise. Each CSV is read back and checked; lossy means it did not come back as the same typed data.',
    bench.status === 'ready'
      ? `Terset o200k_base counts include rulesFor(text), fitted to each encoded text, once per prompt. The full RULES reference is ${formatCount(bench.rulesTokens)} tokens.`
      : 'Terset counts will include the fitted rules line, once per prompt.',
    'Each Terset output is decoded and compared with its input, after UTF-8 transport, before it is counted.',
  ];
}

/** How the cost figures were made, for the counters shown. Empty while the bench is pending. */
export function benchmarkCostMethod(counters: Counters | null): readonly string[] {
  return counters === null ? [] : costMethod(counters, PRICES.readOn);
}

/**
 * Where Terset does not win on the sample cases, from the data: ties and smaller formats per
 * counter, then the CSV sizes per counter and the CSV limits once. The READMEs carry this list.
 */
export function benchmarkKeepElse(bench: BenchFile, counters: Counters | null = benchCounters(bench)): readonly string[] {
  if (counters === null) return [];
  const csv = perCounter(counters, csvSizeNote);
  return [...perCounter(counters, jsonKeepNote), ...perCounter(counters, toonKeepNote), ...csv, ...(csv.length > 0 ? [CSV_LIMITS_LINE] : [])];
}

/** The full "When to keep something else" list for /benchmark and benchmark.md: the sample cases, then the real files and the stress test. */
export function benchmarkKeepElseAll(bench: BenchFile, counters: Counters | null = benchCounters(bench), real: RealData = REAL, stress: StressAccuracyFile = STRESS): readonly string[] {
  if (counters === null) return [];
  return [...benchmarkKeepElse(bench, counters), ...realKeepElse(real), stressKeepElse(stress)];
}

export function benchmarkLimits(counters: Counters | null): readonly string[] {
  const paired = counters !== null && counters.claude !== null;
  return [
    paired ? 'Token counts are for two counters. Other tokenizers and models will give other counts.' : 'Token counts are for one tokenizer. Other tokenizers will give other counts.',
    QUALITY_NOTE,
    'Fewer tokens is not proof of lower cost or faster replies on every model.',
    ...(counters === null ? [] : ['Cost figures are input tokens at list price on the day the prices were read. Prices change.']),
    SIZE_LINE,
  ];
}

const markdownRow = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;

const bullets = (lines: readonly string[]): string => lines.map((line) => `- ${line}`).join('\n');

function countTable(counter: Counter): string {
  return [markdownRow(BENCH_TABLE_HEAD), markdownRow(BENCH_TABLE_HEAD.map(() => '---')), ...benchTableRows(counter).map(markdownRow), markdownRow(benchTotalsRow(counter))].join('\n');
}

function costTable(counter: Counter): string {
  return [costCaption(counter), [markdownRow(COST_TABLE_HEAD), markdownRow(COST_TABLE_HEAD.map(() => '---')), ...costTableRows(counter).map(markdownRow), markdownRow(costTotalsRow(counter))].join('\n')].join('\n\n');
}

/** The seed sweep: a title, the intro, how often each result holds and one table. */
function sweepSection(bench: BenchFile): readonly string[] {
  const head = markdownRow(SWEEP_TABLE_HEAD);
  return [`## ${sweepTitle(SWEEP)}, ${SWEEP.tokenizer}`, sweepIntro(SWEEP), bullets(sweepLines(SWEEP, bench)), SWEEP_TABLE_NOTE, [head, markdownRow(SWEEP_TABLE_HEAD.map(() => '---')), ...sweepTableRows(SWEEP).map(markdownRow)].join('\n')];
}

/** The real files: a title, the intro, one line per file, one table and the method. The same order as the page. */
function realSection(): readonly string[] {
  const head = markdownRow(REAL_TABLE_HEAD);
  return [`## Real data, ${REAL.tokenizer}`, realIntro(REAL), bullets(realLines(REAL)), `${TOKENS_NOTE} ${TOON_BEST_NOTE}`, [head, markdownRow(REAL_TABLE_HEAD.map(() => '---')), ...realTableRows(REAL).map(markdownRow)].join('\n'), realMethod(REAL)];
}

function countSections(counters: Counters): readonly string[] {
  if (counters.claude === null) return [BENCH_TABLE_NOTE, countTable(counters.o200k)];
  return counterList(counters).flatMap((counter) => [`## Tokens, ${counter.name}`, BENCH_TABLE_NOTE, countTable(counter)]);
}

/** The answer accuracy section: intro, one table per model, the kind table, the result and the method. */
function accuracyMarkdown(file: AccuracyFile, counters: Counters | null): readonly string[] {
  return [
    '## Answer accuracy',
    accuracyIntro(file),
    bullets(proofLines(file, counters)),
    accuracyOverlapLine(file),
    TUNING_NOTE,
    ...file.models.flatMap((model) => [`### ${model.name}`, accuracyMarkdownTable(model)]),
    ACCURACY_FORMAT_NOTE,
    accuracyRunsNote(file),
    '### By data set',
    kindMarkdownTable(file),
    ACCURACY_KIND_NOTE,
    bullets(accuracyLines(file)),
    '## Accuracy method',
    bullets(accuracyMethod(file)),
    TUNING_DETAIL,
    '### Published runs',
    publishedRunsMarkdownTable(file),
    PUBLISHED_RUNS_NOTE,
  ];
}

/** The benchmark as Markdown, for /benchmark.md and llms-full.txt. Terset comes first in every comparison. */
export function benchmarkMarkdown(bench: BenchFile, claude: ClaudeCounts = NO_CLAUDE, accuracy: AccuracyFile = ACCURACY, stress: StressAccuracyFile = STRESS): string {
  const counters = benchCounters(bench, claude);
  const counts = counters === null ? ['**Numbers pending.** No token counts are published yet.'] : [...countSections(counters), ...sweepSection(bench), ...realSection()];
  const cost = counters === null ? [] : ['## Input cost at list price', ...counterList(counters).map(costTable)];
  const keepElse = benchmarkKeepElseAll(bench, counters, REAL, stress);
  const costLines = benchmarkCostMethod(counters);
  return [
    `# ${BENCHMARK_TITLE}`,
    benchmarkSummary(bench, counters).join(' '),
    bytesLine(BYTES),
    ...workedExampleMarkdown(counters !== null && counters.claude !== null),
    ...counts,
    ...cost,
    ...(keepElse.length > 0 ? ['## When to keep something else', bullets(keepElse)] : []),
    ...accuracyMarkdown(accuracy, counters),
    ...stressMarkdown(stress),
    '## Method',
    bullets(benchmarkMethod(bench, claude)),
    ...(costLines.length > 0 ? ['## Cost method', bullets(costLines)] : []),
    '## Limits',
    bullets(benchmarkLimits(counters)),
  ].join('\n\n');
}
