// The site's only door to the encoder. Pages and components import encode,
// decode, RULES and every piece of Terset syntax from here, never from the
// package. When the format changes, this file and the generated samples are
// what change. Everything below "Syntax" mirrors packages/terset/SPEC.md.
import { RULES, decode, encode, rulesFor } from '@stackdeck/terset';
import type { JsonObject, JsonRoot, JsonValue } from '@stackdeck/terset';
import { PACKAGE_NAME } from '../data/site.ts';
import { hlJson, NUM, span } from './highlight.ts';
import { esc } from './text.ts';

export { RULES, decode, encode, rulesFor };
export type { JsonObject, JsonRoot, JsonValue };

/** The package's import line, as the docs and the prompt step show it. */
export const IMPORT_LINE = `import { encode, decode, rulesFor } from "${PACKAGE_NAME}";`;

/** The two lines a caller writes. `data` is the root object or array. */
export const USAGE_LINES: readonly string[] = ['const text = encode(data); // in the user message', 'const system = rulesFor(text); // once, in the system prompt'];

/** Where the rules go, in one line. */
export const RULES_PLACEMENT = 'Put rulesFor(text) in the system prompt once. The data itself carries no legend.';

// Syntax

const ENTRY = /^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$.-]*)(?:\[(\d+)\]|\{(\d+)\})?:([\s\S]*)$/u;
export const CELL_SEPARATOR = '\t';
/** A short name for the cell separator, for prose. */
export const CELL_SEPARATOR_NAME = 'tab';

/** `qt` is text written as a JSON string because it looks like a number, boolean or null, or needs escapes. */
export type TokenClass = 'rk' | 'fd' | 'id' | 'st' | 'qt' | 'nu' | 'nl' | 'ab' | 'p' | 'tb' | 'json' | 'sp';

export interface Token {
  readonly cls: TokenClass;
  readonly text: string;
}

export type LineKind = 'entry' | 'list' | 'header' | 'row' | 'other';

export interface FormatLine {
  readonly kind: LineKind;
  readonly raw: string;
  /** Root key for entry and list lines. */
  readonly key?: string;
  /** Raw cells for header and row lines. */
  readonly cells: readonly string[];
  readonly tokens: readonly Token[];
}

function cellClass(cell: string): TokenClass {
  if (cell === '') return 'ab';
  const first = cell.charAt(0);
  if (first === '"') return 'qt';
  if (first === '{' || first === '[') return 'json';
  if (cell === 'null') return 'nl';
  if (cell === 'true' || cell === 'false' || NUM.test(cell)) return 'nu';
  return 'st';
}

function joined(cells: readonly string[], classOf: (cell: string, index: number) => TokenClass): Token[] {
  return cells.flatMap((cell, index) => {
    const token: Token = { cls: classOf(cell, index), text: cell };
    return index === 0 ? [token] : [{ cls: 'tb', text: CELL_SEPARATOR }, token];
  });
}

/** Splits Terset text into typed lines and tokens. Joining every token's text gives the input back. */
export function tokenize(text: string): FormatLine[] {
  const out: FormatLine[] = [];
  const lines = text.split('\n');
  let width = 0;
  let bareId = false;
  let remaining = 0;
  let expectHeader = false;
  for (const [index, raw] of lines.entries()) {
    const cells = raw.split(CELL_SEPARATOR);
    if (expectHeader) {
      expectHeader = false;
      width = cells.length;
      // Only a bare `id` header makes the first column raw string ids. A quoted "id" keeps typed cells.
      bareId = cells[0] === 'id' || cells[0] === '@key';
      out.push({ kind: 'header', raw, cells, tokens: joined(cells, () => 'fd') });
      continue;
    }
    if (remaining > 0 && width > 0 && cells.length === width) {
      remaining--;
      out.push({ kind: 'row', raw, cells, tokens: joined(cells, (cell, index) => (index === 0 && bareId ? 'id' : cellClass(cell))) });
      continue;
    }
    width = 0;
    remaining = 0;
    const rootCount = index === 0 && lines.length > 1 ? /^\[(\d+)\]$/u.exec(raw) : null;
    if (rootCount !== null) {
      remaining = Number(rootCount[1]);
      expectHeader = true;
      out.push({ kind: 'list', raw, cells: [], tokens: [
        { cls: 'p', text: '[' }, { cls: 'nu', text: rootCount[1] ?? '' }, { cls: 'p', text: ']' },
      ] });
      continue;
    }
    const entry = ENTRY.exec(raw);
    if (entry === null) {
      out.push({ kind: 'other', raw, cells: [], tokens: raw === '' ? [] : [{ cls: 'json', text: raw }] });
      continue;
    }
    const [, key = '', listCount, mapCount, rest = ''] = entry;
    const head: Token[] = [{ cls: 'rk', text: key }];
    const count = listCount ?? mapCount;
    if (count !== undefined) head.push(
      { cls: 'p', text: listCount === undefined ? '{' : '[' },
      { cls: 'nu', text: count },
      { cls: 'p', text: listCount === undefined ? '}' : ']' },
    );
    head.push({ cls: 'p', text: ':' });
    if (rest === '' && count !== undefined) {
      remaining = Number(count);
      expectHeader = true;
      out.push({ kind: 'list', raw, key, cells: [], tokens: head });
    } else {
      const value = rest.startsWith(' ') ? rest.slice(1) : rest;
      const tokens: Token[] = rest.startsWith(' ') ? [...head, { cls: 'sp', text: ' ' }] : head;
      out.push({ kind: 'entry', raw, key, cells: [], tokens: [...tokens, { cls: cellClass(value), text: value }] });
    }
  }
  return out;
}

export interface Table {
  readonly key: string;
  readonly fields: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Every table in a text: its root key, its header and its raw row cells. */
export function tables(text: string): Table[] {
  const out: { key: string; fields: readonly string[]; rows: (readonly string[])[] }[] = [];
  let key = '';
  for (const line of tokenize(text)) {
    if (line.kind === 'list') key = line.key ?? '';
    else if (line.kind === 'header') out.push({ key, fields: line.cells, rows: [] });
    else if (line.kind === 'row') out.at(-1)?.rows.push(line.cells);
  }
  return out;
}

// Marks: the parts of the syntax the anatomy step numbers.

export type MarkId = 'rk' | 'hd' | 'id' | 'js' | 'qt' | 'ab';

export interface Mark {
  readonly id: MarkId;
  readonly n: number;
  /** A short sample of the syntax, shown beside the explanation. */
  readonly sample: string;
  readonly sampleClass: TokenClass;
  readonly about: string;
}

export const MARKS: readonly Mark[] = [
  { id: 'rk', n: 1, sample: 'orders[6]:', sampleClass: 'rk', about: 'A root key and row count. A list of records follows.' },
  { id: 'hd', n: 2, sample: 'id  customer  ...', sampleClass: 'fd', about: 'The field names, written once, split by tabs.' },
  { id: 'id', n: 3, sample: 'ORD-20001', sampleClass: 'id', about: 'A bare id header means each row starts with its id as plain text.' },
  { id: 'js', n: 4, sample: '{"city":"Lisbon"}', sampleClass: 'json', about: 'Nested values without dotted columns stay JSON cells.' },
  { id: 'ab', n: 5, sample: '', sampleClass: 'ab', about: 'An empty cell means the field is absent. null stays null.' },
  { id: 'qt', n: 6, sample: '"42"', sampleClass: 'qt', about: 'Text that looks like a number, boolean or null gets JSON quotes.' },
];

const ABSENT = '<span class="ab" title="Empty cell: the field is absent"></span>';

function tokenHtml(token: Token): string {
  if (token.cls === 'json') return hlJson(token.text);
  if (token.cls === 'ab') return ABSENT;
  if (token.cls === 'sp') return token.text;
  return span(token.cls, token.text);
}

function marked(id: MarkId, html: string): string {
  const mark = MARKS.find((item) => item.id === id);
  return mark === undefined ? html : `<span class="mk ${id}" data-n="${String(mark.n)}">${html}</span>`;
}

const TOKEN_MARK: Partial<Record<TokenClass, MarkId>> = { id: 'id', json: 'js', qt: 'qt', ab: 'ab' };

/** The width an empty cell's box takes, in characters. The box is drawn 1.6ch wide plus a margin. */
const EMPTY_CELL_CH = 2;

const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * A cell's width in characters, for lining up columns in a monospace font.
 * It counts graphemes, so a wide glyph (CJK, emoji) can still push its row out a little.
 */
function cellWidth(cell: string): number {
  return cell === '' ? EMPTY_CELL_CH : Array.from(GRAPHEMES.segment(cell)).length;
}

/**
 * The column widths for every header and row line, by line index: the widest
 * cell of each column across the line's whole table, header included.
 */
function columnWidths(lines: readonly FormatLine[]): ReadonlyMap<number, readonly number[]> {
  const out = new Map<number, readonly number[]>();
  // Every line of one table shares this array, so all of them see the final widths.
  let widths: number[] = [];
  for (const [index, line] of lines.entries()) {
    if (line.kind === 'header') widths = [];
    else if (line.kind !== 'row') continue;
    for (const [column, cell] of line.cells.entries()) widths[column] = Math.max(widths[column] ?? 0, cellWidth(cell));
    out.set(index, widths);
  }
  return out;
}

/**
 * Wraps each cell but the last in a box as wide as its column, so the cells
 * line up under their header. The real tab stays in the text between cells,
 * so a selection still copies the exact Terset text.
 */
function alignCells(tokens: readonly string[], widths: readonly number[]): string {
  const lastCell = tokens.length - 1;
  return tokens
    .map((html, index) => {
      // Tokens alternate cell, tab, cell, so a cell's column is half its index.
      if (index % 2 === 1 || index === lastCell) return html;
      return `<span class="tc" style="--w:${String(widths[index / 2] ?? 0)}">${html}</span>`;
    })
    .join('');
}

export interface HighlightOptions {
  /** Number the first place each listed mark applies, once per text. */
  readonly marks?: readonly MarkId[];
  /** Line each table's cells up under its header, whatever their lengths. */
  readonly align?: boolean;
}

/**
 * Colors Terset text as escaped HTML, line by line. With `marks`, the first
 * place each listed mark applies is wrapped and numbered, once per text.
 * With `align`, table columns line up; the text and its tabs do not change.
 */
export function highlight(text: string, options: HighlightOptions = {}): string {
  const wanted = new Set(options.marks ?? []);
  const placed = new Set<MarkId>();
  const place = (id: MarkId | undefined, html: string): string => {
    if (id === undefined || !wanted.has(id) || placed.has(id)) return html;
    placed.add(id);
    return marked(id, html);
  };
  const lines = tokenize(text);
  const widths = options.align === true ? columnWidths(lines) : new Map<number, readonly number[]>();
  const cells = (index: number, tokens: readonly string[]): string => {
    const columns = widths.get(index);
    return columns === undefined ? tokens.join('') : alignCells(tokens, columns);
  };
  return lines
    .map((line, index) => {
      if (line.kind === 'header') return place('hd', cells(index, line.tokens.map(tokenHtml)));
      const tokens = line.tokens.map((token) => {
        const html = tokenHtml(token);
        if (token.cls === 'rk') return line.kind === 'list' ? place('rk', html) : html;
        return line.kind === 'row' ? place(TOKEN_MARK[token.cls], html) : html;
      });
      return cells(index, tokens);
    })
    .join('\n');
}

/** Escaped plain text, for places that show Terset without colors. */
export function plain(text: string): string {
  return esc(text);
}

// Counting key names: how often the text writes each one.

/** A key or header cell as its name: JSON-quoted ones are unquoted. */
function fieldName(written: string): string {
  if (!written.startsWith('"')) return written;
  const name: unknown = JSON.parse(written);
  return typeof name === 'string' ? name : written;
}

function tallyValue(value: unknown, counts: Map<string, number>): void {
  if (Array.isArray(value)) {
    for (const item of value) tallyValue(item, counts);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      tallyValue(child, counts);
    }
  }
}

/** How many times each key name is written in a JSON value, in first-seen order. */
export function jsonKeyTally(value: JsonValue): Map<string, number> {
  const counts = new Map<string, number>();
  tallyValue(value, counts);
  return counts;
}

/** How many times each key name is written in Terset text: root keys, header fields and keys inside JSON cells. */
export function tersetKeyTally(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (key: string): void => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  let keyed = false;
  for (const line of tokenize(text)) {
    if (line.key !== undefined) add(fieldName(line.key));
    if (line.kind === 'header') {
      keyed = line.cells[0] === '@key';
      for (const cell of keyed ? line.cells.slice(1) : line.cells) {
        if (cell.startsWith('"')) add(fieldName(cell));
        else for (const part of cell.split('.')) add(part);
      }
    }
    if (line.kind === 'row' && keyed && line.cells[0] !== undefined) add(line.cells[0]);
    for (const token of line.tokens) {
      if (token.cls === 'json') tallyValue(JSON.parse(token.text), counts);
    }
  }
  return counts;
}
