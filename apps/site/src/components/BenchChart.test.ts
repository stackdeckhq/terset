// The counter switch shows only when both counters are ready. On the server the
// chart starts on o200k_base, and a pending Claude file leaves the o200k_base view.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BENCH, COUNTERS, PRICES, buildCounters, counterSummary } from '../data/numbers.ts';
import type { Counter, Counters } from '../data/numbers.ts';
import { BenchChart } from './BenchChart.tsx';

const BENCH_CSS = readFileSync(new URL('../styles/bench.css', import.meta.url), 'utf8');

function render(counters: Counters | null): string {
  return renderToStaticMarkup(createElement(BenchChart, { bench: BENCH, counters, headingId: 'h' }));
}

function ready(): Counters {
  if (COUNTERS === null) throw new Error('the bench file is pending');
  return COUNTERS;
}

describe('bench chart counter switch', () => {
  it('shows two buttons when both counters are ready, o200k_base pressed', () => {
    const counters = ready();
    if (counters.claude === null) throw new Error('the Claude file is pending');
    const html = render(counters);
    expect(html).toContain('<div class="ctr" role="group" aria-label="Count tokens with">');
    expect(html).toContain('<button type="button" aria-pressed="true">OpenAI o200k_base</button>');
    expect(html).toContain('<button type="button" aria-pressed="false">Claude Opus 5.5</button>');
    expect(html).toContain('data-counter="o200k"');
    expect(html).toContain(counterSummary(counters.o200k).replaceAll("'", '&#x27;'));
  });

  it('drops the switch and keeps the o200k_base view when the Claude file is pending', () => {
    const single = buildCounters(BENCH, { status: 'pending' }, PRICES);
    const html = render(single);
    expect(html).not.toContain('class="ctr"');
    expect(html).not.toContain('Claude');
    expect(html).toContain('data-counter="o200k"');
    expect(html).toContain('<ul class="bars">');
  });

  it('shows the pending state when there are no counters', () => {
    const html = render(null);
    expect(html).not.toContain('class="ctr"');
    expect(html).toContain('Numbers pending');
  });
});

// Color says who, weight says who won: every format but Terset is one gray, and
// the smallest count in a case carries the `min` class that makes it bold.
const SERIES_KEYS = ['terset', 'json', 'yaml', 'toon'] as const;

/** The markup of each case row, keyed by case name. */
function rowsOf(html: string): ReadonlyMap<string, string> {
  const rows = html.split('<li class="bar').slice(1);
  return new Map(rows.map((row) => [/<div class="bar-l">([^<]*)<\/div>/u.exec(row)?.[1] ?? '', row]));
}

function expectMinMarks(counter: Counter, html: string): void {
  const rows = rowsOf(html);
  expect(rows.size).toBe(counter.cases.length);
  for (const row of counter.cases) {
    const markup = rows.get(row.name.replaceAll("'", '&#x27;')) ?? '';
    const fewest = Math.min(...SERIES_KEYS.map((key) => row[key]));
    for (const key of SERIES_KEYS) expect(markup).toContain(row[key] === fewest ? `class="brow ${key} min"` : `class="brow ${key}"`);
  }
}

describe('bench chart bar marks', () => {
  it('marks the smallest count in every o200k_base case, including the table-free config', () => {
    const counters = ready();
    const html = render(counters);
    expectMinMarks(counters.o200k, html);
    const nested = rowsOf(html).get('Deep nested config') ?? '';
    expect(nested).toContain('class="brow json min"');
    expect(nested).toContain('class="brow terset"');
  });

  it('marks the smallest count in every Claude case', () => {
    const counters = ready();
    if (counters.claude === null) throw new Error('the Claude file is pending');
    expectMinMarks(counters.claude, render({ o200k: counters.claude, claude: null }));
  });

  it('has a two-entry legend: Terset and other formats', () => {
    const legend = /<div class="legend"[^>]*>(.*?)<\/div>/u.exec(render(ready()))?.[1] ?? '';
    expect(legend.match(/<i /gu)).toHaveLength(2);
    expect(legend).toContain('<i class="terset"></i>Terset, rules included');
    expect(legend).toContain('<i class="other"></i>Other formats');
  });

  it('paints every bar but Terset one gray, the fewest one step stronger', () => {
    const series = BENCH_CSS.match(/--c-(?:json|yaml|toon)(?:-bar)?\b/gu);
    expect(series).toBeNull();
    for (const selector of ['.brow i', '.legend i.other', '.cost-t i', '.dv.more .dv-t i']) expect(BENCH_CSS).toContain(`${selector} { `);
    expect(BENCH_CSS).toMatch(/\.brow i \{ [^}]*background: var\(--c-other-bar\);/u);
    expect(BENCH_CSS).toMatch(/\.brow\.min i \{ [^}]*background: var\(--c-other-bar-strong\);/u);
    expect(BENCH_CSS).toMatch(/\.legend i\.other \{ [^}]*background: var\(--c-other-bar\);/u);
    expect(BENCH_CSS).toMatch(/\.cost-t i \{ [^}]*background: var\(--c-other-bar\);/u);
    expect(BENCH_CSS).toMatch(/\.dv\.more \.dv-t i \{ [^}]*background: var\(--c-other-bar\);/u);
  });

  it('highlights a delta only when Terset uses fewer tokens; losses stay plain', () => {
    const counters = ready();
    if (counters.claude === null) throw new Error('the Claude file is pending');
    for (const counter of [counters.o200k, counters.claude]) {
      const rows = rowsOf(render({ o200k: counter, claude: null }));
      for (const row of counter.cases) {
        const delta = /<div class="bar-v"[^>]*>(.*?)<\/div>/u.exec(rows.get(row.name.replaceAll("'", '&#x27;')) ?? '')?.[1] ?? '';
        expect(delta).toContain(row.terset < row.toon ? '<span class="fewer">' : '<span>');
        expect(delta).toContain(row.terset < row.json ? '<small class="fewer">' : '<small>');
      }
    }
    expect(BENCH_CSS).not.toContain('--minus');
    expect(BENCH_CSS).toMatch(/\.bar-v \{ [^}]*color: var\(--fg-2\);/u);
    expect(BENCH_CSS).toMatch(/\.bar-v \.fewer \{ [^}]*color: var\(--accent\);[^}]*font-weight: 700;/u);
  });

  it('makes only the smallest count bold; Terset stays accent either way', () => {
    expect(BENCH_CSS).toMatch(/\.btrack em \{ [^}]*font-weight: 400;/u);
    expect(BENCH_CSS).toMatch(/\.brow\.min em \{ [^}]*font-weight: 700;[^}]*color: var\(--fg\);/u);
    expect(BENCH_CSS).toMatch(/\.brow\.terset em \{ [^}]*color: var\(--accent\);/u);
    expect(BENCH_CSS).not.toMatch(/\.brow\.terset em \{ [^}]*font-weight/u);
    expect(BENCH_CSS).toMatch(/\.brow\.terset\.min em \{ [^}]*color: var\(--accent\);[^}]*font-weight: 700;/u);
  });
});
