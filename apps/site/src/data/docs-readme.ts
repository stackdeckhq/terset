// Renders the README blocks that come from the docs source (docs.ts).
// Each block sits between marker comments:
//   <!-- docs:install -->
//   ...
//   <!-- /docs:install -->
// scripts/update-readmes.ts rewrites them. docs.test.ts fails on any drift.
import { BADGES, INSTALL, LANG_FENCE, LANG_LABELS, LANG_NOTES, NAMES, NEVER_BY_HAND, OFFICIAL_LINE, QUICK_START, README_REFERENCE, WHEN_NOT, quickStartSteps } from './docs.ts';
import type { DocLang } from './docs.ts';
import { SITE_URL, TAGLINE } from './site.ts';

/** The three READMEs that carry docs blocks. Paths are from the repository root. */
export const README_FILES = {
  root: 'README.md',
  js: 'packages/terset/README.md',
  py: 'packages/terset-py/README.md',
} as const;
export type ReadmeId = keyof typeof README_FILES;
export const README_IDS: readonly ReadmeId[] = ['root', 'js', 'py'];

export type BlockName = 'header' | 'contents' | 'install' | 'install-py' | 'use' | 'use-py' | 'when-not' | 'reference' | 'agents';

/** The raw agent files the READMEs list, in order. */
const AGENT_FILES: readonly (readonly [path: string, about: string])[] = [
  ['/llms.txt', 'the index.'],
  ['/agents.md', 'everything an agent needs in one read.'],
  ['/docs.md', 'this reference as one plain file.'],
  ['/spec.md', 'every rule of the format.'],
  ['/benchmark.md', 'every count, the method and the limits.'],
  ['/skill/SKILL.md', 'a skill file an agent harness can load.'],
  ['/llms-full.txt', 'the guide, the reference, the spec and the benchmark in one file.'],
];

const fence = (lang: string, text: string): string => `\`\`\`${lang}\n${text}\n\`\`\``;

function header(lang: DocLang): string {
  const badges = BADGES[lang].map((badge) => `  <img src="${badge.src}" alt="${badge.alt}">`);
  return [
    '<p align="center">',
    '  <img src="https://terset.dev/brand/terset-mark.svg" alt="Terset" width="64" height="64">',
    '</p>',
    '',
    '<h1 align="center">Terset</h1>',
    '',
    `<p align="center">${OFFICIAL_LINE[lang]}</p>`,
    '',
    `<p align="center">Terset: ${TAGLINE}</p>`,
    '',
    '<p align="center">',
    ...badges,
    '</p>',
    '',
    `<p align="center"><a href="${SITE_URL}">terset.dev</a> · <a href="${SITE_URL}/docs">Docs</a></p>`,
  ].join('\n');
}

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces to hyphens. */
export function githubAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 -]/gu, '')
    .replaceAll(' ', '-');
}

/** The h2 headings of a Markdown text, outside code fences, in order. */
export function h2Headings(text: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    else if (!inFence && line.startsWith('## ')) out.push(line.slice(3).trim());
  }
  return out;
}

function contents(headings: readonly string[]): string {
  return ['**Contents**', '', ...headings.map((heading) => `- [${heading}](#${githubAnchor(heading)})`)].join('\n');
}

function install(lang: DocLang): string {
  const info = INSTALL[lang];
  return [...info.commands.map((item) => fence('sh', item.command)), info.note].join('\n\n');
}

function use(lang: DocLang): string {
  const name = NAMES[lang];
  const sample = QUICK_START[lang];
  return [
    `The API exports \`${name.encode}\`, \`${name.decode}\`, \`${name.rules}\` and \`${name.rulesFor}\`.\n\`${name.rulesFor}(text)\` gives only the rules sentences that text needs. \`${name.rules}\` keeps the full rules.`,
    fence(LANG_FENCE[lang], sample.code),
    'Output (the gaps are tabs):',
    fence('text', sample.output),
    quickStartSteps(lang)
      .map((step, index) => `${String(index + 1)}. ${step}`)
      .join('\n'),
    NEVER_BY_HAND,
    [`**${LANG_LABELS[lang]} details**`, '', ...LANG_NOTES[lang].map((note) => `- ${note}`)].join('\n'),
  ].join('\n\n');
}

function whenNot(): string {
  return WHEN_NOT.map((item) => `- **${item.title}** ${item.text}`).join('\n');
}

function agents(): string {
  const lines = AGENT_FILES.map(([path, about]) => `- [terset.dev${path}](${SITE_URL}${path}): ${about}`);
  return ['Plain files an agent can read:', '', ...lines].join('\n');
}

/** The blocks one README carries, rendered from the source. `text` gives the README's own headings for its contents list. */
export function expectedBlocks(id: ReadmeId, text: string): Partial<Record<BlockName, string>> {
  const shared = { contents: contents(h2Headings(text)), 'when-not': whenNot(), reference: README_REFERENCE, agents: agents() };
  if (id === 'root') return { ...shared, install: install('js'), use: use('js'), 'install-py': install('py'), 'use-py': use('py') };
  return { ...shared, header: header(id), install: install(id), use: use(id) };
}

/** A marker block. The body may be empty, so a new block can start as an empty pair. */
const BLOCK = /<!-- docs:([a-z-]+) -->\n(?:([\s\S]*?)\n)?<!-- \/docs:\1 -->/gu;

/** Every marker block in a README, by name. */
export function readBlocks(text: string): Map<string, string> {
  return new Map([...text.matchAll(BLOCK)].map((match) => [match[1] ?? '', match[2] ?? '']));
}

/** Rewrites every expected block in a README. A missing or unknown marker is an error. */
export function writeBlocks(id: ReadmeId, text: string): string {
  const expected = expectedBlocks(id, text);
  const found = readBlocks(text);
  for (const name of Object.keys(expected)) {
    if (!found.has(name)) throw new Error(`${README_FILES[id]} has no <!-- docs:${name} --> block`);
  }
  for (const name of found.keys()) {
    if (!(name in expected)) throw new Error(`${README_FILES[id]} has an unknown docs block "${name}"`);
  }
  return text.replace(BLOCK, (_match, name: BlockName) => `<!-- docs:${name} -->\n${expected[name] ?? ''}\n<!-- /docs:${name} -->`);
}

/** The body of each h2 section, by heading, for comparing two READMEs. */
export function sections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = text.split(/^## /mu).slice(1);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    out.set(part.slice(0, newline).trim(), part.slice(newline + 1).trim());
  }
  return out;
}
