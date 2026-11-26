// /docs.md: the /docs page as one plain Markdown file, both languages in full.
// scripts/build-llms.ts writes it from the same source as the page.
import { API, exampleFence } from './docs-api.ts';
import type { ApiEntry } from './docs-api.ts';
import {
  API_INTRO,
  CHEAT_INTRO,
  CHEAT_SHEET,
  DEPTH_NOTE,
  DOC_LANGS,
  DOC_LINKS,
  DOCS_DESCRIPTION,
  DOCS_TITLE,
  ERROR_KINDS,
  ERROR_MESSAGES,
  EXPORTS_LINE,
  INSTALL,
  LANG_FENCE,
  LANG_LABELS,
  LANG_NOTES,
  LIMITS,
  NEVER_BY_HAND,
  QUICK_START,
  QUICK_START_INTRO,
  RULES_INTRO,
  RULES_PARTS,
  VERSION_LINE,
  WHEN_NOT,
  implementationsMarkdown,
  quickStartCommand,
  quickStartSteps,
  sectionTitle,
} from './docs.ts';
import type { DocLang, DocsSectionId } from './docs.ts';
import type { CheatRow } from './generated-schema.ts';
import { SITE_URL } from './site.ts';

const fence = (lang: string, text: string): string => `\`\`\`${lang}\n${text}\n\`\`\``;
const h2 = (id: DocsSectionId): string => `## ${sectionTitle(id)}`;
const bullets = (items: readonly string[]): string => items.map((item) => `- ${item}`).join('\n');

function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

/** A link from the page itself made absolute, so the file reads well anywhere. */
const absolute = (href: string): string => (href.startsWith('/') ? `${SITE_URL}${href}` : href);

function install(): string {
  return [
    h2('install'),
    VERSION_LINE,
    implementationsMarkdown(),
    ...DOC_LANGS.map((lang) => [`### ${LANG_LABELS[lang]}`, ...INSTALL[lang].commands.map((item) => fence('sh', item.command)), INSTALL[lang].note].join('\n\n')),
  ].join('\n\n');
}

function quickStart(lang: DocLang): string {
  const sample = QUICK_START[lang];
  return [
    `### ${LANG_LABELS[lang]}`,
    `Save this as \`${sample.filename}\`.`,
    fence(LANG_FENCE[lang], sample.code),
    fence('sh', quickStartCommand(lang)),
    'Output (the gaps are tabs):',
    fence('text', sample.output),
    quickStartSteps(lang)
      .map((step, index) => `${String(index + 1)}. ${step}`)
      .join('\n'),
    `#### ${LANG_LABELS[lang]} details`,
    bullets(LANG_NOTES[lang]),
  ].join('\n\n');
}

function cheatSheet(rows: readonly CheatRow[]): string {
  const parts = CHEAT_SHEET.map((input) => {
    const row = rows.find((item) => item.id === input.id);
    if (row === undefined) throw new Error(`The cheat sheet row "${input.id}" was not generated`);
    return [`### ${input.title}`, input.about, fence('json', row.json), fence('terset', row.terset)].join('\n\n');
  });
  return [h2('cheat-sheet'), CHEAT_INTRO, ...parts].join('\n\n');
}

function apiForLang(entry: ApiEntry, lang: DocLang): string {
  const params = entry.params[lang];
  const errors = entry.errors[lang];
  const example = entry.example[lang];
  return [
    `#### ${LANG_LABELS[lang]}`,
    fence(lang === 'py' ? 'python' : 'ts', entry.signature[lang]),
    params.length === 0 ? 'Parameters: none.' : `Parameters:\n\n${bullets(params.map((param) => `\`${param.name}\` (\`${param.type}\`): ${param.about}`))}`,
    `Returns: ${entry.returns[lang]}`,
    errors.length === 0 ? 'Errors: none.' : `Errors:\n\n${bullets(errors.map((error) => `\`${error.type}\`: ${error.when}`))}`,
    fence(exampleFence(entry, lang), example.code),
    'Output:',
    fence('text', example.output),
    `In ${LANG_LABELS[lang]}: ${entry.differs[lang]}`,
  ].join('\n\n');
}

function api(): string {
  const entries = API.map((entry) => {
    const title = entry.name.js === entry.name.py ? `\`${entry.name.js}\`` : `\`${entry.name.js}\` and \`${entry.name.py}\``;
    return [`### ${title}`, entry.summary, ...DOC_LANGS.map((lang) => apiForLang(entry, lang))].join('\n\n');
  });
  return [h2('api'), API_INTRO, ...DOC_LANGS.map((lang) => EXPORTS_LINE[lang]), ...entries].join('\n\n');
}

function rules(text: string): string {
  return [h2('rules'), ...RULES_INTRO, table(['When', 'The rules add'], RULES_PARTS.map((part) => [part.when, part.adds])), 'The full `RULES` text:', fence('text', text)].join('\n\n');
}

function errors(): string {
  return [
    h2('errors'),
    table(['Call', 'JavaScript', 'Python'], ERROR_KINDS.map((kind) => [kind.call, kind.js, kind.py])),
    '### Messages',
    table(['Message', 'Cause'], ERROR_MESSAGES.map((item) => [item.message, item.cause])),
    '### Limits',
    table(['Limit', 'Value'], LIMITS.map((item) => [item.limit, item.value])),
    DEPTH_NOTE,
  ].join('\n\n');
}

/** The whole reference. `rules` is the encoder's RULES text, `cheat` the generated cheat sheet rows. */
export function docsMarkdown(rulesText: string, cheat: readonly CheatRow[]): string {
  return [
    `# ${DOCS_TITLE}`,
    `> ${DOCS_DESCRIPTION}`,
    install(),
    [h2('quick-start'), QUICK_START_INTRO, ...DOC_LANGS.map(quickStart), NEVER_BY_HAND].join('\n\n'),
    cheatSheet(cheat),
    api(),
    rules(rulesText),
    errors(),
    [h2('when-not'), bullets(WHEN_NOT.map((item) => `**${item.title}** ${item.text}`))].join('\n\n'),
    [h2('links'), bullets(DOC_LINKS.map((link) => `[${link.label}](${absolute(link.href)}): ${link.about}`))].join('\n\n'),
  ].join('\n\n');
}
