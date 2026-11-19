// The format versions the packages read and write, the conformance suite for each, and
// the worked example /format opens with. The default version, the read-back and the
// rejected spelling come from the real encoder and decoder when this module loads, and it
// throws when one stops holding. versions.test.ts checks the rest against both packages'
// source, the suite manifests, SPEC.md and a run of the Python package.
import { decode, encode } from '../lib/format.ts';
import type { FormatVersion, JsonObject } from '../lib/format.ts';
import { parseMarkdown, withoutTitle } from '../lib/markdown.ts';
import type { Doc } from '../lib/markdown.ts';
import { PACKAGE_VERSION, REPO_URL } from './site.ts';
import { WORKED_EXAMPLE } from './worked-example.ts';

/** Every format version the packages read, oldest first. */
export const FORMAT_VERSIONS = ['1.0', '1.1'] as const satisfies readonly FormatVersion[];

/** The version whose texts can no longer change. SPEC.md "Stability" freezes it. */
export const FROZEN_FORMAT: FormatVersion = '1.0';

/** "1.0 and 1.1". */
export const VERSIONS_TEXT = FORMAT_VERSIONS.join(' and ');

/** The version `encode` writes with no option. Throws unless exactly one version gives that text for `input`. */
function defaultFormat(input: JsonObject): FormatVersion {
  const text = encode(input);
  const matches = FORMAT_VERSIONS.filter((version) => encode(input, { format: version }) === text);
  const [only] = matches;
  if (matches.length !== 1 || only === undefined) throw new Error(`Expected one format version to give the default text, found ${String(matches.length)}`);
  return only;
}

/** Throws unless the text of every version decodes back to `input`, key order included. */
function checkReadBack(input: JsonObject): void {
  const json = JSON.stringify(input);
  for (const version of FORMAT_VERSIONS) {
    if (JSON.stringify(decode(encode(input, { format: version }))) !== json) throw new Error(`Format ${version} text no longer decodes back to its input`);
  }
}

export interface ConformanceSuite {
  readonly version: FormatVersion;
  /** The folder from the repository root, with a trailing slash. */
  readonly path: string;
  readonly url: string;
}

function suite(version: FormatVersion, path: string): ConformanceSuite {
  return { version, path, url: `${REPO_URL}/tree/main/${path.replace(/\/$/u, '')}` };
}

/** One shared suite per format version, in FORMAT_VERSIONS order. */
export const CONFORMANCE_SUITES: readonly ConformanceSuite[] = [suite('1.0', 'conformance/'), suite('1.1', 'conformance/1.1/')];

/** A second spelling of the same value, and the error `decode` throws for it. */
export interface Rejection {
  /** The line as `encode` writes it. */
  readonly line: string;
  /** The same line with its text in quotes it does not need. */
  readonly spelled: string;
  /** The whole text with that one line changed. */
  readonly text: string;
  readonly message: string;
}

/** Quotes the text value of root field `key`. Throws when encode does not write that field as plain text, or when decode accepts the result. */
function quotedSpelling(input: JsonObject, terset: string, key: string): Rejection {
  const value = input[key];
  if (typeof value !== 'string') throw new Error(`The rejected spelling needs a text field ${key}`);
  const line = `${key}: ${value}`;
  if (!terset.split('\n').includes(line)) throw new Error(`encode no longer writes "${line}" as its own line`);
  const spelled = `${key}: ${JSON.stringify(value)}`;
  const text = terset.replace(line, spelled);
  try {
    decode(text);
  } catch (error) {
    if (error instanceof SyntaxError) return { line, spelled, text, message: error.message };
    throw error;
  }
  throw new Error(`decode accepts "${spelled}", so it is not a rejected spelling`);
}

export interface FormatExample {
  readonly input: JsonObject;
  /** The input as compact JSON. */
  readonly json: string;
  readonly terset: string;
  readonly rejection: Rejection;
}

function buildFormatExample(input: JsonObject): FormatExample {
  checkReadBack(input);
  const terset = encode(input);
  return { input, json: JSON.stringify(input), terset, rejection: quotedSpelling(input, terset, 'team') };
}

/** The same input as the worked example on /benchmark and in the READMEs. */
export const FORMAT_EXAMPLE: FormatExample = buildFormatExample(WORKED_EXAMPLE.input);

export const DEFAULT_FORMAT: FormatVersion = defaultFormat(FORMAT_EXAMPLE.input);

/** What each version is. Throws for a version that is neither the default nor frozen, since this table has nothing true to say about it. */
function versionStatus(version: FormatVersion): string {
  if (version === DEFAULT_FORMAT) return 'The default. `encode` writes it.';
  if (version === FROZEN_FORMAT) return 'Frozen. `decode` still reads it, and `encode` writes it on request.';
  throw new Error(`Format ${version} is neither the default nor frozen`);
}

function suiteFor(version: FormatVersion): ConformanceSuite {
  const found = CONFORMANCE_SUITES.find((item) => item.version === version);
  if (found === undefined) throw new Error(`Format ${version} has no conformance suite`);
  return found;
}

const fence = (lang: string, text: string): string => `\`\`\`${lang}\n${text}\n\`\`\``;

function versionsMarkdown(): string {
  const rows = [...FORMAT_VERSIONS].reverse().map((version) => {
    const { path, url } = suiteFor(version);
    return `| ${version} | ${versionStatus(version)} | [${path}](${url}) |`;
  });
  return [
    '## Versions',
    ['| Format | Status | Conformance suite |', '| --- | --- | --- |', ...rows].join('\n'),
    `Packages ${PACKAGE_VERSION}, for JavaScript and Python. Both read ${VERSIONS_TEXT} text. Format versions are separate from package versions.`,
  ].join('\n\n');
}

function exampleMarkdown(example: FormatExample): string {
  const { rejection } = example;
  return [
    '## Worked example',
    'JSON in:',
    fence('json', example.json),
    'Terset out (the gaps are tabs):',
    fence('terset', example.terset),
    `Quotes spell the same value a second way: \`${rejection.spelled}\` in place of \`${rejection.line}\`. That is not the text \`encode\` writes, so \`decode\` rejects it:`,
    fence('text', `SyntaxError: ${rejection.message}`),
    'Python raises `ValueError` with the same message. Each value has one text, and a decoder accepts only that one.',
  ].join('\n\n');
}

/** The Versions and Worked example sections, as Markdown. */
export const FORMAT_INTRO = [versionsMarkdown(), exampleMarkdown(FORMAT_EXAMPLE)].join('\n\n');

/** The /format page body: the spec's opening, then FORMAT_INTRO, then the spec's sections. /spec.md keeps the spec alone. */
export function formatDoc(spec: string): Doc {
  const body = withoutTitle(spec);
  const first = body.indexOf('\n## ');
  if (first < 0) throw new Error('The spec has no section heading to put the versions before');
  return parseMarkdown(`${body.slice(0, first)}\n\n${FORMAT_INTRO}\n${body.slice(first)}`);
}
