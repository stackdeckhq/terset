import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { OG_IMAGE_ALT, OG_IMAGE_PATH } from '../brand/og.ts';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { SITE_NAME, SITE_URL, TAGLINE } from '../data/site.ts';
import styles from '../styles.css?url';
import { BOOT_SCRIPT, THEME_COLORS } from '../theme.ts';
import type { Scheme } from '../theme.ts';

const OG_IMAGE = `${SITE_URL}${OG_IMAGE_PATH}`;
const SCHEMES: readonly Scheme[] = ['light', 'dark'];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${SITE_NAME}: same data, fewer tokens` },
      { name: 'description', content: TAGLINE },
      { name: 'color-scheme', content: 'light dark' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: `${SITE_NAME}: same data, fewer tokens` },
      { property: 'og:description', content: TAGLINE },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: OG_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <HeadContent />
        {/* Not in head(): the router keeps one meta per name, so it would drop the light one.
            syncThemeColor in theme.ts updates both when a theme is picked. */}
        {SCHEMES.map((scheme) => (
          <meta key={scheme} name="theme-color" content={THEME_COLORS[scheme]} media={`(prefers-color-scheme: ${scheme})`} />
        ))}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  return (
    <RootDocument>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
    </RootDocument>
  );
}

function NotFound() {
  return (
    <section className="lost" aria-labelledby="h-lost">
      <p className="code-n">404</p>
      <h1 id="h-lost">This page is not here.</h1>
      <p>The link may be old, or the address has a typo.</p>
      <div className="actions">
        <Link to="/" className="btn btn-primary">
          Go to the home page
        </Link>
        <Link to="/format" className="btn btn-line">
          Read the format
        </Link>
      </div>
    </section>
  );
}
