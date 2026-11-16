// The hero's JSON view is the home page's largest paint. It must show in the server HTML
// at full opacity on first paint, with no fade or slide on load, so it counts at once.
// Later view switches may animate; only the first view is pinned here.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Hero } from './Hero.tsx';

// The hero's links need a router; a plain anchor is enough for its markup.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, hash, children }: { readonly to: string; readonly hash?: string; readonly children: ReactNode }) => createElement('a', { href: hash === undefined ? to : `${to}#${hash}` }, children),
}));

const HOME_CSS = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '');

/** The declarations of the first rule whose selector list holds the selector. */
function declarations(selector: string): string {
  const rule = [...HOME_CSS.matchAll(/([^{}]+)\{([^}]*)\}/gu)].find((match) => (match[1] ?? '').split(',').some((part) => part.trim() === selector));
  if (rule === undefined) throw new Error(`home.css has no rule for ${selector}`);
  return rule[2] ?? '';
}

describe('the hero on first paint', () => {
  it('renders the JSON view as the shown view in the server HTML', () => {
    const html = renderToStaticMarkup(createElement(Hero));
    expect(html).toContain('<div class="win-b" data-view="json"><div class="view v-json">');
  });

  it('shows the active view at full opacity with no transform', () => {
    const shown = declarations('.win-b[data-view="json"] .v-json');
    expect(shown).toMatch(/opacity:\s*1;/u);
    expect(shown).toMatch(/visibility:\s*visible;/u);
    expect(shown).toMatch(/transform:\s*none;/u);
  });

  // Only the hero view's own rules are checked, so other parts of the page may animate.
  it('runs no load animation on the hero view', () => {
    for (const selector of ['.view', '.win-b[data-view="json"] .v-json']) {
      expect(declarations(selector)).not.toMatch(/animation(-name)?\s*:/u);
    }
  });
});
