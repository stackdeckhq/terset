// The table toggle names what a press does: "Show as a table" while closed,
// "Hide table" while open. Both labels are in the markup; the stylesheet shows one.
// Each counter's tables carry its own token counts and its own list price.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BENCH_FIXTURE } from '../data/bench-fixture.dev.ts';
import { FITTED_RULES_NOTE, PRICES, buildCounters, costTotalsRow, formatCount } from '../data/numbers.ts';
import type { Counter } from '../data/numbers.ts';
import { BENCH_TABLE_TOGGLE, BenchTable } from './BenchTable.tsx';

const BENCH_CSS = readFileSync(new URL('../styles/bench.css', import.meta.url), 'utf8');

function fixtureCounter(): Counter {
  if (BENCH_FIXTURE === null) throw new Error('the dev bench fixture is missing');
  const counters = buildCounters(BENCH_FIXTURE, { status: 'pending' }, PRICES);
  if (counters === null) throw new Error('the dev bench fixture is pending');
  return counters.o200k;
}

function render(counter: Counter, open: boolean): string {
  return renderToStaticMarkup(createElement(BenchTable, { counter, open }));
}

function summaryOf(open: boolean): string {
  return /<summary>([\s\S]*?)<\/summary>/u.exec(render(fixtureCounter(), open))?.[1] ?? '';
}

describe('bench table toggle', () => {
  it('carries a show label and a hide label', () => {
    for (const open of [false, true]) {
      const summary = summaryOf(open);
      expect(summary).toContain(`<span class="tbl-show">${BENCH_TABLE_TOGGLE.show}</span>`);
      expect(summary).toContain(`<span class="tbl-hide">${BENCH_TABLE_TOGGLE.hide}</span>`);
    }
  });

  it('shows the hide label only while the table is open', () => {
    expect(BENCH_CSS).toContain('details.tbl[open] .tbl-show, details.tbl:not([open]) .tbl-hide { display: none; }');
  });
});

describe('bench table per counter', () => {
  it('shows the token table and then the cost table, both scrollable by keyboard', () => {
    const counter = fixtureCounter();
    const html = render(counter, true);
    expect(html.match(/<table class="bt">/gu)).toHaveLength(2);
    expect(html.match(/tabindex="0" role="region"/gu)).toHaveLength(2);
    expect(html.indexOf('Bench table, o200k_base tokens')).toBeLessThan(html.indexOf('Cost table, GPT 6.1 Sol'));
    const [, terset, json, delta] = costTotalsRow(counter);
    expect(html).toContain(`<td>${terset}</td><td>${json}</td><td>${delta}</td>`);
    expect(html).toContain('$2 per million input tokens, context up to 272K');
  });

  it('names its counter in the token table caption', () => {
    const counter = fixtureCounter();
    const first = counter.cases[0];
    if (first === undefined) throw new Error('the dev bench fixture has no cases');
    const html = render(counter, false);
    expect(html).toContain('o200k_base tokens per case');
    expect(html).toContain(`<td>${formatCount(first.terset)}</td>`);
  });

  it('says under the token table that each Terset count carries the fitted rules line', () => {
    expect(render(fixtureCounter(), false)).toContain(FITTED_RULES_NOTE);
  });
});
