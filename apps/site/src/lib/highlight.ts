// JSON and TOON coloring. Neither knows Terset syntax; that lives in format.ts.
// Every function returns escaped HTML.
import { esc } from './text.ts';

const JTOK = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[[\]{}:,]|\s+|./gu;
export const NUM = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;

export function span(cls: string, text: string): string {
  return `<span class="${cls}">${esc(text)}</span>`;
}

/** JSON tokens: strings, numbers, booleans, null and punctuation. */
export function jsonTokens(text: string): string[] {
  return text.match(JTOK) ?? [];
}

export function hlJson(text: string): string {
  return jsonTokens(text)
    .map((token) => {
      if (token.startsWith('"')) return span('st', token);
      if (token === 'null') return span('nl', token);
      if (token === 'true' || token === 'false' || NUM.test(token)) return span('nu', token);
      if ('[]{}:,'.includes(token)) return span('p', token);
      return esc(token);
    })
    .join('');
}

/** TOON lines: keys and list dashes colored, values plain. */
export function hlToon(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const match = /^(\s*)(- )?([^:]*:)(.*)$/u.exec(line);
      if (match === null) return esc(line);
      const [, lead = '', dash, key = '', rest = ''] = match;
      return esc(lead) + (dash === undefined ? '' : '<span class="od">- </span>') + `<span class="ok">${esc(key)}</span>` + esc(rest);
    })
    .join('\n');
}
