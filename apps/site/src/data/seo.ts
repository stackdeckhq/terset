// What search engines show for each page: its title, description and JSON-LD.
// Titles say what the page is in the words people search for the problem.
// They name no other format. No number is typed here; copy with a number reads it from a data module.
// The JSON-LD holds only facts the page itself shows, read from site.ts.
import { GOOGLE_SITE_VERIFICATION, NAV, PACKAGE_LANGUAGE, PACKAGE_LICENSE, PACKAGE_VERSION, pageUrl, REPO_URL, SITE_NAME, TAGLINE } from './site.ts';
import type { DocPagePath, PagePath } from './site.ts';

/** Longest title a results page shows in full. */
export const TITLE_MAX = 60;
/** Longest description a results page shows in full. */
export const DESCRIPTION_MAX = 160;

export interface PageSeo {
  readonly title: string;
  readonly description: string;
}

export const PAGE_SEO: Readonly<Record<PagePath, PageSeo>> = {
  '/': {
    title: 'Terset: encode JSON for LLM prompts in fewer tokens',
    description: 'Terset writes JSON records as one compact table, so an LLM reads the same data in fewer tokens. Try the converter in the browser, or install it from npm.',
  },
  '/docs': {
    title: 'Terset docs: encode JSON records as token-saving tables',
    description: 'Install Terset for JavaScript or Python, encode JSON records for an LLM prompt, and look up every function, error and limit.',
  },
  '/format': {
    title: 'Terset format spec: a compact table format for JSON data',
    description: 'Every rule of the Terset format: the root object or array, counted and keyed tables, dotted columns, cells, quoting, nested values and decoding.',
  },
  '/benchmark': {
    title: 'Terset benchmark: LLM prompt tokens and accuracy vs JSON',
    description: 'How many tokens Terset saves over JSON in LLM prompts: token counts per case, input cost at list price, answer accuracy, the method and the limits.',
  },
  '/workload': {
    title: 'Terset on real JSON files: LLM accuracy and input tokens',
    description: 'Accuracy and whole-prompt input tokens for Terset, compact JSON and TOON on two real public files, two models and two question sets, with every wrong answer.',
  },
  '/agents': {
    title: 'Terset for coding agents: LLM prompt, skill and llms.txt',
    description: 'What a coding agent needs to send JSON data to an LLM with Terset: a prompt to paste, the agent guide, a skill file, the spec and llms.txt.',
  },
};

/** The title and description of one page, with their og and twitter copies. */
export function seoMeta(path: PagePath) {
  const { title, description } = PAGE_SEO[path];
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
  ];
}

/** The home page's meta: its own copy, plus the tag that proves ownership to Google. */
export function homeMeta() {
  return [...seoMeta('/'), { name: 'google-site-verification', content: GOOGLE_SITE_VERIFICATION }];
}

export type JsonLdValue = string | number | boolean | null | JsonLd | readonly JsonLdValue[];
export interface JsonLd {
  readonly [key: string]: JsonLdValue;
}

export interface JsonLdScript {
  readonly type: 'application/ld+json';
  readonly children: string;
}

/** One JSON-LD script for a page head. `<` is escaped, so the text can never close the script tag. */
export function jsonLdScript(data: JsonLd): JsonLdScript {
  return { type: 'application/ld+json', children: JSON.stringify(data).replace(/</gu, '\\u003c') };
}

function graph(nodes: readonly JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** The home page: the site itself and the source code it ships. */
export function homeJsonLd(): JsonLdScript[] {
  const url = pageUrl('/');
  return [
    jsonLdScript(
      graph([
        { '@type': 'WebSite', name: SITE_NAME, url, description: PAGE_SEO['/'].description },
        {
          '@type': 'SoftwareSourceCode',
          name: SITE_NAME,
          description: TAGLINE,
          license: PACKAGE_LICENSE,
          codeRepository: REPO_URL,
          programmingLanguage: PACKAGE_LANGUAGE,
          version: PACKAGE_VERSION,
          url,
        },
      ]),
    ),
  ];
}

/** The nav label of a doc page, which its breadcrumb repeats. */
function navLabel(path: DocPagePath): string {
  const link = NAV.find((item) => item.to === path && item.hash === undefined);
  if (link === undefined) throw new Error(`No nav link for ${path}`);
  return link.label;
}

/** A doc page: an article under its visible h1, and its place under home. */
export function docJsonLd(path: DocPagePath, headline: string): JsonLdScript[] {
  const url = pageUrl(path);
  return [
    jsonLdScript(
      graph([
        { '@type': 'TechArticle', headline, description: PAGE_SEO[path].description, url, inLanguage: 'en' },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: SITE_NAME, item: pageUrl('/') },
            { '@type': 'ListItem', position: 2, name: navLabel(path), item: url },
          ],
        },
      ]),
    ),
  ];
}
