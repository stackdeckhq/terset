import { describe, expect, it } from 'vitest';
import type { PagePath } from '../src/data/site.ts';
import { pageHeadProblems } from './check-pages.ts';
import type { BuiltPage } from './check-pages.ts';

interface Parts {
  readonly title?: string;
  readonly description?: string;
  readonly canonical?: string;
  readonly h1s?: number;
  readonly jsonLd?: readonly string[];
  readonly robots?: string;
  /** Raw markup added to the head as written. */
  readonly head?: string;
}

/** A prerendered page as the build writes it, with each part open to change. */
function page(path: PagePath, parts: Parts = {}): BuiltPage {
  const title = parts.title ?? `Title of ${path}`;
  const description = parts.description ?? `Description of ${path}`;
  const canonical = parts.canonical ?? `https://terset.dev${path}`;
  const jsonLd = parts.jsonLd ?? ['{"@context":"https://schema.org","@type":"WebSite"}'];
  const html = [
    '<!DOCTYPE html><html lang="en"><head>',
    `<title>${title}</title>`,
    `<meta name="description" content="${description}"/>`,
    parts.robots === undefined ? '' : `<meta name="robots" content="${parts.robots}"/>`,
    `<link rel="canonical" href="${canonical}"/>`,
    ...jsonLd.map((text) => `<script type="application/ld+json">${text}</script>`),
    parts.head ?? '',
    '</head><body>',
    '<h1 id="doc-h">Heading</h1>'.repeat(parts.h1s ?? 1),
    '<h2>Part</h2></body></html>',
  ].join('');
  return { path, html };
}

const good = (): BuiltPage[] => [page('/'), page('/docs')];

describe('pageHeadProblems', () => {
  it('passes pages that keep every rule', () => {
    expect(pageHeadProblems(good())).toEqual([]);
  });

  it('fails a page with no h1 or with two', () => {
    expect(pageHeadProblems([page('/'), page('/docs', { h1s: 2 })])).toEqual(['/docs: has 2 h1 elements, expected 1']);
    expect(pageHeadProblems([page('/', { h1s: 0 }), page('/docs')])).toEqual(['/: has 0 h1 elements, expected 1']);
  });

  it('fails a canonical that is not the page URL', () => {
    expect(pageHeadProblems([page('/'), page('/docs', { canonical: 'https://terset.dev/docs/' })])).toEqual([
      '/docs: canonical is [https://terset.dev/docs/], expected [https://terset.dev/docs]',
    ]);
  });

  it('fails a title or description over its limit, counted as the reader sees it', () => {
    expect(pageHeadProblems([page('/', { title: 'a'.repeat(61) }), page('/docs', { description: 'b'.repeat(161) })])).toEqual([
      '/: title is 61 characters, over 60',
      '/docs: description is 161 characters, over 160',
    ]);
    // An escaped ampersand is one character.
    expect(pageHeadProblems([page('/', { title: `${'a'.repeat(59)}&amp;` }), page('/docs')])).toEqual([]);
  });

  it('fails a missing title or description', () => {
    const bare: BuiltPage = { path: '/docs', html: '<!DOCTYPE html><html><head><link rel="canonical" href="https://terset.dev/docs"/><script type="application/ld+json">{}</script></head><body><h1>x</h1></body></html>' };
    expect(pageHeadProblems([page('/'), bare])).toEqual(['/docs: has no title', '/docs: has no description']);
  });

  it('fails a title or description another page also uses', () => {
    expect(pageHeadProblems([page('/', { title: 'Same', description: 'Same text' }), page('/docs', { title: 'Same', description: 'Same text' })])).toEqual([
      'the title "Same" is on more than one page: /, /docs',
      'the description "Same text" is on more than one page: /, /docs',
    ]);
  });

  it('fails a page with no JSON-LD, or JSON-LD that does not parse', () => {
    expect(pageHeadProblems([page('/', { jsonLd: [] }), page('/docs', { jsonLd: ['{"@type":'] })])).toEqual([
      '/: has no JSON-LD block',
      '/docs: JSON-LD block 1 does not parse',
    ]);
  });

  it('fails a real page marked noindex', () => {
    expect(pageHeadProblems([page('/'), page('/docs', { robots: 'noindex' })])).toEqual(['/docs: carries a robots noindex meta']);
  });

  it('fails every way a meta tag can keep a page out of the index', () => {
    const blocking = [
      '<meta name="robots" content="NOINDEX"/>',
      '<meta name="robots" content="none"/>',
      '<meta name="googlebot" content="noindex"/>',
      "<meta name='robots' content='noindex, follow'/>",
      '<meta content="noindex" name="ROBOTS">',
      '<meta name="robots" content="noindex nofollow">',
      '<meta data-name="example" name="robots" content="noindex">',
      '<meta name=robots content=noindex>',
    ];
    for (const head of blocking) expect(pageHeadProblems([page('/'), page('/docs', { head })]), head).toEqual(['/docs: carries a robots noindex meta']);
  });

  it('passes robots meta that leaves the page in the index', () => {
    const allowing = [
      '<meta name="robots" content="index, follow"/>',
      '<meta name="robots" content="max-image-preview:large"/>',
      '<meta name="author" content="none"/>',
      '<meta data-name="robots" name="author" content="noindex"/>',
    ];
    for (const head of allowing) expect(pageHeadProblems([page('/'), page('/docs', { head })]), head).toEqual([]);
  });

  it('fails a broken JSON-LD block that holds a < next to a good block', () => {
    const broken = '{"name":"a < b",';
    expect(pageHeadProblems([page('/'), page('/docs', { jsonLd: ['{"@type":"WebSite"}', broken] })])).toEqual(['/docs: JSON-LD block 2 does not parse']);
    expect(pageHeadProblems([page('/'), page('/docs', { head: `<script type='application/ld+json'>${broken}</script>` })])).toEqual(['/docs: JSON-LD block 2 does not parse']);
    expect(pageHeadProblems([page('/'), page('/docs', { head: `<script data-type="example" type="application/ld+json">${broken}</script>` })])).toEqual(['/docs: JSON-LD block 2 does not parse']);
  });
});
