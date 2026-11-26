// One worked example: a small input, the text encode writes for it, the rules line
// rulesFor fits to that text, and the prompt the accuracy bench builds around them.
// /benchmark, benchmark.md and the README "See it" section all show it.
// Every string here comes from the encoder. worked-example.test.ts checks the prompt
// against the bench's own makePrompt, which the site cannot import: it pulls in the
// TOON encoder and a tokenizer.
import { encode, rulesFor } from '../lib/format.ts';
import type { JsonObject } from '../lib/format.ts';

/** The prompt one accuracy question sends: a system prompt and one user message. */
export interface WorkedPrompt {
  readonly system: string;
  readonly user: string;
}

export interface WorkedExample {
  readonly input: JsonObject;
  /** The input as compact JSON. */
  readonly json: string;
  readonly terset: string;
  /** The fitted rules line for `terset`. */
  readonly rules: string;
  /** A made-up question, so the prompt is complete. */
  readonly question: string;
  readonly prompt: WorkedPrompt;
  /** The user message split around the data, so a page can color the data alone. */
  readonly userParts: { readonly before: string; readonly after: string };
}

/** Four made-up users. Dara has no role, so her row has no role cell. */
const INPUT = {
  team: 'core',
  users: [
    { id: 'u1', name: 'Ada', role: 'admin', active: true, logins: 41 },
    { id: 'u2', name: 'Ben', role: 'ops', active: true, logins: 7 },
    { id: 'u3', name: 'Chen', role: 'ops', active: false, logins: 0 },
    { id: 'u4', name: 'Dara', active: true, logins: 12, note: 'on leave' },
  ],
} satisfies JsonObject;

const QUESTION = 'How many users are active?';

/** The format label the bench writes in the user message. */
const FORMAT_LABEL = 'terset';

/** The same layout as makePrompt in bench/src/formats.ts. */
function promptParts(rules: string, question: string): { readonly system: string; readonly before: string; readonly after: string } {
  return {
    system: `Read the supplied data.\n\n${rules}`,
    before: `Given the following data in ${FORMAT_LABEL} format:\n\n\`\`\`\n`,
    after: `\n\`\`\`\n\nQuestion: ${question}\n\nAnswer format requirements:\n- Provide only the value itself, no explanation\n- For numbers: output digits only (no commas, currency symbols, or units)\n- For dates/field names: use the exact string from the data\n- For lists: output comma-separated values with no spaces\n\nAnswer:`,
  };
}

function buildWorkedExample(input: JsonObject, question: string): WorkedExample {
  const terset = encode(input);
  const rules = rulesFor(terset);
  const parts = promptParts(rules, question);
  return {
    input,
    json: JSON.stringify(input),
    terset,
    rules,
    question,
    prompt: { system: parts.system, user: `${parts.before}${terset}${parts.after}` },
    userParts: { before: parts.before, after: parts.after },
  };
}

export const WORKED_EXAMPLE: WorkedExample = buildWorkedExample(INPUT, QUESTION);

/** Repeats the same four record shapes, with a unique id on each row. */
export function workedExampleAtSize(count: number): WorkedExample {
  const users = Array.from({ length: count }, (_, index) => ({
    ...INPUT.users[index % INPUT.users.length],
    id: `u${String(index + 1)}`,
  }));
  return buildWorkedExample({ ...INPUT, users }, QUESTION);
}

/** Section title on /benchmark and in benchmark.md. */
export const WORKED_TITLE = 'What gets sent';

export const WORKED_INTRO = 'One small input, and the prompt the accuracy test builds from it.';

/**
 * Where each part goes in the accuracy test, and how the token counts send it.
 * The Claude sentence shows only when the Claude counts are published.
 */
export function workedPlacement(withClaude: boolean): readonly string[] {
  const counts = 'The token counts add the rules line to each Terset count.';
  return [
    'The rules line goes once per prompt. In the accuracy test, the system prompt carries it.',
    'The user message carries the data in a code fence, then the question.',
    withClaude ? `${counts} The Claude counts send the rules line, a newline and the data as one message.` : counts,
  ];
}

/** Where the parts go, for the README. It gives the standing advice, so it names no test. */
export const WORKED_README_PLACEMENT = 'Send the rules line once per prompt, right before the data. The data goes in the user message, before the question.';

export const WORKED_PROMPT_TITLE = 'The full prompt';

export const WORKED_PROMPT_ABOUT = 'The system prompt and the user message, in the layout the accuracy test uses, with a made-up question.';

/** A code fence one backtick longer than any run of backticks in the text, so a fence inside stays text. */
function fence(lang: string, text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/gu)].map((match) => match[0].length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${lang}\n${text}\n${ticks}`;
}

/** The section for benchmark.md, as Markdown blocks in reading order. */
export function workedExampleMarkdown(withClaude: boolean, example: WorkedExample = WORKED_EXAMPLE): readonly string[] {
  return [
    `## ${WORKED_TITLE}`,
    WORKED_INTRO,
    'JSON in:',
    fence('json', example.json),
    'Terset out (the gaps are tabs):',
    fence('text', example.terset),
    'The rules line for this text:',
    fence('text', example.rules),
    workedPlacement(withClaude).join(' '),
    `### ${WORKED_PROMPT_TITLE}`,
    WORKED_PROMPT_ABOUT,
    'System prompt:',
    fence('text', example.prompt.system),
    'User message:',
    fence('text', example.prompt.user),
  ];
}
