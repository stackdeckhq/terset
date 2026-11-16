// The footer's StackDeck mark shows at 15 px. It must be a small file that loads late,
// so React does not preload it at the top of every page.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './SiteFooter.tsx';

// The footer's links need a router; a plain anchor is enough for its markup.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, hash, children }: { readonly to: string; readonly hash?: string; readonly children: ReactNode }) => createElement('a', { href: hash === undefined ? to : `${to}#${hash}` }, children),
}));

const MARK = '/stackdeck-mark.png';

describe('the footer mark', () => {
  it('loads lazily and decodes off the main thread', () => {
    const img = /<img [^>]*src="\/stackdeck-mark\.png"[^>]*>/u.exec(renderToStaticMarkup(createElement(SiteFooter)))?.[0];
    expect(img).toBeDefined();
    expect(img).toContain('loading="lazy"');
    expect(img).toContain('decoding="async"');
  });

  it('is a PNG of at most 48 px and a few KB', () => {
    const png = readFileSync(new URL(`../../public${MARK}`, import.meta.url));
    expect(png.toString('latin1', 12, 16)).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([48, 48]);
    expect(png.length).toBeLessThanOrEqual(4096);
  });
});
