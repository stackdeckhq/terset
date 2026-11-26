// Renders the README blocks that come from the docs source (docs.ts).
// Each block sits between marker comments:
//   <!-- docs:install -->
//   ...
//   <!-- /docs:install -->
// scripts/update-readmes.ts rewrites them. docs.test.ts fails on any drift.
import { encode as tokenize } from 'gpt-tokenizer/encoding/o200k_base';
import benchRaw from './bench-results.json' with { type: 'json' };
import claudeRaw from './claude-counts.json' with { type: 'json' };
import { ACCURACY, accuracyOverlapLine } from './accuracy.ts';
import { TOON_BEST_NOTE, benchTotals, formatCount, underJson, underToon } from './bench.ts';
import type { BenchFile } from './bench.ts';
import type { ClaudeCounts } from './claude-counts-schema.ts';
import { buildCounters, counterLosses } from './counters.ts';
import type { Counter } from './counters.ts';
import {
  BADGES,
  COMPARE_CSV,
  COMPARE_TOON_SHAPE,
  FAQ_NAME,
  FAQ_RULES,
  FAQ_STABLE,
  INSTALL,
  LANG_FENCE,
  LANG_LABELS,
  LANG_NOTES,
  NAMES,
  NEVER_BY_HAND,
  OFFICIAL_LINE,
  PITCH_HIGHLIGHTS,
  PITCH_INTRO,
  QUICK_START,
  README_REFERENCE,
  WHEN_NOT,
  implementationsMarkdown,
  quickStartCommand,
  quickStartSteps,
} from './docs.ts';
import type { DocLang } from './docs.ts';
import { PRICES } from './prices.ts';
import { SITE_URL, TAGLINE } from './site.ts';
import { WORKED_EXAMPLE, WORKED_README_PLACEMENT, workedExampleAtSize } from './worked-example.ts';
import type { WorkedExample } from './worked-example.ts';

/** The three READMEs that carry docs blocks. Paths are from the repository root. */
export const README_FILES = {
  root: 'README.md',
  js: 'packages/terset/README.md',
  py: 'packages/terset-py/README.md',
} as const;
export type ReadmeId = keyof typeof README_FILES;
export const README_IDS: readonly ReadmeId[] = ['root', 'js', 'py'];

export type BlockName = 'header' | 'pitch' | 'contents' | 'see-it' | 'install' | 'install-py' | 'use' | 'use-py' | 'compare' | 'bench-summary' | 'when-not' | 'faq' | 'reference' | 'implementations' | 'agents';

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
    `<p align="center">${TAGLINE}</p>`,
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
    `Save this as \`${sample.filename}\`.`,
    fence(LANG_FENCE[lang], sample.code),
    fence('sh', quickStartCommand(lang)),
    'Output (the gaps are tabs):',
    fence('text', sample.output),
    quickStartSteps(lang)
      .map((step, index) => `${String(index + 1)}. ${step}`)
      .join('\n'),
    NEVER_BY_HAND,
    [`**${LANG_LABELS[lang]} details**`, '', ...LANG_NOTES[lang].map((note) => `- ${note}`)].join('\n'),
  ].join('\n\n');
}

function exampleCounts({ json, terset, rules }: WorkedExample) {
  const prompt = rules === '' ? terset : `${rules}\n${terset}`;
  const jsonTokens = tokenize(json).length;
  const promptTokens = tokenize(prompt).length;
  const row = (label: string, value: string, tokens: number): string =>
    `| ${label} | ${String(Buffer.byteLength(value))} | ${String(tokens)} |`;
  return {
    jsonTokens,
    promptTokens,
    table: [
      '| Format | Bytes | Tokens |',
      '| --- | --- | --- |',
      row('Terset data alone', terset, tokenize(terset).length),
      row('Terset data plus rules', prompt, promptTokens),
      row('Compact JSON', json, jsonTokens),
    ].join('\n'),
  };
}

function largerExample(): readonly string[] {
  for (const count of [10, 25, 50]) {
    const measured = exampleCounts(workedExampleAtSize(count));
    // Show a saving of at least 10% after paying for the rules.
    if (measured.promptTokens > measured.jsonTokens * 0.9) continue;
    return [
      `Repeat the same record shapes to make ${String(count)} users, each with a unique ID. With the rules included, Terset uses ${String(measured.jsonTokens - measured.promptTokens)} fewer tokens.`,
      measured.table,
    ];
  }
  return [];
}

/** The "See it" example: JSON in, the Terset text and rules line out, and where they go. */
function seeIt(): string {
  const example = WORKED_EXAMPLE;
  return [
    'The same data, as compact JSON and as Terset.',
    fence('json', example.json),
    fence('text', example.terset),
    'The gaps between cells are real tab characters.',
    'The fitted rules line for this text:',
    fence('text', example.rules),
    `${WORKED_README_PLACEMENT} The [benchmark page](${SITE_URL}/benchmark#what-gets-sent) shows the full prompt.`,
    'Counts use the `o200k_base` tokenizer. The rules line and the data are counted together with a newline between them.',
    exampleCounts(example).table,
    'Four records do not save enough tokens to pay for the rules line.',
    ...largerExample(),
  ].join('\n\n');
}

/** Both counters from the committed files. The READMEs state numbers, so a pending file is an error here. */
function readmeCounters(): { readonly o200k: Counter; readonly claude: Counter } {
  const counters = buildCounters(benchRaw as BenchFile, claudeRaw as ClaudeCounts, PRICES);
  if (counters === null || counters.claude === null) throw new Error('The README numbers need both bench-results.json and claude-counts.json to be ready');
  return { o200k: counters.o200k, claude: counters.claude };
}

/** "26.5%": how much smaller `value` is than `base`. Throws when it is not smaller, so no README line can claim a saving that is not there. */
function fewer(value: number, base: number): string {
  if (value >= base) throw new Error(`Expected ${String(value)} to be under ${String(base)}`);
  return `${(Math.round(((base - value) / base) * 1000) / 10).toFixed(1)}%`;
}

/** "in 10 of 11 cases on both counters", or each counter named when they differ. */
function inCases(count: (counter: Counter) => number, o200k: Counter, claude: Counter): string {
  const total = String(o200k.cases.length);
  if (count(o200k) === count(claude)) return `in ${String(count(o200k))} of ${total} cases on both counters`;
  return `in ${String(count(o200k))} of ${total} cases on ${o200k.name} and ${String(count(claude))} on Claude`;
}

/** The problem, the idea and the highlights, right under the title. */
function pitch(): string {
  const { o200k, claude } = readmeCounters();
  const open = benchTotals(o200k);
  const own = benchTotals(claude);
  const tokens = `- **Fewer tokens.** Over the ${String(o200k.cases.length)} benchmark cases, Terset used ${fewer(open.terset, open.json)} fewer tokens than compact JSON and ${fewer(open.terset, open.toon)} fewer than TOON's best form, counted with the \`${o200k.name}\` tokenizer. Claude's own count for ${claude.label} gives ${fewer(own.terset, own.json)} and ${fewer(own.terset, own.toon)}. [See the benchmark](#benchmark).`;
  return [PITCH_INTRO, [tokens, ...PITCH_HIGHLIGHTS.map((item) => `- **${item.title}** ${item.text}`)].join('\n')].join('\n\n');
}

/** One honest line per alternative, with the counts that back it. */
function compare(): string {
  const { o200k, claude } = readmeCounters();
  const open = benchTotals(o200k);
  const toonWins = (counter: Counter): number => counter.cases.filter((row) => row.toon < row.terset).length;
  const csvWins = (counter: Counter): number => counter.cases.filter((row) => row.csv !== null && row.csv < row.terset).length;
  if (csvWins(o200k) === 0 && csvWins(claude) === 0) throw new Error('The CSV line says CSV is smaller in some cases, but it is smaller in none');
  return [
    `- **Compact JSON** is the baseline here. Terset is smaller ${inCases(underJson, o200k, claude)}.`,
    `- **TOON** is another table format for prompts. Terset is smaller ${inCases(underToon, o200k, claude)}. TOON's best form is smaller in ${String(toonWins(o200k))} on ${o200k.name} and ${String(toonWins(claude))} on Claude, all listed in the benchmark below. ${COMPARE_TOON_SHAPE}`,
    `- **CSV** needs no rules line, so it is smaller than Terset ${inCases(csvWins, o200k, claude)}. ${COMPARE_CSV}`,
    `- **YAML and pretty JSON** are easy for people to read and cost the most in total here. Over all ${String(o200k.cases.length)} cases on ${o200k.name}, Terset is ${fewer(open.terset, open.yaml)} smaller than YAML and ${fewer(open.terset, open.jsonPretty)} smaller than pretty JSON.`,
  ].join('\n');
}

/** The totals table at the top of the Benchmark section. The full ledger follows it. */
function benchSummary(): string {
  const { o200k, claude } = readmeCounters();
  const open = benchTotals(o200k);
  const own = benchTotals(claude);
  const rows: readonly (readonly [name: string, key: keyof typeof open])[] = [
    ['Terset', 'terset'],
    ['TOON best', 'toon'],
    ['Compact JSON', 'json'],
    ['YAML', 'yaml'],
    ['Pretty JSON', 'jsonPretty'],
  ];
  return [
    `Total tokens over all ${String(o200k.cases.length)} cases. Lower is better. Terset counts include its fitted rules line. ${TOON_BEST_NOTE}`,
    [`| Format | ${o200k.name} | ${claude.label} |`, '| --- | --- | --- |', ...rows.map(([name, key]) => `| ${name} | ${formatCount(open[key])} | ${formatCount(own[key])} |`)].join('\n'),
    [o200k, claude].map((counter) => `- ${counterLosses(counter)}`).join('\n'),
    `The two counters are the \`${o200k.name}\` tokenizer and Claude's own token count for ${claude.label}. They give different numbers for the same text. Open the section below for every case, the input cost and the method.`,
  ].join('\n\n');
}

/** Short answers to the questions a new reader asks first. */
function faq(): string {
  const accuracy = `**Does it change answer accuracy?** Each model answered the same ${formatCount(ACCURACY.questions)} questions in each format. ${accuracyOverlapLine(ACCURACY)} See [Answer accuracy](#answer-accuracy).`;
  return [FAQ_STABLE, accuracy, FAQ_RULES, FAQ_NAME].join('\n\n');
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
  const shared = {
    pitch: pitch(),
    contents: contents(h2Headings(text)),
    'see-it': seeIt(),
    compare: compare(),
    'bench-summary': benchSummary(),
    'when-not': whenNot(),
    faq: faq(),
    reference: README_REFERENCE,
    implementations: implementationsMarkdown(),
    agents: agents(),
  };
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
