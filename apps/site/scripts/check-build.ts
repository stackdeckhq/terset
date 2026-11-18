// Runs after `vite build`. The Cloudflare Vite plugin writes the static assets to
// dist/client and the worker to dist/server, with the deploy config in
// dist/server/wrangler.json. Fails the build when:
// 1. the Workers layout or its deploy config is not the one terset.dev expects, a page
//    lacks its prerendered HTML or either theme-color meta, or a raw agent file has a static copy,
// 2. the dev-only fake bench fixture reached the output,
// 3. the committed bench is pending but the output lacks the pending text,
// 4. a banned name appears in the output, source maps included,
// 5. zod reached the browser code. The site data is checked on the server and in tests,
// 6. a page breaks a search rule: it needs exactly one h1, a canonical link to its own URL,
//    a title and a description within the limits and used by no other page, JSON-LD that
//    parses, and no noindex (see check-pages.ts).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseBench } from '../src/data/bench-schema.ts';
import { PENDING_TITLE } from '../src/data/bench.ts';
import { PAGE_PATHS, RAW_FILES } from '../src/data/site.ts';
import { THEME_COLORS } from '../src/theme.ts';
import { BANNED_NAMES, BANNED_NOTE } from './banned.ts';
import { pageHeadProblems } from './check-pages.ts';
import type { BuiltPage } from './check-pages.ts';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(SITE, 'dist');
const CLIENT = join(DIST, 'client');
const SERVER = join(DIST, 'server');
// Kept in parts so this file does not hold the marker itself.
const FIXTURE_MARKER = ['FAKE', 'DEV', 'FIXTURE'].join('-');
// The name zod 4 gives its base schema class. It is a string in every zod bundle, minified or not.
const ZOD_MARKER = '$ZodType';
const TEXT_FILE = /\.(?:js|mjs|map|html|css|json|txt|md|svg)$/u;
const TEXT_NAMES = new Set(['_headers', '.assetsignore']);

// Only the fields this check relies on. The plugin writes many more.
const DeployConfig = z.object({
  name: z.literal('terset-site'),
  main: z.literal('index.js'),
  compatibility_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  compatibility_flags: z.array(z.string()),
  workers_dev: z.literal(false),
  preview_urls: z.literal(false),
  routes: z.tuple([z.object({ pattern: z.literal('terset.dev'), custom_domain: z.literal(true) }).strict()]),
  assets: z.object({ directory: z.literal('../client') }),
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** A page's theme-color metas as "content media" text, in page order. */
function themeColorMetas(html: string): string[] {
  return [...html.matchAll(/<meta\b[^>]*\bname="theme-color"[^>]*>/gu)].map(([tag]) => {
    const content = /\bcontent="([^"]*)"/u.exec(tag)?.[1] ?? 'no content';
    const media = /\bmedia="([^"]*)"/u.exec(tag)?.[1] ?? 'no media';
    return `${content} ${media}`;
  });
}

const failures: string[] = [];

const REQUIRED = [join(SERVER, 'index.js'), join(SERVER, 'wrangler.json'), join(CLIENT, 'robots.txt'), join(CLIENT, 'sitemap.xml'), join(CLIENT, '_headers')];
for (const path of REQUIRED) {
  if (!existsSync(path)) failures.push(`${path.slice(SITE.length)}: missing from the Workers output`);
}

// Every page is prerendered to static HTML (see vite.config.ts): / to index.html, /docs to docs.html.
// Each page carries one theme-color meta per scheme, with its media query (see __root.tsx).
const THEME_METAS = (['light', 'dark'] as const).map((scheme) => `${THEME_COLORS[scheme]} (prefers-color-scheme: ${scheme})`);
const builtPages: BuiltPage[] = [];
for (const page of PAGE_PATHS) {
  const path = join(CLIENT, page === '/' ? 'index.html' : `${page.slice(1)}.html`);
  const html = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (html === null) failures.push(`${path.slice(SITE.length)}: the prerendered ${page} page is missing`);
  else if (!html.startsWith('<!DOCTYPE html>')) failures.push(`${path.slice(SITE.length)}: the prerendered ${page} page is not an HTML document`);
  else {
    const metas = themeColorMetas(html);
    if (metas.join('; ') !== THEME_METAS.join('; ')) failures.push(`${path.slice(SITE.length)}: theme-color metas are [${metas.join('; ')}], expected [${THEME_METAS.join('; ')}]`);
    builtPages.push({ path: page, html });
  }
}
failures.push(...pageHeadProblems(builtPages));
// The raw agent files stay with the worker, which sets their content type and cache.
for (const { path } of RAW_FILES) {
  if (existsSync(join(CLIENT, path.slice(1)))) failures.push(`dist/client${path}: a static copy would bypass the worker`);
}

const configPath = join(SERVER, 'wrangler.json');
if (existsSync(configPath)) {
  const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
  const config = DeployConfig.safeParse(raw);
  if (!config.success) failures.push(`dist/server/wrangler.json: ${config.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
  if (typeof raw === 'object' && raw !== null && 'account_id' in raw) failures.push('dist/server/wrangler.json: holds an account id; it must come from CLOUDFLARE_ACCOUNT_ID');
}

const files = walk(DIST).filter((path) => TEXT_FILE.test(path) || TEXT_NAMES.has(basename(path)));
const texts = files.map((path) => ({ path: path.slice(SITE.length), text: readFileSync(path, 'utf8') }));

for (const { path, text } of texts) {
  if (text.includes(FIXTURE_MARKER)) failures.push(`${path}: holds the dev-only bench fixture`);
  if (path.startsWith('dist/client/') && path.endsWith('.js') && text.includes(ZOD_MARKER)) failures.push(`${path}: ships zod to the browser`);
  for (const [pattern, name] of BANNED_NAMES) {
    if (pattern.test(text)) failures.push(`${path}: contains ${name}`);
  }
}

const bench = parseBench(JSON.parse(readFileSync(join(SITE, 'src/data/bench-results.json'), 'utf8')));
if (bench.status === 'pending' && !texts.some(({ text }) => text.includes(PENDING_TITLE))) failures.push('the bench is pending, but no output file shows the pending text');

if (failures.length > 0) {
  console.error(`check-build FAIL: ${String(failures.length)} problem(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`check-build PASS: ${String(texts.length)} output files; Workers layout and deploy config ok; ${String(builtPages.length)} pages keep the search rules; no fixture, no zod in the browser, no banned name (${BANNED_NOTE}); bench ${bench.status}.`);
