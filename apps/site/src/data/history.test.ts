// The number history is pinned to the data: the newest value of every metric is what
// the site shows now, and each older row hands on the value the next one starts from.
import { describe, expect, it } from 'vitest';
import { ACCURACY, formatRow } from './accuracy.ts';
import type { AccuracyModel } from './accuracy.ts';
import { benchmarkMarkdown } from './benchmark-doc.ts';
import { HISTORY, HISTORY_NOTE, HISTORY_TABLE_HEAD, historyTableRows } from './history.ts';
import type { HistoryMetric } from './history.ts';
import { BENCH_FILE, CLAUDE_FILE, PRICES, benchTotals, buildCounters, underJson, underToon } from './numbers.ts';
import type { CaseSet } from './numbers.ts';

const COUNTED = buildCounters(BENCH_FILE, CLAUDE_FILE, PRICES);

function model(id: string): AccuracyModel {
  const found = ACCURACY.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

/** Percent under `base`, one decimal, as the site rounds it. */
function under(value: number, base: number): number {
  return Math.round(((base - value) / base) * 1000) / 10;
}

function counterValues(prefix: 'o200k' | 'claude', cases: CaseSet): Partial<Record<HistoryMetric, number>> {
  const totals = benchTotals(cases);
  return {
    [`${prefix}-terset`]: totals.terset,
    [`${prefix}-json`]: totals.json,
    [`${prefix}-toon`]: totals.toon,
    [`${prefix}-under-json`]: under(totals.terset, totals.json),
    [`${prefix}-under-toon`]: under(totals.terset, totals.toon),
    [`${prefix}-cases-under-json`]: underJson(cases),
    [`${prefix}-cases-under-toon`]: underToon(cases),
  };
}

function accuracyValues(prefix: 'opus' | 'sol', item: AccuracyModel): Partial<Record<HistoryMetric, number>> {
  const terset = formatRow(item, 'terset');
  const json = formatRow(item, 'json-compact');
  return {
    [`${prefix}-correct`]: terset.correct,
    [`${prefix}-token-saving`]: under(terset.inputTokens, json.inputTokens),
    [`${prefix}-cost-saving`]: under(terset.totalCost, json.totalCost),
  };
}

/** What the site shows today for every metric the history tracks. */
function currentValues(): Record<HistoryMetric, number> {
  if (COUNTED === null || COUNTED.claude === null) throw new Error('the committed bench and Claude files should be ready');
  return {
    ...counterValues('o200k', COUNTED.o200k),
    ...counterValues('claude', COUNTED.claude),
    ...accuracyValues('opus', model('claude-opus-5-5')),
    ...accuracyValues('sol', model('gpt-6.1-sol')),
    calls: ACCURACY.calls,
  } as Record<HistoryMetric, number>;
}

describe('number history', () => {
  it('ends every metric on the number the site shows now', () => {
    const now = currentValues();
    const seen = new Set<HistoryMetric>();
    // Newest row first: the first row that names a metric holds its current value.
    for (const row of HISTORY) {
      for (const change of row.changes) {
        if (seen.has(change.metric)) continue;
        seen.add(change.metric);
        expect([change.metric, change.to]).toEqual([change.metric, now[change.metric]]);
      }
    }
  });

  it('pins the newest row to the current headline accuracy and cost', () => {
    const newest = HISTORY[0];
    // The matched batches: every row on both models is the mean of three runs on 2026-11-17.
    expect(newest?.changes.map((change) => [change.metric, change.from, change.to])).toEqual([
      ['opus-correct', 242, 243],
      ['opus-cost-saving', 29.9, 29.8],
      ['sol-correct', 240, 242],
      ['sol-cost-saving', 26.4, 26.1],
      ['calls', 2440, 5856],
    ]);
    expect(formatRow(model('claude-opus-5-5'), 'terset').runs.map((run) => run.correct)).toEqual([243, 243, 243]);
    expect(newest?.changes[0]?.note).toBe('243 in all three runs');
    expect(formatRow(model('gpt-6.1-sol'), 'terset').runs.map((run) => run.correct)).toEqual([242, 241, 243]);
    expect(newest?.changes[2]?.note).toBe('mean of 242, 241 and 243');
  });

  it('chains each metric: an older row ends where the next newer row starts', () => {
    const last = new Map<HistoryMetric, number>();
    for (const row of HISTORY) {
      for (const change of row.changes) {
        const newer = last.get(change.metric);
        if (newer !== undefined) expect([change.metric, change.to]).toEqual([change.metric, newer]);
        last.set(change.metric, change.from);
      }
    }
  });

  it('lists rows newest first, each with a real move and a reason', () => {
    const dates = HISTORY.map((row) => row.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const row of HISTORY) {
      expect(row.why).not.toBe('');
      for (const change of row.changes) expect(change.from).not.toBe(change.to);
    }
    expect(HISTORY.map((row) => row.pr)).toEqual([null, null, 7, 7, 7, 6, 6]);
  });

  it('prints the fitted rules move in the table, with the old number first', () => {
    const rows = historyTableRows(HISTORY);
    expect(HISTORY_TABLE_HEAD).toEqual(['Date', 'What changed (old to new)', 'Why', 'Public PR']);
    expect(rows[0]?.[1]).toBe('Answer accuracy. Opus 5.5, Terset right answers: 242 to 243 of 244 (243 in all three runs). Opus 5.5, lower cost than compact JSON: 29.9% to 29.8%. Sol, Terset right answers: 240 to 242 of 244 (mean of 242, 241 and 243). Sol, lower cost than compact JSON: 26.4% to 26.1%. Calls in the accuracy tables: 2,440 to 5,856.');
    expect(rows[2]?.[1]).toContain('Terset total: 43,348 to 43,044 tokens.');
    expect(rows[2]?.[1]).toContain('Under TOON: 5.9% to 6.6%.');
    expect(rows[2]?.[3]).toBe('#7');
    expect(rows[5]?.[1]).toContain('Cases under TOON: 11 to 8 of 11.');
    expect(rows[0]?.[3]).toBe('Not merged yet');
    expect(rows[1]?.[3]).toBe('Not merged yet');
  });

  it('puts the table and the note in benchmark.md', () => {
    const text = benchmarkMarkdown(BENCH_FILE, CLAUDE_FILE);
    expect(text).toContain('## Number history');
    expect(text).toContain('| Date | What changed (old to new) | Why | Public PR |');
    expect(text).toContain('[#7](https://github.com/stackdeckhq/terset/pull/7)');
    expect(text).toContain(HISTORY_NOTE);
    expect(HISTORY_NOTE).toContain('not independent checks');
    expect(HISTORY_NOTE).not.toMatch(/\d{4}-\d{2}-\d{2}/u);
  });
});
