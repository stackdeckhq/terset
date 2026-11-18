// The frame every doc page shares: a heading block, an optional contents list, then the body.
import type { ReactNode } from 'react';
import { docJsonLd, seoMeta } from '../data/seo.ts';
import { canonicalHead } from '../data/site.ts';
import type { DocPagePath } from '../data/site.ts';
import type { Heading } from '../lib/markdown.ts';

export interface DocPageProps {
  readonly kicker: string;
  readonly title: string;
  readonly lead: string;
  readonly actions?: ReactNode;
  /** Shows a contents list beside the body on wide screens. */
  readonly headings?: readonly Heading[];
  /** A page's own contents list, in place of the one built from `headings`. */
  readonly toc?: ReactNode;
  readonly children: ReactNode;
}

export function DocPage({ kicker, title, lead, actions, headings, toc: ownToc, children }: DocPageProps) {
  const toc = ownToc === undefined && headings !== undefined && headings.length > 0;
  return (
    <article className="doc" aria-labelledby="doc-h">
      <header className="doc-head">
        <p className="kicker">{kicker}</p>
        <h1 id="doc-h">{title}</h1>
        <p className="lead">{lead}</p>
        {actions === undefined ? null : <div className="doc-actions">{actions}</div>}
      </header>
      <div className={toc || ownToc !== undefined ? 'doc-body with-toc' : 'doc-body'}>
        {ownToc}
        {toc ? (
          <nav className="toc" aria-labelledby="toc-h">
            <h2 id="toc-h">On this page</h2>
            <ol>
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div>{children}</div>
      </div>
    </article>
  );
}

/** Title, description, canonical and JSON-LD for one doc page. `headline` is the page's h1. The copy lives in seo.ts. */
export function docHead(path: DocPagePath, headline: string) {
  const canonical = canonicalHead(path);
  return {
    meta: [...seoMeta(path), ...canonical.meta],
    links: canonical.links,
    scripts: docJsonLd(path, headline),
  };
}
