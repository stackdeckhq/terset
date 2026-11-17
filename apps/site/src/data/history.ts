// Every published number that moved, newest first, with the reason and the public PR.
// The /benchmark page and /benchmark.md both read this file. Each row is proven by
// the data files in that PR; history.test.ts checks that the newest value of every
// metric is what the site shows now, and that the rows chain from old to new.
import { formatCount } from './bench.ts';
import { REPO_URL } from './site.ts';
import { SWEEP } from './sweep.ts';

/** One published number. o200k and claude are the two token counters; opus and sol the two accuracy models. */
export type HistoryMetric =
  | 'o200k-terset'
  | 'o200k-json'
  | 'o200k-toon'
  | 'o200k-under-json'
  | 'o200k-under-toon'
  | 'o200k-cases-under-json'
  | 'o200k-cases-under-toon'
  | 'claude-terset'
  | 'claude-json'
  | 'claude-toon'
  | 'claude-under-json'
  | 'claude-under-toon'
  | 'claude-cases-under-json'
  | 'claude-cases-under-toon'
  | 'opus-correct'
  | 'opus-token-saving'
  | 'opus-cost-saving'
  | 'sol-correct'
  | 'sol-token-saving'
  | 'sol-cost-saving'
  | 'calls';

type Unit = { readonly kind: 'tokens' } | { readonly kind: 'percent' } | { readonly kind: 'count' } | { readonly kind: 'share'; readonly of: number };

const TOKENS: Unit = { kind: 'tokens' };
const PERCENT: Unit = { kind: 'percent' };
const CASES: Unit = { kind: 'share', of: 11 };
const QUESTIONS: Unit = { kind: 'share', of: 244 };

const METRICS: Readonly<Record<HistoryMetric, { readonly label: string; readonly unit: Unit }>> = {
  'o200k-terset': { label: 'Terset total', unit: TOKENS },
  'o200k-json': { label: 'Compact JSON total', unit: TOKENS },
  'o200k-toon': { label: "TOON's best total", unit: TOKENS },
  'o200k-under-json': { label: 'Under compact JSON', unit: PERCENT },
  'o200k-under-toon': { label: 'Under TOON', unit: PERCENT },
  'o200k-cases-under-json': { label: 'Cases under compact JSON', unit: CASES },
  'o200k-cases-under-toon': { label: 'Cases under TOON', unit: CASES },
  'claude-terset': { label: 'Terset total', unit: TOKENS },
  'claude-json': { label: 'Compact JSON total', unit: TOKENS },
  'claude-toon': { label: "TOON's best total", unit: TOKENS },
  'claude-under-json': { label: 'Under compact JSON', unit: PERCENT },
  'claude-under-toon': { label: 'Under TOON', unit: PERCENT },
  'claude-cases-under-json': { label: 'Cases under compact JSON', unit: CASES },
  'claude-cases-under-toon': { label: 'Cases under TOON', unit: CASES },
  'opus-correct': { label: 'Opus 5.5, Terset right answers', unit: QUESTIONS },
  'opus-token-saving': { label: 'Opus 5.5, fewer input tokens than compact JSON', unit: PERCENT },
  'opus-cost-saving': { label: 'Opus 5.5, lower cost than compact JSON', unit: PERCENT },
  'sol-correct': { label: 'Sol, Terset right answers', unit: QUESTIONS },
  'sol-token-saving': { label: 'Sol, fewer input tokens than compact JSON', unit: PERCENT },
  'sol-cost-saving': { label: 'Sol, lower cost than compact JSON', unit: PERCENT },
  calls: { label: 'Calls in the accuracy tables', unit: { kind: 'count' } },
};

export interface HistoryChange {
  readonly metric: HistoryMetric;
  readonly from: number;
  readonly to: number;
  /** A few words after the new value, such as how a mean was made. */
  readonly note?: string;
}

export interface HistoryRow {
  readonly date: string;
  /** What the numbers in this row are, such as "o200k_base counts". */
  readonly area: string;
  readonly changes: readonly HistoryChange[];
  readonly why: string;
  /** The public PR number, or null while the change is not merged. */
  readonly pr: number | null;
}

const FITTED_RULES_WHY = '`rulesFor(text)` now sends only the rules each text needs. The encoded data did not change.';
const OPEN_CASES_WHY =
  'The 11 case inputs were not public. Open cases, built from a fixed seed, replaced them. The same change set a new table header order. The PR does not split the move between the two.';

/** Newest first. Rows only for moves a public PR's data files prove. */
export const HISTORY: readonly HistoryRow[] = [
  {
    date: '2026-11-17',
    area: 'Answer accuracy',
    changes: [
      { metric: 'sol-correct', from: 242, to: 240, note: 'mean of 238 and 242' },
      { metric: 'opus-cost-saving', from: 29.8, to: 29.9 },
      { metric: 'sol-cost-saving', from: 26.2, to: 26.4 },
      { metric: 'calls', from: 1952, to: 2440 },
    ],
    why: 'The tables showed one of the two Terset runs from 2026-11-17. They now show the mean of both.',
    pr: null,
  },
  {
    date: '2026-11-17',
    area: 'o200k_base counts',
    changes: [
      { metric: 'o200k-terset', from: 43_348, to: 43_044 },
      { metric: 'o200k-under-json', from: 26.3, to: 26.8 },
      { metric: 'o200k-under-toon', from: 5.9, to: 6.6 },
      { metric: 'o200k-cases-under-json', from: 9, to: 10 },
      { metric: 'o200k-cases-under-toon', from: 8, to: 9 },
    ],
    why: FITTED_RULES_WHY,
    pr: 7,
  },
  {
    date: '2026-11-17',
    area: 'Claude counts',
    changes: [
      { metric: 'claude-terset', from: 59_152, to: 58_582 },
      { metric: 'claude-under-json', from: 31.3, to: 32.0 },
      { metric: 'claude-under-toon', from: 3.6, to: 4.5 },
      { metric: 'claude-cases-under-json', from: 9, to: 10 },
      { metric: 'claude-cases-under-toon', from: 6, to: 10 },
    ],
    why: FITTED_RULES_WHY,
    pr: 7,
  },
  {
    date: '2026-11-17',
    area: 'Answer accuracy',
    changes: [
      { metric: 'opus-correct', from: 243, to: 242 },
      { metric: 'sol-correct', from: 241, to: 242 },
      { metric: 'opus-token-saving', from: 32.0, to: 32.7 },
      { metric: 'sol-token-saving', from: 26.7, to: 27.3 },
      { metric: 'opus-cost-saving', from: 29.2, to: 29.8 },
      { metric: 'sol-cost-saving', from: 25.8, to: 26.2 },
    ],
    why: 'Terset was run again with fitted rules. The 2026-11-17 run replaced the 2026-11-13 run.',
    pr: 7,
  },
  {
    date: '2026-11-17',
    area: 'o200k_base counts',
    changes: [
      { metric: 'o200k-terset', from: 44_045, to: 43_348 },
      { metric: 'o200k-json', from: 56_248, to: 58_808 },
      { metric: 'o200k-toon', from: 47_753, to: 46_068 },
      { metric: 'o200k-under-json', from: 21.7, to: 26.3 },
      { metric: 'o200k-under-toon', from: 7.8, to: 5.9 },
      { metric: 'o200k-cases-under-toon', from: 11, to: 8 },
    ],
    why: OPEN_CASES_WHY,
    pr: 6,
  },
  {
    date: '2026-11-17',
    area: 'Claude counts',
    changes: [
      { metric: 'claude-terset', from: 64_499, to: 59_152 },
      { metric: 'claude-json', from: 85_717, to: 86_102 },
      { metric: 'claude-toon', from: 67_220, to: 61_360 },
      { metric: 'claude-under-json', from: 24.8, to: 31.3 },
      { metric: 'claude-under-toon', from: 4.0, to: 3.6 },
    ],
    why: OPEN_CASES_WHY,
    pr: 6,
  },
];

/** The plain paragraph under the table, on what the numbers are and are not checked against. */
export const HISTORY_NOTE = `The rules line was tuned with these ${String(SWEEP.cases.length)} case shapes and the TOON question set in view. So they are not independent checks of it. The sweep across ${formatCount(SWEEP.seeds)} seeds above draws new data for the same shapes. A held-out stress suite is in progress. Real data that nothing was tuned on is in the Real data section above.`;

export const HISTORY_TABLE_HEAD = ['Date', 'What changed (old to new)', 'Why', 'Public PR'] as const;

export type HistoryTableRow = readonly [date: string, changed: string, why: string, pr: string];

function value(amount: number, unit: Unit): string {
  return unit.kind === 'percent' ? `${amount.toFixed(1)}%` : formatCount(amount);
}

function changeText(change: HistoryChange): string {
  const { label, unit } = METRICS[change.metric];
  const tail = unit.kind === 'tokens' ? ' tokens' : unit.kind === 'share' ? ` of ${formatCount(unit.of)}` : '';
  const note = change.note === undefined ? '' : ` (${change.note})`;
  return `${label}: ${value(change.from, unit)} to ${value(change.to, unit)}${tail}${note}.`;
}

/** "#7", or "Not merged yet" while the change has no public PR. */
export function prLabel(pr: number | null): string {
  return pr === null ? 'Not merged yet' : `#${String(pr)}`;
}

/** The public PR's address, or null while the change is not merged. */
export function prUrl(pr: number | null): string | null {
  return pr === null ? null : `${REPO_URL}/pull/${String(pr)}`;
}

/** The "what changed" cell as lines: the area, then one line per change. The page shows one per line. */
export function historyChangeLines(row: HistoryRow): readonly string[] {
  return [`${row.area}.`, ...row.changes.map(changeText)];
}

/** One row of cells per history row, in HISTORY_TABLE_HEAD order. */
export function historyTableRows(rows: readonly HistoryRow[]): readonly HistoryTableRow[] {
  return rows.map((row) => [row.date, historyChangeLines(row).join(' '), row.why, prLabel(row.pr)]);
}
