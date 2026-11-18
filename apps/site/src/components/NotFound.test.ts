// The 404 page asks search engines to leave it out of their index.
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NotFound } from './NotFound.tsx';

// The page's links need a router; a plain anchor is enough for its markup.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { readonly to: string; readonly children: ReactNode }) => createElement('a', { href: to }, children),
}));

describe('the 404 page', () => {
  it('carries a robots noindex meta', () => {
    expect(renderToStaticMarkup(createElement(NotFound))).toContain('<meta name="robots" content="noindex"/>');
  });
});
