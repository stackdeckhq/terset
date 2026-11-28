// Fills the content templates with text the generate script produced.
// Placeholders: {{RULES}}, {{USAGE}}, {{RELEASE}}, {{INSTALL}}, {{FORMAT}},
// {{QUALITY}}, {{BENCH}} and {{EXAMPLE:<id>}}.
// An unknown placeholder, or one left behind, is an error.
import { PENDING_NOTE, benchSummary, jsonWinsNote } from '../src/data/bench.ts';
import type { BenchFile } from '../src/data/bench.ts';
import { FORMAT_LINE } from '../src/data/docs.ts';
import type { GeneratedSamples } from '../src/data/generated-schema.ts';
import { QUALITY_FAIRNESS, QUALITY_LIMITS, QUALITY_SUMMARY } from '../src/data/quality.ts';
import { INSTALL_COMMANDS, PACKAGE_LICENSE, PACKAGE_NAME, PACKAGE_VERSION, PYPI_NAME, REPO_URL } from '../src/data/site.ts';
import { IMPORT_LINE, USAGE_LINES } from '../src/lib/format.ts';

/** The release sentence, from the one place in src/data/site.ts. */
const RELEASE_TEXT = `Terset ${PACKAGE_VERSION} is licensed under ${PACKAGE_LICENSE}. Source: ${REPO_URL}`;
const INSTALL_TEXT = `The official packages are \`${PACKAGE_NAME}\` on npm and \`${PYPI_NAME}\` on PyPI. Use \`${INSTALL_COMMANDS.pnpm}\` for JavaScript or \`pip install ${PYPI_NAME}\` for Python. Avoid look-alike package names.`;

const PLACEHOLDER = /\{\{([A-Z]+)(?::([a-z]+))?\}\}/gu;

function example(generated: GeneratedSamples, id: string): string {
  const doc = Object.entries(generated.docExamples).find(([key]) => key === id)?.[1];
  if (doc === undefined) throw new Error(`No generated doc example "${id}"`);
  return `\`\`\`terset\n${doc.terset}\n\`\`\`\n\nThe same data as JSON:\n\n\`\`\`json\n${doc.json}\n\`\`\``;
}

/** The token result in plain sentences, computed from the bench file. */
function benchText(bench: BenchFile): string {
  if (bench.status === 'pending') return `Token counts are pending. Do not quote a saving. ${PENDING_NOTE}`;
  return [benchSummary(bench), jsonWinsNote(bench)].filter((line) => line !== '').join(' ');
}

export function renderContent(template: string, generated: GeneratedSamples, bench: BenchFile): string {
  const out = template.replace(PLACEHOLDER, (match, name: string, arg: string | undefined) => {
    if (name === 'RULES') return generated.rules;
    if (name === 'USAGE') return [IMPORT_LINE, ...USAGE_LINES].join('\n');
    if (name === 'RELEASE') return RELEASE_TEXT;
    if (name === 'INSTALL') return INSTALL_TEXT;
    if (name === 'FORMAT') return FORMAT_LINE;
    if (name === 'QUALITY') return `${QUALITY_SUMMARY} ${QUALITY_FAIRNESS} ${QUALITY_LIMITS}`;
    if (name === 'BENCH') return benchText(bench);
    if (name === 'EXAMPLE' && arg !== undefined) return example(generated, arg);
    throw new Error(`Unknown placeholder ${match}`);
  });
  if (out.includes('{{')) throw new Error('A placeholder was left in the rendered text');
  return out;
}
