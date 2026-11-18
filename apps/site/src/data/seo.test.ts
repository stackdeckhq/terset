// The search-facing head of every page: the copy limits and the tags that carry it.
import { describe, expect, it } from 'vitest';
import { docHead } from '../components/DocPage.tsx';
import { DOCS_TITLE } from './docs.ts';
import { DESCRIPTION_MAX, homeJsonLd, homeMeta, jsonLdScript, PAGE_SEO, seoMeta, TITLE_MAX } from './seo.ts';
import { GOOGLE_SITE_VERIFICATION, NAV, PACKAGE_LANGUAGE, PACKAGE_LICENSE, PACKAGE_VERSION, PAGE_PATHS, REPO_URL, SITE_NAME, SITE_URL, TAGLINE } from './site.ts';

// Other formats a title must not name. Titles use the words people search for the problem.
const OTHER_FORMATS = /\b(?:TOON|YAML|CSV|XML|TSV)\b/iu;

describe('page titles and descriptions', () => {
  it('has a title and a description for every page, each within its limit', () => {
    for (const path of PAGE_PATHS) {
      const { title, description } = PAGE_SEO[path];
      expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
      expect(description.length, description).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it('gives every page its own title and description', () => {
    const titles = PAGE_PATHS.map((path) => PAGE_SEO[path].title);
    const descriptions = PAGE_PATHS.map((path) => PAGE_SEO[path].description);
    expect(new Set(titles).size).toBe(PAGE_PATHS.length);
    expect(new Set(descriptions).size).toBe(PAGE_PATHS.length);
  });

  it('uses search words and names no other format in a title', () => {
    for (const path of PAGE_PATHS) {
      const { title } = PAGE_SEO[path];
      expect(title).toMatch(/\b(?:JSON|LLM|tokens?|format|benchmark)\b/iu);
      expect(title).not.toMatch(OTHER_FORMATS);
    }
  });

  it('proves ownership to Google on the home page only', () => {
    const tag = { name: 'google-site-verification', content: GOOGLE_SITE_VERIFICATION };
    expect(homeMeta()).toContainEqual(tag);
    for (const path of PAGE_PATHS) expect(seoMeta(path)).not.toContainEqual(tag);
  });

  it('types no number by hand', () => {
    for (const path of PAGE_PATHS) {
      expect(PAGE_SEO[path].title).not.toMatch(/\d/u);
      expect(PAGE_SEO[path].description).not.toMatch(/\d/u);
    }
  });

  it('carries the same title and description to og and twitter', () => {
    for (const path of PAGE_PATHS) {
      const { title, description } = PAGE_SEO[path];
      expect(seoMeta(path)).toEqual([
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ]);
    }
  });

  it('puts the doc page copy in its head, with the canonical link', () => {
    const head = docHead('/format', 'The Terset format');
    expect(head.meta).toEqual([...seoMeta('/format'), { property: 'og:url', content: 'https://terset.dev/format' }]);
    expect(head.links).toEqual([{ rel: 'canonical', href: 'https://terset.dev/format' }]);
  });
});

/** The parsed JSON of every JSON-LD script in a head. */
function ldBlocks(scripts: readonly { readonly type: string; readonly children: string }[]): unknown[] {
  return scripts.map((script) => {
    expect(script.type).toBe('application/ld+json');
    const parsed: unknown = JSON.parse(script.children);
    return parsed;
  });
}

describe('structured data', () => {
  it('escapes < so the text cannot close its script tag', () => {
    const script = jsonLdScript({ name: '</script><script>alert(1)</script>' });
    expect(script.children).not.toContain('<');
    expect(JSON.parse(script.children)).toEqual({ name: '</script><script>alert(1)</script>' });
  });

  it('describes the home page as the site and the source code, from site.ts', () => {
    expect(ldBlocks(homeJsonLd())).toEqual([
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/`, description: PAGE_SEO['/'].description },
          {
            '@type': 'SoftwareSourceCode',
            name: SITE_NAME,
            description: TAGLINE,
            license: PACKAGE_LICENSE,
            codeRepository: REPO_URL,
            programmingLanguage: PACKAGE_LANGUAGE,
            version: PACKAGE_VERSION,
            url: `${SITE_URL}/`,
          },
        ],
      },
    ]);
  });

  it('describes a doc page as an article with its breadcrumb', () => {
    expect(ldBlocks(docHead('/docs', DOCS_TITLE).scripts)).toEqual([
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'TechArticle', headline: DOCS_TITLE, description: PAGE_SEO['/docs'].description, url: `${SITE_URL}/docs`, inLanguage: 'en' },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE_URL}/docs` },
            ],
          },
        ],
      },
    ]);
  });

  it('names each doc page in its breadcrumb as the nav does', () => {
    for (const { label, to } of NAV) {
      if (to === '/') continue;
      const [block] = ldBlocks(docHead(to, label).scripts);
      expect(JSON.stringify(block)).toContain(JSON.stringify({ '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}${to}` }));
    }
  });
});
