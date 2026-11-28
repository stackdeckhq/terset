// The totals chart at the top of home step 6: one bar per format with its sum over every
// case, Terset first. Its numbers are benchTotals() of the picked counter, and every one is
// in the server markup, so the chart reads the same with JavaScript off.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { COUNTERS, TOON_BEST_NOTE, benchTotals, counterList, formatCount, lossesLine } from '../data/numbers.ts';
import type { CounterId, Counters } from '../data/numbers.ts';
import { TotalsChart, totalsBars } from './TotalsChart.tsx';

// The footnote link needs a router; a plain anchor is enough for its markup.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, hash, children }: { readonly to: string; readonly hash?: string; readonly children: ReactNode }) => createElement('a', { href: hash === undefined ? to : `${to}#${hash}` }, children),
}));

const BENCH_CSS = readFileSync(new URL('../styles/bench.css', import.meta.url), 'utf8');
const BENCHMARK_ROUTE = readFileSync(new URL('../routes/benchmark.tsx', import.meta.url), 'utf8');

function ready(): Counters {
  if (COUNTERS === null) throw new Error('the bench file is pending');
  if (COUNTERS.claude === null) throw new Error('the Claude file is pending');
  return COUNTERS;
}

function render(counters: Counters | null, picked: CounterId): string {
  return renderToStaticMarkup(createElement(TotalsChart, { counters, picked, onPick: () => undefined })).replaceAll('&#x27;', "'");
}

/** Each bar's label and shown count, in document order. */
function shown(html: string): readonly (readonly [string, string])[] {
  return [...html.matchAll(/<span class="cost-l">([^<]*)<\/span>.*?<span class="cost-v"><b>([^<]*)<\/b>/gu)].map((match) => [match[1] ?? '', match[2] ?? '']);
}

describe('totals chart', () => {
  it('shows benchTotals() of each counter, Terset first, then TOON best, compact JSON, YAML and pretty JSON', () => {
    const counters = ready();
    for (const counter of counterList(counters)) {
      const totals = benchTotals(counter);
      expect(shown(render(counters, counter.id))).toEqual([
        ['Terset', formatCount(totals.terset)],
        ['TOON best', formatCount(totals.toon)],
        ['Compact JSON', formatCount(totals.json)],
        ['YAML', formatCount(totals.yaml)],
        ['Pretty JSON', formatCount(totals.jsonPretty)],
      ]);
    }
    expect(shown(render(counters, 'o200k')).map(([, count]) => count)).toEqual(['43,228', '46,068', '58,808', '70,846', '87,020']);
  });

  it('scales every bar to the largest total and paints only Terset in the accent', () => {
    const counters = ready();
    const bars = totalsBars(counters.o200k);
    const totals = benchTotals(counters.o200k);
    const max = Math.max(totals.terset, totals.toon, totals.json, totals.yaml, totals.jsonPretty);
    for (const bar of bars) expect(bar.fraction).toBeCloseTo(bar.total / max, 10);
    expect(bars.filter((bar) => bar.terset).map((bar) => bar.label)).toEqual(['Terset']);
    const html = render(counters, 'o200k');
    expect(html).toContain('<li class="cost-bar terset min"><span class="cost-l">Terset</span>');
    expect(html.match(/class="cost-bar terset/gu)).toHaveLength(1);
  });

  it('renders the o200k_base counter on the server, static bars first, with the switch', () => {
    const html = render(ready(), 'o200k');
    expect(html).toContain('class="chart totals pre"');
    expect(html).toContain('data-counter="o200k"');
    expect(html).toContain('<button type="button" aria-pressed="true">OpenAI o200k_base</button>');
    // Home also shows the per-case chart's switch, so this group needs a name of its own.
    expect(html).toContain('<div class="ctr" role="group" aria-label="Count the totals with">');
    // Bar widths are inline, so the server HTML draws them with no script.
    expect(html.match(/style="--f:[0-9.]+;--i:\d+"/gu)).toHaveLength(5);
  });

  it('says lower is better, how many cases, the rules line, TOON best, and links to the rerun steps', () => {
    const counters = ready();
    const html = render(counters, 'o200k');
    expect(html).toContain(`Lower is better. Sum of ${String(counters.o200k.cases.length)} cases, rules line included. ${TOON_BEST_NOTE}`);
    expect(html).toContain('<a href="/benchmark#method">');
  });

  it("puts the picked counter's losses line under the bars, before the footnote", () => {
    const counters = ready();
    for (const counter of counterList(counters)) {
      const html = render(counters, counter.id);
      expect(html).toContain(`</ul><p class="totals-line">${lossesLine(counter)}</p><figcaption`);
    }
  });

  it('gives the method fold on /benchmark the anchor the footnote links to', () => {
    expect(BENCHMARK_ROUTE).toMatch(/<Fold title="Method" [^>]*bodyId="method">/u);
  });

  it('renders nothing while the bench is pending', () => {
    expect(render(null, 'o200k')).toBe('');
  });

  it('grows the bars on reveal only, and draws them in full without the boot script', () => {
    expect(BENCH_CSS).toMatch(/\.js \.chart\.totals\.pre \.cost-t i \{ transform: scaleX\(0\); \}/u);
    expect(BENCH_CSS).toMatch(/\.chart\.totals \.cost-t i \{ [^}]*transition: transform/u);
  });
});
