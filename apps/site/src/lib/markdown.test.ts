// Inline Markdown on the doc pages: a date never breaks at its hyphens,
// and a date inside a link target stays a plain URL.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inline, parseMarkdown, withoutTitle } from './markdown.ts';

function html(source: string): string {
  return parseMarkdown(source)
    .blocks.map((block) => (block.kind === 'html' ? block.html : ''))
    .join('');
}

describe('quotes', () => {
  it('renders a "> " line as a quote, not as a paragraph that starts with ">"', () => {
    expect(html('Intro:\n\n> Tables use `tabs`.\n> Empty cells mean absent.\n\nAfter.')).toBe(
      '<p>Intro:</p><blockquote><p>Tables use <code>tabs</code>. Empty cells mean absent.</p></blockquote><p>After.</p>',
    );
  });
});

describe('tables', () => {
  it('right-aligns a header only over a column of numbers', () => {
    const out = html('| Name | Size | About |\n| --- | --- | --- |\n| a | 1,200 | small |\n| b | 30 | large |');
    expect(out).toContain('<th scope="col">Name</th><th scope="col" class="num">Size</th><th scope="col">About</th>');
  });
});

describe('withoutTitle', () => {
  it('drops a leading h1, so the page h1 stays the only one', () => {
    expect(html(withoutTitle('# Terset format\n\nFormat version 1.0\n\n## Root\n\nText.'))).toBe('<p>Format version 1.0</p><h2 id="root">Root</h2><p>Text.</p>');
  });

  it('keeps a doc that does not open with an h1 as it is', () => {
    expect(withoutTitle('## Root\n\n# Later')).toBe('## Root\n\n# Later');
  });

  it('leaves no h1 in the spec the /format page renders', () => {
    const spec = readFileSync(new URL('../../../../packages/terset/SPEC.md', import.meta.url), 'utf8');
    expect(spec.startsWith('# ')).toBe(true);
    expect(html(withoutTitle(spec))).not.toContain('<h1');
  });
});

describe('inline dates', () => {
  it('has a nowrap class in the base styles', () => {
    expect(readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8')).toMatch(/\n\.nowrap \{ white-space: nowrap; \}/u);
  });

  it('keeps an ISO date on one line in plain text', () => {
    expect(inline('Run on 2026-11-13 UTC.')).toBe('Run on <span class="nowrap">2026-11-13</span> UTC.');
  });

  it('keeps a date in a link label on one line and leaves the link target alone', () => {
    expect(inline('Scores: [2026-11-12](/runs/2026-11-12.csv).')).toBe('Scores: <a href="/runs/2026-11-12.csv"><span class="nowrap">2026-11-12</span></a>.');
  });

  it('leaves code spans and other numbers as they are', () => {
    expect(inline('Version `2026-11-12` and 1,952 calls.')).toBe('Version <code>2026-11-12</code> and 1,952 calls.');
  });
});
