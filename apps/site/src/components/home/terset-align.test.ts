// Every Terset table on the home page lines up its columns, and its text stays
// exactly the encoder's output, tabs included, so copying it changes nothing.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GENERATED } from '../../data/generated.ts';
import { convert } from '../../lib/convert.ts';
import { ORDERS_HL, ORDERS_TERSET } from '../../lib/orders.ts';
import { ANATOMY_HTML, USERS_HTML } from './StepAnatomy.tsx';
import { StepConvert } from './StepConvert.tsx';

const HOME_CSS = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8');
const UNESCAPE: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
/** The text a reader selects: the markup without its tags. */
const textOf = (html: string): string => html.replace(/<[^>]*>/gu, '').replace(/&(?:amp|lt|gt|quot);/gu, (entity) => UNESCAPE[entity] ?? entity);
/** The --w of every aligned cell on each line that has any, in order. */
const alignedLines = (html: string): string[][] =>
  html
    .split('\n')
    .map((line) => [...line.matchAll(/class="tc" style="--w:(\d+)"/gu)].map((match) => match[1] ?? ''))
    .filter((widths) => widths.length > 0);

/** The header and every row carry the same widths, so the table lines up even when a view renders each line on its own. */
function expectAligned(html: string, text: string, rows: number): void {
  const lines = alignedLines(html);
  expect(lines).toHaveLength(rows + 1);
  for (const line of lines) expect(line).toEqual(lines[0]);
  expect(textOf(html)).toBe(text);
  expect(text).toContain('\t');
}

describe('home Terset views', () => {
  it('lines up the orders that the hero, the prompt and the round trip split by line', () => {
    expectAligned(ORDERS_HL, ORDERS_TERSET, 6);
  });

  it('lines up both anatomy tables with their marks in place', () => {
    expectAligned(ANATOMY_HTML, ORDERS_TERSET, 6);
    expect(ANATOMY_HTML).toContain('class="mk hd"');
    expectAligned(USERS_HTML, GENERATED.docExamples.users.terset, 3);
    expect(USERS_HTML).toContain('class="mk qt"');
  });

  it('lines up the converter output and keeps the text the copy button copies', () => {
    const html = renderToStaticMarkup(createElement(StepConvert));
    const out = /<pre class="out xs" id="converter-out"[^>]*>([\s\S]*?)<\/pre>/u.exec(html)?.[1] ?? '';
    const result = convert(GENERATED.samples.orders.pretty);
    if (!result.ok) throw new Error('The orders sample no longer converts');
    expectAligned(out, result.text, 6);
    expect(result.text).toBe(ORDERS_TERSET);
  });

  it('keeps a mark from moving its text, so marked cells stay in their columns', () => {
    expect(HOME_CSS).toMatch(/\.mk \{[^}]*padding: 2px; margin: 0 -2px;/u);
  });

  it('scrolls the anatomy on small screens instead of wrapping its rows', () => {
    const anatomyRules = HOME_CSS.split('\n').filter((line) => line.includes('.anat pre'));
    expect(anatomyRules.length).toBeGreaterThan(0);
    for (const rule of anatomyRules) expect(rule).not.toContain('pre-wrap');
  });
});
