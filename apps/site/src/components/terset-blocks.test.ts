// Terset tables in code blocks line up their columns on /format, /agents and
// /docs, and keep their exact text, tabs included, so copying changes nothing.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API } from '../data/docs-api.ts';
import { DOC_LANGS } from '../data/docs.ts';
import { encode } from '../lib/format.ts';
import { parseMarkdown } from '../lib/markdown.ts';
import { esc } from '../lib/text.ts';
import { colorize } from './CodeBlock.tsx';
import { outputHtml } from './docs/ApiEntry.tsx';

const UNESCAPE: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
/** The text a reader selects: the markup without its tags. */
const textOf = (html: string): string => html.replace(/<[^>]*>/gu, '').replace(/&(?:amp|lt|gt|quot);/gu, (entity) => UNESCAPE[entity] ?? entity);
/** The --w of every aligned cell on each line that has any, in order. */
const alignedLines = (html: string): string[][] =>
  html
    .split('\n')
    .map((line) => [...line.matchAll(/class="tc" style="--w:(\d+)"/gu)].map((match) => match[1] ?? ''))
    .filter((widths) => widths.length > 0);

/** Every table line carries widths and the text is unchanged. */
function expectAligned(html: string, text: string): void {
  const tabLines = text.split('\n').filter((line) => line.includes('\t'));
  expect(tabLines.length).toBeGreaterThan(0);
  expect(alignedLines(html)).toHaveLength(tabLines.length);
  expect(textOf(html)).toBe(text);
}

const MARKDOWN_PAGES = ['spec.md', 'agents.md'].map((name) => readFileSync(new URL(`../generated/${name}`, import.meta.url), 'utf8'));

describe('Terset code blocks', () => {
  it('lines up a terset fence', () => {
    const text = encode({ users: [{ id: 'u1', name: 'Ada', role: 'admin' }, { id: 'u2', name: 'Ben' }, { id: 'u3', name: 'Chen', role: 'ops' }] });
    const html = colorize('terset', text);
    expectAligned(html, text);
    expect(alignedLines(html)).toEqual([['2', '4'], ['2', '4'], ['2', '4'], ['2', '4']]);
  });

  it('lines up every terset fence on the markdown pages', () => {
    const fences = MARKDOWN_PAGES.flatMap((source) => parseMarkdown(source).blocks).filter((block) => block.kind === 'code' && block.lang === 'terset');
    expect(fences.length).toBeGreaterThan(0);
    for (const fence of fences) if (fence.kind === 'code' && fence.text.includes('\t')) expectAligned(colorize('terset', fence.text), fence.text);
  });

  it('lines up an API output that holds a table and leaves other outputs plain', () => {
    const outputs = API.flatMap((entry) => DOC_LANGS.map((lang) => entry.example[lang].output));
    const withTables = outputs.filter((output) => output.includes('\t'));
    expect(withTables.length).toBeGreaterThan(0);
    for (const output of withTables) expectAligned(outputHtml(output), output);
    for (const output of outputs.filter((text) => !text.includes('\t'))) expect(outputHtml(output)).toBe(esc(output));
  });
});
