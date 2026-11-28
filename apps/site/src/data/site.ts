// Site-wide facts: the address, the nav, the raw files and the agent prompt.

export const SITE_URL = 'https://terset.dev';
export const SITE_NAME = 'Terset';
export const TAGLINE = 'A compact text format for JSON records in LLM prompts. Same data, fewer input tokens.';
export const SHORT_TAGLINE = 'One terse table for a set of JSON records.';
/** Google Search Console reads this from the home page to prove who owns the site. Removing it ends the proof. */
export const GOOGLE_SITE_VERIFICATION = 'SiBnGI20KR2nbzKE2nSnThNJoqa90izcws96uHdp6dY';

export type PagePath = '/' | '/docs' | '/format' | '/benchmark' | '/workload' | '/agents';
/** The pages framed by DocPage: every page but home. */
export type DocPagePath = Exclude<PagePath, '/'>;

/** The six pages, in sitemap order. public/sitemap.xml lists the same URLs; a test checks it. */
export const PAGE_PATHS: readonly PagePath[] = ['/', '/docs', '/format', '/benchmark', '/workload', '/agents'];

/** The absolute https://terset.dev address of one page. */
export function pageUrl(path: PagePath): string {
  return `${SITE_URL}${path}`;
}

/** The canonical link and og:url for one page. */
export function canonicalHead(path: PagePath) {
  return {
    meta: [{ property: 'og:url', content: pageUrl(path) }],
    links: [{ rel: 'canonical', href: pageUrl(path) }],
  };
}

export interface NavLink {
  readonly label: string;
  readonly to: PagePath;
  readonly hash?: string;
}

export const NAV: readonly NavLink[] = [
  { label: 'Converter', to: '/', hash: 'b2' },
  { label: 'Docs', to: '/docs' },
  { label: 'Format', to: '/format' },
  { label: 'Benchmark', to: '/benchmark' },
  { label: 'Real files', to: '/workload' },
  { label: 'Agents', to: '/agents' },
];

export type RawPath = '/agents.md' | '/docs.md' | '/spec.md' | '/benchmark.md' | '/llms.txt' | '/llms-full.txt' | '/skill/SKILL.md';

/**
 * What a raw file tells search engines. A file that mirrors a page names that page as
 * canonical. A file that only repeats others stays out of the index. The rest say nothing.
 */
export type RawSearch = { readonly kind: 'canonical'; readonly page: DocPagePath } | { readonly kind: 'noindex' } | { readonly kind: 'none' };

export interface RawFile {
  readonly path: RawPath;
  readonly label: string;
  readonly about: string;
  readonly contentType: string;
  readonly search: RawSearch;
}

const MARKDOWN = 'text/markdown; charset=utf-8';
const PLAIN = 'text/plain; charset=utf-8';

export const RAW_FILES: readonly RawFile[] = [
  { path: '/agents.md', label: 'agents.md', about: 'The agent guide. When to use Terset, the encode call, the rules and how to read a table.', contentType: MARKDOWN, search: { kind: 'canonical', page: '/agents' } },
  { path: '/skill/SKILL.md', label: 'SKILL.md', about: 'A skill file any agent harness can load. It teaches reading and writing Terset.', contentType: MARKDOWN, search: { kind: 'none' } },
  { path: '/docs.md', label: 'docs.md', about: 'The reference for JavaScript and Python. Install, the API, errors and limits.', contentType: MARKDOWN, search: { kind: 'canonical', page: '/docs' } },
  { path: '/spec.md', label: 'spec.md', about: 'Every rule of the format, with examples.', contentType: MARKDOWN, search: { kind: 'canonical', page: '/format' } },
  { path: '/benchmark.md', label: 'benchmark.md', about: 'The method, the limits and every token count.', contentType: MARKDOWN, search: { kind: 'canonical', page: '/benchmark' } },
  { path: '/llms.txt', label: 'llms.txt', about: 'A short index of these files for language models.', contentType: PLAIN, search: { kind: 'none' } },
  { path: '/llms-full.txt', label: 'llms-full.txt', about: 'The agent guide, the reference, the spec and the benchmark in one file.', contentType: PLAIN, search: { kind: 'noindex' } },
];

export function rawUrl(path: RawPath): string {
  return `${SITE_URL}${path}`;
}

// Release facts. Every page that names the package, its version, its license or
// its source reads them from here. A test checks them against packages/terset/package.json.
export const PACKAGE_NAME = '@stackdeck/terset';
export const PYPI_NAME = 'terset';
export const PACKAGE_VERSION = '0.4.0';
export const PACKAGE_LICENSE = 'MIT';
/** The language of the npm package, as /docs names it. */
export const PACKAGE_LANGUAGE = 'JavaScript';
export const REPO_URL = 'https://github.com/stackdeckhq/terset';
export const NPM_URL = `https://www.npmjs.com/package/${PACKAGE_NAME}`;
/** One line that says what ships and where. */
export const RELEASE_LINE = `${PACKAGE_NAME} ${PACKAGE_VERSION} on npm, ${PACKAGE_LICENSE}`;

export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const INSTALL_COMMANDS: Readonly<Record<PackageManager, string>> = {
  pnpm: `pnpm add ${PACKAGE_NAME}`,
  npm: `npm install ${PACKAGE_NAME}`,
  yarn: `yarn add ${PACKAGE_NAME}`,
  bun: `bun add ${PACKAGE_NAME}`,
};

/** The prompt card: what it is called and who it is for. */
export const AGENT_PROMPT_TITLE = 'Agent prompt';
export const AGENT_PROMPT_FOR = 'For a coding agent that writes prompts. Paste it into its instructions.';

export const AGENT_PROMPT = [
  `Read ${SITE_URL}/agents.md before you write any prompt.`,
  `Use ${PACKAGE_NAME} on npm for JavaScript or ${PYPI_NAME} on PyPI for Python. Avoid look-alike package names.`,
  'When a prompt carries a list of JSON records, encode it with Terset and send the fitted rules right before the data.',
  'Keep JSON for config and tiny data, and ask for answers in JSON.',
].join('\n');
