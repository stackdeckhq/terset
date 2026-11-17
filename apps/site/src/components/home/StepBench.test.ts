// Step 6 follows the chart's counter tab: the headline, its tag, its line and the six
// orders all come from the picked counter's data. The server renders o200k_base, and
// every other tab's text sits hidden in the same cell, so a switch moves nothing.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Trio } from '../../data/bench-schema.ts';
import { BENCH, COUNTERS, formatCount, pct, underJson, underToon } from '../../data/numbers.ts';
import type { Counter, CounterId, Counters } from '../../data/numbers.ts';
import { StepBench, benchViews } from './StepBench.tsx';

// The step's one link needs a router; a plain anchor is enough for its markup.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, hash, children }: { readonly to: string; readonly hash?: string; readonly children: ReactNode }) => createElement('a', { href: hash === undefined ? to : `${to}#${hash}` }, children),
}));

const HOME_CSS = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8');

function ready(): Counters & { readonly claude: Counter } {
  if (COUNTERS === null || COUNTERS.claude === null) throw new Error('the bench or the Claude counts are pending');
  return { ...COUNTERS, claude: COUNTERS.claude };
}

describe('step 6 views', () => {
  it('gives each tab the headline, tag, line and six orders of its own counter', () => {
    const counters = ready();
    const views = benchViews(BENCH, counters);
    expect(views.map((view) => view.id)).toEqual(['o200k', 'claude']);
    for (const view of views) {
      const counter = counters[view.id];
      const total = counter.cases.length;
      expect(view.headline.title).toBe(`Fewer tokens than TOON in ${String(underToon(counter))} of ${String(total)} cases.`);
      expect(view.headline.line).toBe(`Fewer than compact JSON in ${String(underJson(counter))} of ${String(total)}.`);
      expect(view.orders).toEqual(counter.samples.orders);
    }
    const [open, claude] = views;
    expect(open?.headline).toEqual({ title: 'Fewer tokens than TOON in 9 of 11 cases.', tag: 'OpenAI tokenizer', line: 'Fewer than compact JSON in 10 of 11.' });
    expect(claude?.headline).toEqual({ title: 'Fewer tokens than TOON in 10 of 11 cases.', tag: 'Claude Opus 5.5', line: 'Fewer than compact JSON in 10 of 11.' });
    expect(open?.orders).toEqual(BENCH.status === 'ready' ? BENCH.samples.orders : null);
    expect(claude?.orders).toEqual(counters.claude.samples.orders);
    expect(open?.foot).toContain('The six orders above use o200k_base.');
    expect(claude?.foot).toContain("The six orders above use Claude's token count.");
  });

  it('shows one view, o200k_base only, while the Claude counts are pending', () => {
    const views = benchViews(BENCH, { ...ready(), claude: null });
    expect(views.map((view) => view.id)).toEqual(['o200k']);
    expect(views[0]?.ordersLabel).toBe('Tokens for the six orders');
  });

  it('shows pending while the bench is pending', () => {
    const views = benchViews(BENCH, null);
    expect(views.map((view) => [view.id, view.orders, view.headline.tag, view.headline.line])).toEqual([['o200k', null, null, null]]);
  });
});

describe('step 6 markup', () => {
  const html = renderToStaticMarkup(createElement(StepBench)).replaceAll('&#x27;', "'");

  /** The inner markup of every element that opens with `open`, in document order, nested spans counted. */
  function inner(open: string): readonly string[] {
    const found: string[] = [];
    for (let start = html.indexOf(open); start >= 0; start = html.indexOf(open, start + 1)) {
      const body = start + open.length;
      const tags = /<span\b[^>]*>|<\/span>/gu;
      tags.lastIndex = body;
      let depth = 1;
      for (let tag = tags.exec(html); tag !== null; tag = tags.exec(html)) {
        depth += tag[0] === '</span>' ? -1 : 1;
        if (depth === 0) {
          found.push(html.slice(body, tag.index));
          break;
        }
      }
    }
    return found;
  }
  const on = (id: CounterId): readonly string[] => inner(`<span class="swap-on" data-counter="${id}">`);
  const off = (id: CounterId): readonly string[] => inner(`<span class="swap-off" data-counter="${id}">`);
  const trio = (orders: Trio): readonly string[] => [formatCount(orders.terset), `${pct(orders.terset, orders.json)} against JSON`, formatCount(orders.json), formatCount(orders.toon)];

  it('renders the o200k_base tab on the server and keeps the Claude tab hidden in the same cells', () => {
    const counters = ready();
    const [open, claude] = benchViews(BENCH, counters);
    if (open === undefined || claude === undefined) throw new Error('Expected two views');
    expect(on('o200k')).toEqual([`${open.headline.title} <span class="tok">OpenAI tokenizer</span>`, open.headline.line, ...trio(counters.o200k.samples.orders), open.foot]);
    expect(off('claude')).toEqual([`${claude.headline.title} <span class="tok">Claude Opus 5.5</span>`, claude.headline.line, ...trio(counters.claude.samples.orders), claude.foot]);
    expect(on('claude')).toEqual([]);
    expect(off('o200k')).toEqual([]);
    expect(trio(counters.o200k.samples.orders)).toEqual(['314', '−11.8% against JSON', '356', '405']);
    expect(html).toContain('data-counter="o200k"><div class="chart-top">');
  });

  it('announces the heading and line politely when they change', () => {
    expect(html).toMatch(/<div class="step-head" aria-live="polite" aria-atomic="true"><h2 id="h-b6"><span class="swap">.*?<\/h2><p class="line"><span class="swap">.*?<\/p><\/div>/u);
  });

  it('stacks every version in one cell and hides the others from eyes and screen readers', () => {
    expect(HOME_CSS).toMatch(/\.swap \{ display: inline-grid; \}/u);
    expect(HOME_CSS).toMatch(/\.swap > span \{ grid-area: 1 \/ 1; \}/u);
    expect(HOME_CSS).toMatch(/\.swap > \.swap-off \{ visibility: hidden; \}/u);
    // The trio label rule must not reach the swap spans inside the numbers.
    expect(HOME_CSS).not.toMatch(/\.trio span \{/u);
  });
});
