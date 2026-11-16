// A small Markdown reader for the site's own docs: headings, paragraphs,
// lists, fenced code, tables, rules, inline code, links and bold.
// It only reads files in this repo, and every piece of text is escaped.
import { esc, slug } from './text.ts';

export interface Heading {
  readonly id: string;
  readonly text: string;
}

/** HTML for prose, or a code block the page renders with its own component. */
export type Block = { readonly kind: 'html'; readonly html: string } | { readonly kind: 'code'; readonly lang: string; readonly text: string };

export interface Doc {
  readonly blocks: readonly Block[];
  readonly headings: readonly Heading[];
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/gu;
const BOLD = /\*\*([^*]+)\*\*/gu;
const LIST_ITEM = /^(\s*)(-|\d+\.) (.*)$/u;
const HEADING = /^(#{1,4}) (.*)$/u;
const QUOTE = /^\s*> ?/u;

const DATE = /\b\d{4}-\d{2}-\d{2}\b/gu;

function safeHref(href: string): string {
  return /^(https?:\/\/|\/|#)/u.test(href) ? href : '#';
}

/**
 * Keeps each ISO date on one line, so a narrow column never shows "2026-" above "11-13".
 * It only touches text between tags; the text is escaped, so every tag here is one this file made.
 */
function keepDates(html: string): string {
  return html
    .split(/(<[^>]+>)/u)
    .map((piece) => (piece.startsWith('<') ? piece : piece.replace(DATE, '<span class="nowrap">$&</span>')))
    .join('');
}

/** Inline Markdown to HTML. Code spans are cut out first, so nothing inside them is read as Markdown. */
export function inline(text: string): string {
  return text
    .split(/(`[^`]+`)/u)
    .map((part) => {
      if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) return `<code>${esc(part.slice(1, -1))}</code>`;
      return keepDates(
        esc(part)
          .replace(LINK, (_match, label: string, href: string) => `<a href="${safeHref(href)}">${label}</a>`)
          .replace(BOLD, '<strong>$1</strong>'),
      );
    })
    .join('');
}

/** Plain text of an inline string, for heading ids and the table of contents. */
function plain(text: string): string {
  return text.replace(/`([^`]+)`/gu, '$1').replace(BOLD, '$1').replace(LINK, '$1');
}

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/gu, '')
    .split('|')
    .map((cell) => cell.trim());
}

const NUMERIC = /^[−+-]?[\d,.]+%?$/u;

function table(rows: readonly string[]): string {
  const [head = '', , ...body] = rows;
  const bodyCells = body.map(cells);
  // A header lines up with its column: right only when every cell under it is a number.
  const numericColumn = (i: number): boolean => i > 0 && bodyCells.length > 0 && bodyCells.every((row) => NUMERIC.test(row[i] ?? ''));
  const th = cells(head)
    .map((cell, i) => `<th scope="col"${numericColumn(i) ? ' class="num"' : ''}>${inline(cell)}</th>`)
    .join('');
  const tr = body
    .map((row) => {
      const tds = cells(row).map((cell, i) => (i === 0 ? `<th scope="row">${inline(cell)}</th>` : `<td${NUMERIC.test(cell) ? ' class="num"' : ''}>${inline(cell)}</td>`));
      return `<tr>${tds.join('')}</tr>`;
    })
    .join('');
  return `<div class="tablewrap scroll-x on-light"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

interface Item {
  readonly ordered: boolean;
  text: string;
}

function list(items: readonly Item[]): string {
  const ordered = items[0]?.ordered === true;
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((item) => `<li>${inline(item.text)}</li>`).join('')}</${tag}>`;
}

export function parseMarkdown(source: string): Doc {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: Block[] = [];
  const headings: Heading[] = [];
  let html: string[] = [];
  const flush = (): void => {
    if (html.length > 0) blocks.push({ kind: 'html', html: html.join('') });
    html = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        code.push(lines[i] ?? '');
        i++;
      }
      i++;
      flush();
      blocks.push({ kind: 'code', lang, text: code.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const level = (heading[1] ?? '#').length;
      const text = heading[2] ?? '';
      const id = slug(plain(text));
      if (level === 2) headings.push({ id, text: plain(text) });
      html.push(`<h${String(level)} id="${id}">${inline(text)}</h${String(level)}>`);
      i++;
      continue;
    }
    if (/^-{3,}$/u.test(line.trim())) {
      html.push('<hr>');
      i++;
      continue;
    }
    if (line.trimStart().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('|')) {
        rows.push(lines[i] ?? '');
        i++;
      }
      html.push(table(rows));
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] ?? '')) {
        quoted.push((lines[i] ?? '').replace(QUOTE, '').trim());
        i++;
      }
      html.push(`<blockquote><p>${inline(quoted.join(' '))}</p></blockquote>`);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const items: Item[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? '';
        const match = LIST_ITEM.exec(current);
        if (match !== null) {
          items.push({ ordered: match[2] !== '-', text: match[3] ?? '' });
        } else if (current.trim() !== '' && /^\s+/u.test(current) && items.length > 0) {
          const last = items[items.length - 1];
          if (last !== undefined) last.text += ` ${current.trim()}`;
        } else {
          break;
        }
        i++;
      }
      html.push(list(items));
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? '';
      if (current.trim() === '' || current.startsWith('```') || HEADING.test(current) || LIST_ITEM.test(current) || QUOTE.test(current) || current.trimStart().startsWith('|')) break;
      paragraph.push(current.trim());
      i++;
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  flush();
  return { blocks, headings };
}
