// A plain line after a list of findings keeps the list's spacing and text edge.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DOCS_CSS = readFileSync(new URL('./docs.css', import.meta.url), 'utf8');

function rule(selector: string): string {
  const start = DOCS_CSS.indexOf(`${selector} {`);
  if (start === -1) return '';
  return DOCS_CSS.slice(start, DOCS_CSS.indexOf('}', start));
}

describe('Markdown tables', () => {
  it('draw no line under the last row, under its row header either', () => {
    expect(rule('.prose tr:last-child > *')).toContain('border-bottom: 0');
  });
});

describe('bytes line on /benchmark', () => {
  it('sits apart from the list above it and lines up with the list text', () => {
    const css = rule('.bytes-line');
    const list = rule('.steps-list');
    expect(css).toContain('margin-top: var(--s-3)');
    expect(css).toContain('padding-left: 0');
    expect(list).toContain('padding-left: 0');
    expect(css).toContain('max-width: 72ch');
    expect(list).toContain('max-width: 72ch');
  });
});
