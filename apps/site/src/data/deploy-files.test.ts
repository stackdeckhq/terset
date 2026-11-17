// Keeps the hand-written static files in public/ in step with the data they repeat.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OG_IMAGE_PATH } from '../brand/og.ts';
import { SECURITY_HEADERS, withSecurityHeaders } from '../lib/security-headers.ts';
import { PAGE_PATHS, SITE_URL, pageUrl } from './site.ts';

const publicUrl = (name: string): URL => new URL(`../../public/${name}`, import.meta.url);
const read = (name: string): string => readFileSync(publicUrl(name), 'utf8');

/** Reads public/_headers as path rule to header lines, in file order. Fails on any line outside that shape. */
function headerRules(): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of read('_headers').split('\n')) {
    if (line === '') continue;
    if (line.startsWith('  ')) {
      if (current === undefined) throw new Error(`_headers: a header comes before any path: ${line}`);
      current.push(line.slice(2));
    } else if (line.startsWith('/')) {
      current = [];
      rules.set(line, current);
    } else throw new Error(`_headers: unexpected line: ${line}`);
  }
  return rules;
}

describe('public deploy files', () => {
  it('sitemap.xml lists exactly the site pages on the live address', () => {
    const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
    expect(locs).toEqual(PAGE_PATHS.map(pageUrl));
    expect(locs.every((loc) => loc?.startsWith(`${SITE_URL}/`) === true)).toBe(true);
  });

  it('robots.txt allows every crawler and points at the sitemap', () => {
    expect(read('robots.txt')).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  });

  it('_headers gives static assets the same security headers as the worker', () => {
    expect(headerRules().get('/*')).toEqual(Object.entries(SECURITY_HEADERS).map(([name, value]) => `${name}: ${value}`));
  });

  it('_headers caches only the hashed build assets for a year', () => {
    const rules = headerRules();
    expect([...rules.keys()]).toEqual(['/*', '/assets/*']);
    expect(rules.get('/assets/*')).toEqual(['Cache-Control: public, max-age=31536000, immutable']);
    // Pages match only /*, so they keep the default revalidating cache.
    expect(rules.get('/*')?.some((line) => line.toLowerCase().startsWith('cache-control:'))).toBe(false);
  });

  it('the share image the pages link to is a 1200x630 PNG, and the old one is gone', () => {
    const png = readFileSync(publicUrl(OG_IMAGE_PATH.slice(1)));
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.toString('latin1', 12, 16)).toBe('IHDR');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect(existsSync(publicUrl('og.png'))).toBe(false);
    expect(existsSync(publicUrl('og-v3.png'))).toBe(false);
  });
});

describe('withSecurityHeaders', () => {
  it('adds every header and keeps the status, body and content type', async () => {
    const response = withSecurityHeaders(new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } }));
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('text/html');
    expect(await response.text()).toBe('missing');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value);
  });
});
