// The site's tokenizer follows the real encoder's output: root tables,
// bare and quoted id headers, quoted text and nested JSON cells.
import { describe, expect, it } from 'vitest';
import { encode, highlight, jsonKeyTally, tables, tersetKeyTally, tokenize } from './format.ts';
import type { JsonRoot } from './format.ts';

const classes = (text: string, kind: string): string[][] =>
  tokenize(text)
    .filter((line) => line.kind === kind)
    .map((line) => line.tokens.filter((token) => token.cls !== 'tb').map((token) => token.cls));

describe('tokenize', () => {
  it('gives the input back when the tokens are joined', () => {
    const text = encode({ team: 'core', users: [{ id: 'u1', name: '42', tags: ['x'] }, { id: 'u2', name: 'Bo' }] });
    expect(tokenize(text).map((line) => line.tokens.map((token) => token.text).join('')).join('\n')).toBe(text);
  });

  it('reads a root array table after its count line', () => {
    const rows = [{ id: 'a1', n: 1 }, { id: 'a2', n: 2 }, { id: 'a3', n: 3 }];
    const text = encode(rows);
    expect(tokenize(text)[0]?.kind).toBe('list');
    expect(tokenize(text)[1]?.kind).toBe('header');
    expect(tables(text)).toEqual([{ key: '', fields: ['id', 'n'], rows: [['a1', '1'], ['a2', '2'], ['a3', '3']] }]);
    expect(classes(text, 'row')[0]).toEqual(['id', 'nu']);
  });

  it('reads keyed entry keys as text and excludes the marker from key tallies', () => {
    const value = { people: { '007': { '@key': 'one', address: { city: 'Paris' } }, '[key]': { '@key': 'two', address: { city: 'Rome' } } } };
    const text = encode(value);
    expect(tokenize(text).map(line => line.tokens.map(token => token.text).join('')).join('\n')).toBe(text);
    expect(tables(text)).toEqual([{ key: 'people', fields: ['@key', '"@key"', 'address.city'], rows: [['007', 'one', 'Paris'], ['[key]', 'two', 'Rome']] }]);
    expect(classes(text, 'row')).toEqual([['id', 'st', 'st'], ['id', 'st', 'st']]);
    expect(Object.fromEntries(tersetKeyTally(text))).toEqual({ people: 1, '@key': 1, address: 1, city: 1, '007': 1, '[key]': 1 });
  });

  it('resets table state after the declared row count', () => {
    const text = encode({ rows: [{ name: 'Ada' }, { name: 'Lin' }], after: true });
    expect(tokenize(text).map(line => line.kind)).toEqual(['list', 'header', 'row', 'row', 'entry']);
  });

  it('colors a quoted "id" column as typed cells, not ids', () => {
    const text = encode({ rows: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 3, v: 'c' }] });
    expect(tables(text)[0]?.fields[0]).toBe('"id"');
    expect(classes(text, 'row')[0]).toEqual(['nu', 'st']);
  });

  it('marks quoted text, nested JSON and empty cells', () => {
    const text = encode({ users: [{ id: 'u1', name: '42', tags: ['x'] }, { id: 'u2', name: 'Bo' }, { id: 'u3', name: 'Cy' }] });
    expect(classes(text, 'row')).toEqual([['id', 'qt', 'json'], ['id', 'st', 'ab'], ['id', 'st', 'ab']]);
    const html = highlight(text, { marks: ['qt', 'js'] });
    expect(html).toContain('<span class="mk qt" data-n="6"><span class="qt">&quot;42&quot;</span></span>');
    expect(html).toContain('class="mk js"');
    expect(html).not.toContain('class="mk id"');
  });

  it('tallies keys the same way for JSON and for Terset', () => {
    const value: JsonRoot = [{ id: 1, 'a b': { k: 1 } }, { id: 2, 'a b': { k: 2 } }, { id: 3, 'a b': { k: 3 } }];
    const terset = tersetKeyTally(encode(value));
    expect(Object.fromEntries(terset)).toEqual({ id: 1, 'a b': 1, k: 3 });
    expect(Object.fromEntries(jsonKeyTally(value))).toEqual({ id: 3, 'a b': 3, k: 3 });
    expect(Object.fromEntries(tersetKeyTally(encode([1, { x: 2 }])))).toEqual({ x: 1 });
  });
});

describe('highlight with align', () => {
  const UNESCAPE: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
  /** The text a reader selects: the markup without its tags. */
  const textOf = (html: string): string => html.replace(/<[^>]*>/gu, '').replace(/&(?:amp|lt|gt|quot);/gu, (entity) => UNESCAPE[entity] ?? entity);
  /** The --w of every aligned cell on each line, in order. */
  const widthsOf = (html: string): string[][] => html.split('\n').map((line) => [...line.matchAll(/class="tc" style="--w:(\d+)"/gu)].map((match) => match[1] ?? ''));
  const text = encode({ users: [{ id: 'u1', name: 'Ada', role: 'admin' }, { id: 'u2', name: 'Ben' }, { id: 'u3', name: 'Chen', role: 'ops', team: 'core' }] });

  it('keeps the exact text, tabs included, so a selection copies it unchanged', () => {
    const html = highlight(text, { align: true });
    expect(text).toContain('\t');
    expect(textOf(html)).toBe(text);
  });

  it('gives every cell but the last its column width, the widest cell of the table', () => {
    // users[3]: / id name role team / u1 Ada admin (empty) / u2 Ben (empty) (empty) / u3 Chen ops core
    expect(widthsOf(highlight(text, { align: true }))).toEqual([[], ['2', '4', '5'], ['2', '4', '5'], ['2', '4', '5'], ['2', '4', '5']]);
  });

  it('measures each table on its own and leaves other lines alone', () => {
    const two = encode({ a: [{ id: 'x', v: 'long value' }, { id: 'y', v: 'b' }, { id: 'z', v: 'c' }], note: 'hi', b: [{ id: 'longer id', w: 1 }, { id: 'q', w: 2 }, { id: 'r', w: 3 }] });
    const widths = widthsOf(highlight(two, { align: true })).filter((line) => line.length > 0);
    expect(widths).toEqual([['2'], ['2'], ['2'], ['2'], ['9'], ['9'], ['9'], ['9']]);
  });

  it('changes nothing without the option', () => {
    expect(highlight(text)).not.toContain('class="tc"');
  });
});
