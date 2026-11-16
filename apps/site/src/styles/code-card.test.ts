// A code window's ring stays visible over a sideways scroll cue, and the two cards of a
// cheat sheet pair fill their shared row with code, so they look the same.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');
const BASE = read('./base.css');
const DOCS_PAGE = read('./docs-page.css');

/** The body of the first rule whose selector list is exactly this one. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) return '';
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('code window ring', () => {
  it('is drawn on top of the content, not under it', () => {
    // The .scroll-x cue paints opaque code color at both edges of a pre. An inset ring on
    // .code itself sits under that paint and vanishes at the sides.
    expect(rule(BASE, '.code')).toContain('position: relative');
    expect(rule(BASE, '.code')).not.toContain('box-shadow');
    const ring = rule(BASE, '.code::after');
    expect(ring).toContain('inset: 0');
    expect(ring).toContain('box-shadow: inset 0 0 0 1px var(--code-ring)');
    expect(ring).toContain('pointer-events: none');
  });

  it('is the same ring in every section, with no per-section override', () => {
    // Every section sits on the page ground, so one ring works everywhere.
    expect(BASE).not.toMatch(/\.code::after\s*\{[^}]*content:\s*none/u);
    expect(BASE).not.toContain('--code-ring-band');
  });
});

describe('cheat sheet pair', () => {
  it('lets the code fill each card to the height of the row', () => {
    expect(rule(DOCS_PAGE, '.cheat-pair .code')).toContain('display: flex; flex-direction: column');
    expect(rule(DOCS_PAGE, '.cheat-pair .code pre')).toContain('flex: 1 0 auto');
  });
});
