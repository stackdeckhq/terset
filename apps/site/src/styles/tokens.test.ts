// Keeps the color system honest: every token has a light and a dark value, no other
// style file holds a color literal, every var() used is defined, and the head metas
// and the release wording match their sources.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../data/site.ts';
import { THEME_COLORS } from '../theme.ts';

const STYLES = new URL('./', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, STYLES), 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//gu, '');
const OTHER_FILES = readdirSync(STYLES).filter((name) => name.endsWith('.css') && name !== 'tokens.css');
const TOKENS = stripComments(read('tokens.css'));

const HEX = String.raw`#[0-9a-f]{3,8}`;
const PAIR = new RegExp(String.raw`^light-dark\((${HEX}), (${HEX})\)$`, 'u');

/** The custom properties of the :root block, as name to value. */
function colorTokens(): Map<string, string> {
  const root = /:root\s*\{([\s\S]*?)\n\}/u.exec(TOKENS)?.[1] ?? '';
  const entries = [...root.matchAll(/(--[\w-]+):\s*([^;]+);/gu)].map((match): [string, string] => [match[1] ?? '', (match[2] ?? '').trim()]);
  return new Map(entries);
}

function pair(value: string): readonly [string, string] {
  const match = PAIR.exec(value);
  if (match === null) throw new Error(`not a light-dark() pair: ${value}`);
  return [match[1] ?? '', match[2] ?? ''];
}

describe('color tokens', () => {
  const tokens = colorTokens();

  it('defines every token with one light and one dark value, so both themes have the same set', () => {
    expect(tokens.size).toBeGreaterThan(40);
    const bad = [...tokens].filter(([, value]) => !PAIR.test(value)).map(([name]) => name);
    expect(bad).toEqual([]);
  });

  it('follows the system by default and pins one scheme for a saved choice', () => {
    expect(TOKENS).toMatch(/:root\s*\{\s*color-scheme: light dark;/u);
    expect(TOKENS).toContain(':root[data-theme="light"] { color-scheme: light; }');
    expect(TOKENS).toContain(':root[data-theme="dark"] { color-scheme: dark; }');
  });

  it('keeps the theme-color metas equal to the page ground of each theme', () => {
    expect(pair(tokens.get('--bg') ?? '')).toEqual([THEME_COLORS.light, THEME_COLORS.dark]);
  });

  it('leaves no color literal in any other style file', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch)\(|(?<![\w-])(?:white|black)(?![\w-])/u;
    const hits = OTHER_FILES.flatMap((name) =>
      stripComments(read(name))
        .split('\n')
        .filter((line) => literal.test(line))
        .map((line) => `${name}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });

  it('uses only custom properties that are defined somewhere', () => {
    const all = [read('tokens.css'), ...OTHER_FILES.map(read)].map(stripComments).join('\n');
    const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/gu)].map((match) => match[1]));
    // Set inline by components, not in a style file.
    for (const name of ['--i', '--f', '--prog', '--rows', '--w', '--z']) defined.add(name);
    const used = new Set([...all.matchAll(/var\((--[\w-]+)/gu)].map((match) => match[1]));
    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });
});

describe('release wording', () => {
  it('names the package and version that packages/terset/package.json declares', () => {
    const manifest: unknown = JSON.parse(readFileSync(new URL('../../../../packages/terset/package.json', import.meta.url), 'utf8'));
    expect(manifest).toMatchObject({ name: PACKAGE_NAME, version: PACKAGE_VERSION });
  });
});
