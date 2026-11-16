// Card actions sit on the right. One shared row (.card-actions in base.css) puts the
// buttons of a card, panel or section box at the right edge, with an optional note
// (.card-note) on the left. These tests fail if that row stops right-aligning, if a
// component rule moves its buttons back, or if the agent prompt card stops using it.
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromptCard } from '../components/PromptCard.tsx';

const SRC = new URL('../', import.meta.url);
const STYLES = new URL('./', import.meta.url);
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//gu, '');
const BASE_RAW = readFileSync(new URL('base.css', STYLES), 'utf8');
const CSS_FILES = readdirSync(STYLES).filter((name) => name.endsWith('.css'));

interface Rule {
  readonly file: string;
  readonly selector: string;
  readonly body: string;
}

/** Every innermost rule of every style file. Media blocks are skipped through to their rules. */
const RULES: readonly Rule[] = CSS_FILES.flatMap((file) =>
  [...stripComments(readFileSync(new URL(file, STYLES), 'utf8')).matchAll(/([^{}]+)\{([^{}]*)\}/gu)].map((match) => ({
    file,
    selector: (match[1] ?? '').trim(),
    body: (match[2] ?? '').trim(),
  })),
);

const hasClass = (compound: string, name: string): boolean => new RegExp(String.raw`\.${name}(?![\w-])`, 'u').test(compound);

/** The declarations of the one rule whose selector is exactly this, in base.css. */
function baseRule(selector: string): string {
  const rule = RULES.find((item) => item.file === 'base.css' && item.selector === selector);
  if (rule === undefined) throw new Error(`base.css has no rule for ${selector}`);
  return rule.body;
}

/** Every component and route source, as file name to text. */
const SOURCES: readonly (readonly [string, string])[] = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((name) => name.endsWith('.tsx'))
  .map((name): [string, string] => [name, readFileSync(new URL(name, SRC), 'utf8')]);

/** Class names that share an element with .card-actions or .card-note somewhere in the markup. */
function rowClasses(): Set<string> {
  const names = new Set(['card-actions', 'card-note']);
  for (const [, text] of SOURCES) {
    for (const match of text.matchAll(/['"]([^'"]*\bcard-(?:actions|note)\b[^'"]*)['"]/gu)) {
      for (const name of (match[1] ?? '').split(/\s+/u)) if (name !== '') names.add(name);
    }
  }
  return names;
}

describe('card actions row', () => {
  it('states the rule at the class', () => {
    expect(BASE_RAW).toContain('Card actions sit on the right.');
  });

  it('puts the buttons on the right edge and keeps them there when the row wraps', () => {
    const row = baseRule('.card-actions');
    expect(row).toMatch(/display: flex;/u);
    expect(row).toMatch(/justify-content: flex-end;/u);
    expect(row).toMatch(/flex-wrap: wrap;/u);
    // The note grows to fill the left side, so the buttons stay at the right edge.
    expect(baseRule('.card-actions > .card-note')).toMatch(/flex: 1 1 /u);
  });

  it('is used by the agent prompt card and every other card action row', () => {
    const users = SOURCES.filter(([, text]) => /\bcard-actions\b/u.test(text)).map(([name]) => name.replaceAll('\\', '/'));
    expect(users).toEqual(expect.arrayContaining(['components/PromptCard.tsx', 'components/home/StepRoundTrip.tsx', 'routes/agents.tsx']));
  });

  it('has no other rule that moves its buttons or note out of place', () => {
    const classes = rowClasses();
    const moves = /(?:^|;|\s)(justify-content|justify-self|flex-direction|order|direction|float|margin-left|margin-right|margin-inline(?:-start|-end)?)\s*:/u;
    const allowed = new Set(['base.css .card-actions', 'base.css .card-actions > .card-note']);
    const hits = RULES.filter((rule) => !allowed.has(`${rule.file} ${rule.selector}`))
      .filter((rule) =>
        rule.selector.split(',').some((part) => {
          // The subject of the selector: its last compound, after any combinator.
          const subject = part.trim().split(/\s*[\s>+~]\s*/u).at(-1) ?? '';
          return [...classes].some((name) => hasClass(subject, name));
        }),
      )
      .filter((rule) => moves.test(rule.body))
      .map((rule) => `${rule.file}: ${rule.selector}`);
    expect(hits).toEqual([]);
  });
});

describe('agent prompt card', () => {
  const html = renderToStaticMarkup(createElement(PromptCard));
  const row = /<div class="card-actions">([\s\S]*?)<\/div>/u.exec(html)?.[1] ?? '';

  it('puts its copy button in the shared row', () => {
    expect(row).toContain('Copy prompt');
    expect(row).toContain('<button');
  });

  it('holds only the copy button, with no note beside it', () => {
    expect(row).not.toContain('card-note');
    expect(row.match(/<button/gu)?.length).toBe(1);
  });
});
