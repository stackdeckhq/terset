// The proof charts render real text for every number, mark wins and keep losses in view,
// and the full tables sit behind one keyboard-usable toggle.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ACCURACY } from '../data/accuracy.ts';
import { COUNTERS } from '../data/numbers.ts';
import { FULL_TABLES_TOGGLE, FullTables } from './FullTables.tsx';
import { BigNumbers, CostBars, DatasetChart } from './Proof.tsx';

const BENCH_CSS = readFileSync(new URL('../styles/bench.css', import.meta.url), 'utf8');

describe('big numbers', () => {
  const html = renderToStaticMarkup(createElement(BigNumbers, { file: ACCURACY }));

  it('prints each value as text, wins marked, accuracy plain', () => {
    expect(html.match(/<li class="big-n win">/gu)).toHaveLength(2);
    expect(html).toContain('<li class="big-n">');
    for (const text of ['32.7%', '27.3%', '29.9%', '26.1%']) expect(html).toContain(`<b>${text}</b>`);
    // The mean of the Terset runs: 242 on Opus and 242 on Sol.
    expect(html.match(/<b>242<span class="big-t">\/244<\/span><\/b>/gu)).toHaveLength(2);
  });

  it('names the metric first, then one column per model with the model before its number', () => {
    const cards = html.match(/<li class="big-n[^"]*">.*?<\/li>/gu) ?? [];
    expect(cards).toHaveLength(3);
    for (const [index, metric] of ['Fewer input tokens than compact JSON', 'Lower cost than compact JSON', 'Right answers, mean of the Terset runs'].entries()) {
      const card = cards[index] ?? '';
      expect(card).toMatch(new RegExp(`^<li class="big-n[^"]*"><span class="big-l">${metric}</span> <span class="big-v">`, 'u'));
      expect(card.match(/<span class="big-c"><small>(Opus|Sol)<\/small> <b>/gu)).toHaveLength(2);
    }
  });

  it('leaves the tie sentence to the section heading', () => {
    expect(html).not.toContain('Accuracy is a tie.');
  });

  it('splits each card into two equal columns with a thin line between them', () => {
    expect(BENCH_CSS).toMatch(/\.big-v \{ [^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
    expect(BENCH_CSS).toMatch(/\.big-c \+ \.big-c \{ [^}]*border-left: 1px solid var\(--line\);/u);
    expect(BENCH_CSS).toMatch(/\.big-c b \{ [^}]*font-variant-numeric: tabular-nums;[^}]*white-space: nowrap;/u);
    expect(BENCH_CSS).toMatch(/\.big-n\.win \.big-c b \{ color: var\(--accent\); \}/u);
  });
});

describe('cost bars', () => {
  it('dates every row, says which costs are a mean of runs, and marks the Terset row', () => {
    const html = renderToStaticMarkup(createElement(CostBars, { file: ACCURACY, headingId: 'h', title: 'Cost' }));
    expect(html.match(/class="cost-bar terset[ "]/gu)).toHaveLength(2);
    // One short line each, so the Terset label fits the value column beside the bar.
    // Opus Terset is a mean of 2 runs. Every Sol row is a mean of its 3 matched runs.
    expect(html.match(/<small>mean of 2 runs<\/small><small>2026-11-17<\/small>/gu)).toHaveLength(1);
    expect(html.match(/<small>mean of 3 runs<\/small><small>2026-11-17<\/small>/gu)).toHaveLength(4);
    expect(html.match(/run 2026-11-12/gu)).toHaveLength(3);
    expect(html).toContain('<b>$5.64</b>');
    expect(html).toContain('<b>$1.84</b>');
  });

  it('marks the cheapest format per model, and only the Terset number is accent', () => {
    for (const model of ACCURACY.models) {
      const html = renderToStaticMarkup(createElement(CostBars, { file: { ...ACCURACY, models: [model] }, headingId: 'h' }));
      const cheapest = Math.min(...model.rows.map((row) => row.totalCost));
      const marked = model.rows.filter((row) => row.totalCost === cheapest);
      expect(html.match(/class="cost-bar[^"]* min"/gu)).toHaveLength(marked.length);
    }
    expect(BENCH_CSS).toMatch(/\.cost-v b \{ [^}]*font-weight: 400;/u);
    expect(BENCH_CSS).toMatch(/\.cost-bar\.min \.cost-v b \{ [^}]*font-weight: 700;/u);
    expect(BENCH_CSS).toMatch(/\.cost-bar\.min \.cost-t i \{ [^}]*background: var\(--c-other-bar-strong\);/u);
    expect(BENCH_CSS).toMatch(/\.cost-bar\.terset \.cost-v b \{ [^}]*color: var\(--accent\);/u);
  });
});

describe('data set chart', () => {
  const html = renderToStaticMarkup(createElement(DatasetChart, { file: ACCURACY, headingId: 'ds-h' }));

  it('draws 13 rows per model, each with a spoken line', () => {
    expect(html.match(/<li class="ds-row/gu)).toHaveLength(26);
    expect(html.match(/<span class="sr">/gu)).toHaveLength(26);
  });

  it('shows the nested config loss against compact JSON, and no tie against TOON', () => {
    expect(html.match(/<span class="dv more">/gu)).toHaveLength(2);
    expect(html).toContain('<b class="dv-v">+1.5%</b>');
    expect(html).toContain('<b class="dv-v">+5.4%</b>');
    expect(html).not.toContain('<span class="dv tie">');
  });

  it('names the tokenizer per model', () => {
    expect(html).toContain('<span class="tok">Claude tokenizer</span>');
    expect(html).toContain('<span class="tok">OpenAI tokenizer</span>');
  });
});

describe('full tables toggle', () => {
  it('is a closed details element with a show label and a hide label', () => {
    const html = renderToStaticMarkup(createElement(FullTables, { file: ACCURACY, counters: COUNTERS }));
    expect(html.startsWith('<details class="tbl full">')).toBe(true);
    expect(html).toContain(`<span class="tbl-show">${FULL_TABLES_TOGGLE.show}</span>`);
    expect(html).toContain(`<span class="tbl-hide">${FULL_TABLES_TOGGLE.hide}</span>`);
    expect(html).not.toContain('<details class="tbl" ');
    expect(BENCH_CSS).toContain('details.tbl[open] .tbl-show, details.tbl:not([open]) .tbl-hide { display: none; }');
  });
});
