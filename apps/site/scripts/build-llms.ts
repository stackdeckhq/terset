// Writes the raw agent files the site serves into src/generated/.
// Sources: the templates in content/, filled from src/generated/samples.json
// (run generate-samples.ts first), the package SPEC.md, and the benchmark
// text built from the committed bench-results.json.
// llms-full.txt is the agent guide, the docs, the spec and the benchmark in one file.
// Usage: node scripts/build-llms.ts (the dev and build scripts run it).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBench } from '../src/data/bench-schema.ts';
import { benchmarkMarkdown } from '../src/data/benchmark-doc.ts';
import { ClaudeCountsSchema } from '../src/data/claude-counts-schema.ts';
import { docsMarkdown } from '../src/data/docs-md.ts';
import { GeneratedSamplesSchema } from '../src/data/generated-schema.ts';
import { AGENT_PROMPT, PACKAGE_NAME, REPO_URL } from '../src/data/site.ts';
import { SizesSchema } from '../src/data/sizes-schema.ts';
import type { Sizes } from '../src/data/sizes-schema.ts';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { BANNED_NAMES, BANNED_NOTE, loadAgentFileBannedNames } from './banned.ts';
import { renderContent } from './render-content.ts';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const OUT = fileURLToPath(new URL('../src/generated/', import.meta.url));

function read(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trim();
}

const generated = GeneratedSamplesSchema.parse(JSON.parse(read(`${OUT}samples.json`)));
const bench = parseBench(JSON.parse(read(`${SITE}src/data/bench-results.json`)));
const claude = ClaudeCountsSchema.parse(JSON.parse(read(`${SITE}src/data/claude-counts.json`)));
const render = (name: string): string => renderContent(read(`${SITE}content/${name}`), generated, bench);

const agents = render('agents.md');
const docs = docsMarkdown(generated.rules, generated.cheatSheet);
const spec = read(`${SITE}../../packages/terset/SPEC.md`);
const benchmark = benchmarkMarkdown(bench, claude);
const llms = render('llms.txt');
const skill = render('skill/SKILL.md');
const full = [agents, docs, spec, benchmark].join('\n\n---\n\n');

const files: Readonly<Record<string, string>> = {
  'agents.md': agents,
  'docs.md': docs,
  'spec.md': spec,
  'benchmark.md': benchmark,
  'llms.txt': llms,
  'llms-full.txt': full,
  'skill.md': skill,
};

// The raw files speak only about Terset. No dashes, no other names.
// Names the raw files must avoid come from the two local lists in banned.ts.
// The source repo URL and the exact package name are removed before the check,
// so a list may ban the org name and those two mentions still pass.
const SOURCE_URL = REPO_URL;
const PACKAGE = PACKAGE_NAME;
const AGENT_FILE_NAMES = loadAgentFileBannedNames();
const BANNED: readonly (readonly [RegExp, string])[] = [
  [/—/u, 'an em dash'],
  [/–/u, 'an en dash'],
  ...BANNED_NAMES,
  ...AGENT_FILE_NAMES.names,
];
// The skill and the agent files are for any provider, so no vendor is named.
// The benchmark names its two counters and their prices, so it may name the
// vendors; llms-full.txt carries it, and its other parts are checked on their own.
const VENDOR: readonly [RegExp, string] = [/claude|anthropic|openai|gemini|codex/iu, 'a model vendor name'];
const MAY_NAME_VENDORS = new Set(['benchmark.md', 'llms-full.txt']);

mkdirSync(OUT, { recursive: true });
for (const [name, text] of Object.entries(files)) {
  const checked = text.replaceAll(SOURCE_URL, '').replaceAll(PACKAGE, '');
  const banned = MAY_NAME_VENDORS.has(name) ? BANNED : [...BANNED, VENDOR];
  for (const [pattern, what] of banned) {
    if (pattern.test(checked)) throw new Error(`${name} would contain ${what}`);
  }
  writeFileSync(`${OUT}${name}`, `${text}\n`);
}

// Token sizes for the agents page and the prompt card, by served path.
const sizes: Sizes = {
  tokenizer: 'o200k_base',
  prompt: tokens(AGENT_PROMPT).length,
  files: {
    '/agents.md': tokens(agents).length,
    '/docs.md': tokens(docs).length,
    '/spec.md': tokens(spec).length,
    '/benchmark.md': tokens(benchmark).length,
    '/llms.txt': tokens(llms).length,
    '/llms-full.txt': tokens(full).length,
    '/skill/SKILL.md': tokens(skill).length,
  },
};
writeFileSync(`${OUT}sizes.json`, `${JSON.stringify(SizesSchema.parse(sizes), null, 2)}\n`);
console.log(`Wrote ${String(Object.keys(files).length)} raw files to src/generated (llms-full.txt: ${String(full.length)} characters); ${BANNED_NOTE}; ${AGENT_FILE_NAMES.note}.`);
