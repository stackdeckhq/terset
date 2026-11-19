// The Terset rows in step 4 wrap only at their tab marks. A cell such as the
// SKU "C-310" must never break inside, at its hyphen or anywhere else.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StepCases } from './StepCases.tsx';

const HOME_CSS = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8');

describe('step 4 Terset rows', () => {
  it('puts every cell in a whole-cell span, with the break chance outside it', () => {
    const html = renderToStaticMarkup(createElement(StepCases));
    const rows = [...html.matchAll(/<p class="t">([\s\S]*?)<\/p>/gu)].map((match) => match[1] ?? '');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = row.match(/<span class="cell">/gu) ?? [];
      const tabs = row.match(/<span class="tb" aria-hidden="true"><\/span><wbr\/>/gu) ?? [];
      expect(cells.length).toBe(tabs.length + 1);
      expect(row).not.toMatch(/<span class="cell">(?:(?!<\/span>).)*<wbr/u);
    }
    expect(html).toContain('<span class="cell">lines=[{&quot;sku&quot;:&quot;C-310&quot;');
  });

  it('points at the named cell a row has, and says when a row lacks the field', () => {
    const html = renderToStaticMarkup(createElement(StepCases));
    expect(html).toContain('<em>ship={&quot;city&quot;:&quot;Osaka&quot;}</em>');
    expect(html).toContain('<em>note=Gift wrap</em>');
    expect(html).toContain('Row 5, no ship cell');
    expect(html).toContain('Row 4, ship cell');
  });

  it('keeps a cell on one line in the stylesheet', () => {
    expect(HOME_CSS).toMatch(/\.case \.t \.cell \{ white-space: nowrap; \}/u);
  });
});
