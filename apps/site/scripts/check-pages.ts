// The search rules every prerendered page keeps. check-build.ts runs them on dist/client.
// Each page has one h1, a canonical link to its own URL, a title and a description within
// the limits in seo.ts and used by no other page, JSON-LD that parses, and no noindex.
import { DESCRIPTION_MAX, TITLE_MAX } from '../src/data/seo.ts';
import { pageUrl } from '../src/data/site.ts';
import type { PagePath } from '../src/data/site.ts';

export interface BuiltPage {
  readonly path: PagePath;
  readonly html: string;
}

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };

/** Text as the reader sees it, so an escaped character counts once. */
function unescape(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#x27|#39);/gu, (entity) => ENTITIES[entity] ?? entity);
}

/** One attribute of every tag that matches, in page order. */
function attrs(html: string, tag: RegExp, name: string): string[] {
  return [...html.matchAll(tag)].map(([found]) => unescape(new RegExp(`\\b${name}="([^"]*)"`, 'u').exec(found)?.[1] ?? ''));
}

/**
 * Every attribute of one opening tag, by lower-case name. It reads the tag from left to
 * right, so `data-type` is never taken for `type`. As in a browser, the first of two
 * attributes with one name wins. Values may be double-quoted, single-quoted or bare.
 */
function tagAttributes(tag: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  const body = tag.replace(/^<[^\s/>]+/u, '');
  for (const match of body.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!found.has(name)) found.set(name, unescape(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return found;
}

/** One attribute of one tag, in any quote style and letter case. */
function attr(tag: string, name: string): string | undefined {
  return tagAttributes(tag).get(name);
}

// The crawlers whose meta tag can keep a page out of search, and the words that do it.
const CRAWLER_NAMES: ReadonlySet<string> = new Set(['robots', 'googlebot', 'bingbot']);
const BLOCKING_DIRECTIVES: ReadonlySet<string> = new Set(['noindex', 'none']);

/** True when a meta tag tells a search engine to leave the page out of its index. */
function blocksIndexing(html: string): boolean {
  return [...html.matchAll(/<meta\b[^>]*>/giu)].some(([tag]) => {
    if (!CRAWLER_NAMES.has((attr(tag, 'name') ?? '').trim().toLowerCase())) return false;
    // Crawlers accept commas or spaces between directives.
    const directives = (attr(tag, 'content') ?? '').toLowerCase().split(/[\s,]+/u);
    return directives.some((directive) => BLOCKING_DIRECTIVES.has(directive));
  });
}

/** The text of every JSON-LD script, whatever it holds, so a broken block cannot hide. */
function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/giu)]
    .filter((match) => (attr(match[1] ?? '', 'type') ?? '').trim().toLowerCase() === 'application/ld+json')
    .map((match) => match[2] ?? '');
}

interface Head {
  readonly title: string | undefined;
  readonly description: string | undefined;
}

function readHead(html: string): Head {
  const title = /<title>([^<]*)<\/title>/u.exec(html)?.[1];
  const [description] = attrs(html, /<meta\b[^>]*\bname="description"[^>]*>/gu, 'content');
  return { title: title === undefined ? undefined : unescape(title), description };
}

/** The pages that share one value, by value. */
function shared(values: readonly (readonly [PagePath, string | undefined])[]): [string, PagePath[]][] {
  const byValue = new Map<string, PagePath[]>();
  for (const [path, value] of values) {
    if (value === undefined) continue;
    byValue.set(value, [...(byValue.get(value) ?? []), path]);
  }
  return [...byValue].filter(([, paths]) => paths.length > 1);
}

/** Every broken rule across the pages, one line each. An empty list means all pass. */
export function pageHeadProblems(pages: readonly BuiltPage[]): string[] {
  const problems: string[] = [];
  const heads = pages.map(({ path, html }) => {
    const head = readHead(html);
    const h1s = html.match(/<h1\b/gu)?.length ?? 0;
    if (h1s !== 1) problems.push(`${path}: has ${String(h1s)} h1 elements, expected 1`);

    const canonicals = attrs(html, /<link\b[^>]*\brel="canonical"[^>]*>/gu, 'href');
    if (canonicals.join(', ') !== pageUrl(path)) problems.push(`${path}: canonical is [${canonicals.join(', ')}], expected [${pageUrl(path)}]`);

    if (head.title === undefined || head.title === '') problems.push(`${path}: has no title`);
    else if (head.title.length > TITLE_MAX) problems.push(`${path}: title is ${String(head.title.length)} characters, over ${String(TITLE_MAX)}`);
    if (head.description === undefined || head.description === '') problems.push(`${path}: has no description`);
    else if (head.description.length > DESCRIPTION_MAX) problems.push(`${path}: description is ${String(head.description.length)} characters, over ${String(DESCRIPTION_MAX)}`);

    const blocks = jsonLdBlocks(html);
    if (blocks.length === 0) problems.push(`${path}: has no JSON-LD block`);
    blocks.forEach((text, index) => {
      try {
        JSON.parse(text);
      } catch {
        problems.push(`${path}: JSON-LD block ${String(index + 1)} does not parse`);
      }
    });

    if (blocksIndexing(html)) problems.push(`${path}: carries a robots noindex meta`);
    return [path, head] as const;
  });

  for (const [title, paths] of shared(heads.map(([path, head]) => [path, head.title]))) problems.push(`the title "${title}" is on more than one page: ${paths.join(', ')}`);
  for (const [description, paths] of shared(heads.map(([path, head]) => [path, head.description]))) problems.push(`the description "${description}" is on more than one page: ${paths.join(', ')}`);
  return problems;
}
