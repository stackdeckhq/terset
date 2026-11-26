// Checks the rendered agent docs against the real encoder and decoder.
// 1. Every ```terset block decodes, matches the ```json block right after it,
//    and is exactly what encode() writes for that JSON.
// 2. agents.md and SKILL.md carry the encoder's RULES sentence word for word.
// 3. The skill repeats the first agents.md example.
// 4. No doc quotes a token figure while the bench is pending. Once it is
//    ready, agents.md carries the summary computed from the bench file.
// 5. agents.md stays under 900 tokens.
// 6. No doc has an em dash, an en dash or a model vendor name.
// It reads only. `pnpm test` runs it after the build wrote src/generated/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { parseBench } from '../src/data/bench-schema.ts';
import { benchSummary } from '../src/data/bench.ts';
import { GeneratedSamplesSchema } from '../src/data/generated-schema.ts';
import { AGENT_PROMPT } from '../src/data/site.ts';
import { RULES, decode, encode } from '../src/lib/format.ts';
import type { JsonRoot } from '../src/lib/format.ts';
import { buildSamples } from './samples-build.ts';
import { renderContent } from './render-content.ts';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const CONTENT = join(SITE, 'content');
const SPEC = join(SITE, '../../packages/terset/SPEC.md');
const AGENTS_TOKEN_LIMIT = 900;

const failures: string[] = [];
const read = (path: string): string => readFileSync(path, 'utf8');

interface Fence {
  readonly lang: string;
  readonly body: string;
}

function fencesOf(markdown: string): Fence[] {
  return [...markdown.matchAll(/^```(\w+)\n([\s\S]*?)\n```$/gm)].map((match) => ({ lang: match[1] ?? '', body: match[2] ?? '' }));
}

const generated = GeneratedSamplesSchema.parse(buildSamples());
const bench = parseBench(JSON.parse(read(join(SITE, 'src/data/bench-results.json'))));
const agents = renderContent(read(join(CONTENT, 'agents.md')), generated, bench);
const skill = renderContent(read(join(CONTENT, 'skill/SKILL.md')), generated, bench);
const llms = renderContent(read(join(CONTENT, 'llms.txt')), generated, bench);

const bugForm = join(SITE, '../../.github/ISSUE_TEMPLATE/bug_report.yml');
for (const [name, text] of [
  ['agents.md', agents],
  ['SKILL.md', skill],
  ['Agent prompt', AGENT_PROMPT],
  ['bug_report.yml', read(bugForm)],
] as const) {
  const plain = text.replaceAll('`', '');
  if (!plain.includes('@stackdeck/terset on npm') || !plain.includes('terset on PyPI')) {
    failures.push(`${name} must name both official packages and their registries`);
  }
  if (/only real package/iu.test(plain)) failures.push(`${name} says there is only one official package`);
}

function checkExamples(name: string, text: string): number {
  const fences = fencesOf(text);
  let examples = 0;
  fences.forEach((fence, index) => {
    if (fence.lang !== 'terset') return;
    examples += 1;
    const label = `${name} example ${String(examples)}`;
    const next = fences[index + 1];
    if (next?.lang !== 'json') {
      failures.push(`${label}: no json block right after it`);
      return;
    }
    const expected = JSON.parse(next.body) as JsonRoot;
    try {
      if (JSON.stringify(decode(fence.body)) !== JSON.stringify(expected)) failures.push(`${label}: decodes to other JSON than the doc shows`);
    } catch (error) {
      failures.push(`${label}: does not decode: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (encode(expected) !== fence.body) failures.push(`${label}: not the encoder's output`);
  });
  return examples;
}

const examples = checkExamples('agents.md', agents) + checkExamples('SKILL.md', skill);
if (examples === 0) failures.push('the docs have no terset examples');

for (const [name, text] of [['agents.md', agents], ['SKILL.md', skill], ['SPEC.md', read(SPEC)]] as const) {
  if (!text.includes(RULES)) failures.push(`${name} does not carry the encoder's RULES sentence`);
}

const firstExample = fencesOf(agents).find((fence) => fence.lang === 'terset')?.body;
if (firstExample === undefined || !skill.includes(firstExample)) failures.push('SKILL.md example differs from the first agents.md example');

const TOKEN_FIGURE = /\b\d[\d,]*\s+tokens\b|\d+(?:\.\d+)?%\s+(?:fewer|more|smaller)|\bin \d+ of \d+\b/iu;
if (bench.status === 'pending') {
  for (const [name, text] of [['agents.md', agents], ['SKILL.md', skill], ['llms.txt', llms]] as const) {
    if (TOKEN_FIGURE.test(text)) failures.push(`${name} quotes a token figure while the bench is pending`);
  }
} else if (!agents.includes(benchSummary(bench))) {
  failures.push('agents.md does not carry the computed bench summary');
}

const agentTokens = tokens(agents).length;
if (agentTokens >= AGENTS_TOKEN_LIMIT) failures.push(`agents.md is ${String(agentTokens)} tokens, the limit is ${String(AGENTS_TOKEN_LIMIT)}`);

const BANNED: readonly (readonly [RegExp, string])[] = [
  [/—/u, 'an em dash'],
  [/–/u, 'an en dash'],
  [/claude|anthropic|openai|gemini|codex/iu, 'a model vendor name'],
];
const docs: readonly (readonly [string, string])[] = [
  ['agents.md', agents],
  ['SKILL.md', skill],
  ['llms.txt', llms],
  ['SPEC.md', read(SPEC)],
];
for (const [name, text] of docs) {
  for (const [pattern, what] of BANNED) {
    if (pattern.test(text)) failures.push(`${name}: contains ${what}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${String(failures.length)} problem(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `PASS: ${String(examples)} terset examples decode, match their JSON and equal encode(); RULES present; agents.md ${String(agentTokens)} tokens; ${String(docs.length)} files have no dash or vendor name.`,
);
