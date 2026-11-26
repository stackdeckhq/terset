// The API reference: every public export of both packages, in one list.
// The /docs page and /docs.md render it. docs.test.ts runs every example
// and checks the export lists against both packages.
import { PACKAGE_NAME } from './site.ts';
import type { CodeSample, DocLang, PerLang } from './docs.ts';

export interface ApiParam {
  readonly name: string;
  readonly type: string;
  readonly about: string;
}

export interface ApiError {
  readonly type: string;
  readonly when: string;
}

export interface ApiEntry {
  /** The anchor id. */
  readonly id: string;
  /** The heading, with each language's name. */
  readonly name: PerLang<string>;
  readonly summary: string;
  readonly signature: PerLang<string>;
  readonly params: PerLang<readonly ApiParam[]>;
  readonly returns: PerLang<string>;
  readonly errors: PerLang<readonly ApiError[]>;
  /** The fence tag of the JavaScript example: js, or ts when it uses types. */
  readonly jsFence: 'js' | 'ts';
  readonly example: PerLang<CodeSample>;
  /** One line on how this language differs, shown under the switch. */
  readonly differs: PerLang<string>;
}

const IMPORT = (names: string): string => `import { ${names} } from "${PACKAGE_NAME}";`;
const TABLE_TEXT = '"[2]\\nid\\tname\\na1\\tAda\\nb2\\tBen"';

const TEXT_ERRORS: PerLang<readonly ApiError[]> = {
  js: [
    { type: 'SyntaxError', when: 'The text is not canonical Terset, for example a wrong row or cell count.' },
    { type: 'TypeError', when: 'The input is not a string.' },
  ],
  py: [
    { type: 'ValueError', when: 'The text is not canonical Terset, for example a wrong row or cell count.' },
    { type: 'TypeError', when: 'The input is not a string.' },
  ],
};

const TEXT_PARAM = (type: string): readonly ApiParam[] => [{ name: 'text', type, about: 'Terset text, as `encode` wrote it.' }];

export const API: readonly ApiEntry[] = [
  {
    id: 'encode',
    name: { js: 'encode', py: 'encode' },
    summary: 'Turns a JSON object or array into Terset text. The byte check compares the header and rows with compact JSON. It excludes the count line, so a tiny table can be larger than compact JSON. The encoder chooses a table only when the header and rows are shorter.',
    signature: { js: 'encode(value: JsonRoot, options?: EncodeOptions): string', py: 'encode(value: JsonInputRoot, *, format: FormatVersion = "1.1") -> str' },
    params: {
      js: [
        { name: 'value', type: 'JsonRoot', about: 'A plain JSON object or array.' },
        { name: 'options.format', type: '"1.0" | "1.1"', about: 'The format version to write. The default is `"1.1"`. `"1.0"` writes empty cells instead of `name=value` cells.' },
      ],
      py: [
        { name: 'value', type: 'JsonInputRoot', about: 'A `dict` or `list` of JSON values.' },
        { name: 'format', type: 'FormatVersion', about: 'Keyword only. The format version to write. The default is `"1.1"`. `"1.0"` writes empty cells instead of `name=value` cells.' },
      ],
    },
    returns: { js: '`string`: Terset text. A root array that cannot be a table is written as JSON.', py: '`str`: Terset text. A root list that cannot be a table is written as JSON.' },
    errors: {
      js: [
        { type: 'TypeError', when: 'The root is not an object or array, or a value is not JSON: a class instance, a symbol key, a sparse array or a cycle.' },
        { type: 'TypeError', when: 'A number is `NaN`, infinite or `-0`, or the data nests deeper than 500 levels.' },
        { type: 'TypeError', when: '`options` is not an object, or `options.format` is not `"1.0"` or `"1.1"`.' },
      ],
      py: [
        { type: 'TypeError', when: 'The root is not a `dict` or `list`, or a value is not JSON: another type, a key that is not a string, or a cycle.' },
        { type: 'TypeError', when: 'A number is `nan`, infinite or `-0`, an `int` is not exact as a float, or the data nests deeper than 500 levels.' },
        { type: 'TypeError', when: '`format` is not `"1.0"` or `"1.1"`, or is passed by position.' },
      ],
    },
    jsFence: 'js',
    example: {
      js: {
        code: `${IMPORT('encode')}

console.log(encode([
  { id: "a1", name: "Ada" },
  { id: "b2", name: "Ben" },
]));`,
        output: '[2]\nid\tname\na1\tAda\nb2\tBen',
      },
      py: {
        code: `from terset import encode

print(encode([
    {"id": "a1", "name": "Ada"},
    {"id": "b2", "name": "Ben"},
]))`,
        output: '[2]\nid\tname\na1\tAda\nb2\tBen',
      },
    },
    differs: {
      js: 'Only plain objects and arrays are accepted.',
      py: 'Integers that a float cannot hold exactly raise `TypeError` instead of rounding.',
    },
  },
  {
    id: 'decode',
    name: { js: 'decode', py: 'decode' },
    summary: 'Turns Terset text back into the same value, key order included. It accepts only text that `encode` would write.',
    signature: { js: 'decode(text: string): JsonRoot', py: 'decode(text: str) -> JsonRoot' },
    params: { js: TEXT_PARAM('string'), py: TEXT_PARAM('str') },
    returns: { js: '`JsonRoot`: the object or array.', py: '`JsonRoot`: the `dict` or `list`.' },
    errors: TEXT_ERRORS,
    jsFence: 'js',
    example: {
      js: {
        code: `${IMPORT('decode')}

const value = decode(${TABLE_TEXT});
console.log(JSON.stringify(value));`,
        output: '[{"id":"a1","name":"Ada"},{"id":"b2","name":"Ben"}]',
      },
      py: {
        code: `from terset import decode

value = decode(${TABLE_TEXT})
print(value)`,
        output: "[{'id': 'a1', 'name': 'Ada'}, {'id': 'b2', 'name': 'Ben'}]",
      },
    },
    differs: {
      js: 'Rejected text throws `SyntaxError`.',
      py: 'Rejected text raises `ValueError`. Whole numbers within `[-2**53, 2**53]` come back as `int`.',
    },
  },
  {
    id: 'rules-for',
    name: { js: 'rulesFor', py: 'rules_for' },
    summary: 'Returns the rules sentences one text needs, to send right before that text. It checks the text like `decode` does.',
    signature: { js: 'rulesFor(text: string): string', py: 'rules_for(text: str) -> str' },
    params: { js: TEXT_PARAM('string'), py: TEXT_PARAM('str') },
    returns: { js: '`string`: only the sentences the text uses, or an empty string when none apply.', py: '`str`: only the sentences the text uses, or an empty string when none apply.' },
    errors: TEXT_ERRORS,
    jsFence: 'js',
    example: {
      js: {
        code: `${IMPORT('encode, rulesFor')}

const text = encode({
  servers: {
    web: { cpu: 2, zone: "eu" },
    db: { cpu: 8, zone: "eu" },
    cache: { cpu: 1, zone: "us" },
  },
});
console.log(rulesFor(text));`,
        output: "Tables use tab-separated headers and rows. name{N} has N entries; the @key column holds each entry's key and is not a field.",
      },
      py: {
        code: `from terset import encode, rules_for

text = encode({
    "servers": {
        "web": {"cpu": 2, "zone": "eu"},
        "db": {"cpu": 8, "zone": "eu"},
        "cache": {"cpu": 1, "zone": "us"},
    },
})
print(rules_for(text))`,
        output: "Tables use tab-separated headers and rows. name{N} has N entries; the @key column holds each entry's key and is not a field.",
      },
    },
    differs: {
      js: 'The name is `rulesFor`, in camel case.',
      py: 'The name is `rules_for`, in snake case.',
    },
  },
  {
    id: 'rules-constant',
    name: { js: 'RULES', py: 'RULES' },
    summary: 'The full rules text, for a shared or cached system prompt that serves many texts. It is a constant, not a function.',
    signature: { js: 'const RULES: string', py: 'RULES: str' },
    params: { js: [], py: [] },
    returns: { js: '`string`: every rules sentence, the same in both packages.', py: '`str`: every rules sentence, the same in both packages.' },
    errors: { js: [], py: [] },
    jsFence: 'js',
    example: {
      js: {
        code: `${IMPORT('RULES, rulesFor')}

const fitted = rulesFor(${TABLE_TEXT});
console.log(fitted.length < RULES.length); // true, one text needs fewer rules
console.log(rulesFor("name: Ada") === ""); // true, no table means no rules`,
        output: 'true\ntrue',
      },
      py: {
        code: `from terset import RULES, rules_for

fitted = rules_for(${TABLE_TEXT})
print(len(fitted) < len(RULES))  # True, one text needs fewer rules
print(rules_for("name: Ada") == "")  # True, no table means no rules`,
        output: 'True\nTrue',
      },
    },
    differs: {
      js: 'The same string as in Python.',
      py: 'The same string as in JavaScript.',
    },
  },
  {
    id: 'types',
    name: { js: 'Types', py: 'Types' },
    summary: 'Type names for JSON data, for code that builds or reads values.',
    signature: {
      js: `type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type JsonRoot = JsonObject | JsonValue[];
type FormatVersion = "1.0" | "1.1";
type EncodeOptions = { format?: FormatVersion };`,
      py: `JsonValue = None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]
JsonObject = dict[str, JsonValue]
JsonRoot = JsonObject | list[JsonValue]
JsonInputValue = None | bool | int | float | str | Sequence[JsonInputValue] | Mapping[str, JsonInputValue]
JsonInputRoot = Mapping[str, JsonInputValue] | Sequence[JsonInputValue]
FormatVersion = Literal["1.0", "1.1"]`,
    },
    params: { js: [], py: [] },
    returns: { js: 'Types only. Nothing exists at run time.', py: 'Type aliases, importable at run time.' },
    errors: { js: [], py: [] },
    jsFence: 'ts',
    example: {
      js: {
        code: `${IMPORT('encode')}
import type { JsonRoot } from "${PACKAGE_NAME}";

const data: JsonRoot = { team: "core", size: 3 };
console.log(encode(data));`,
        output: 'team: core\nsize: 3',
      },
      py: {
        code: `from terset import JsonRoot, encode

data: JsonRoot = {"team": "core", "size": 3}
print(encode(data))`,
        output: 'team: core\nsize: 3',
      },
    },
    differs: {
      js: 'Five types, imported with `import type`.',
      py: 'Two more aliases, `JsonInputValue` and `JsonInputRoot`, accept read-only `Mapping` and `Sequence` input.',
    },
  },
];

/** Every name each package exports, in the order the reference lists them. */
export const PUBLIC_EXPORTS: PerLang<readonly string[]> = {
  js: ['encode', 'decode', 'rulesFor', 'RULES', 'JsonValue', 'JsonObject', 'JsonRoot', 'FormatVersion', 'EncodeOptions'],
  py: ['encode', 'decode', 'rules_for', 'RULES', 'JsonValue', 'JsonObject', 'JsonRoot', 'JsonInputValue', 'JsonInputRoot', 'FormatVersion'],
};

/** The fence tag for one entry's example in one language. */
export function exampleFence(entry: ApiEntry, lang: DocLang): string {
  return lang === 'py' ? 'python' : entry.jsFence;
}
