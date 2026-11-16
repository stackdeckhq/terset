// The worker entry. It runs the default TanStack Start handler and adds the security headers.
import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { checkSiteData } from './data/data-check.ts';
import { withSecurityHeaders } from './lib/security-headers.ts';

// The browser gets the site data unparsed. Checking it here fails the prerender, and so
// `pnpm build`, when a data file does not match its schema.
checkSiteData();

export default createServerEntry({
  async fetch(request, opts) {
    return withSecurityHeaders(await handler.fetch(request, opts));
  },
});
