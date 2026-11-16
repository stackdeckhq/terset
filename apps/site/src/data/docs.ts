// The one source for the reference docs. The /docs page, /docs.md and the
// shared blocks in the three READMEs all render from this file and
// docs-api.ts. scripts/update-readmes.ts writes the README blocks, and
// docs.test.ts fails when a README drifts or an example's output changes.
// Inline text may use `code`, **bold** and [links](https://terset.dev).
import type { JsonRoot } from '../lib/format.ts';
import { INSTALL_COMMANDS, NPM_URL, PACKAGE_MANAGERS, PACKAGE_NAME, PACKAGE_VERSION, SITE_URL } from './site.ts';

export const DOC_LANGS = ['js', 'py'] as const;
export type DocLang = (typeof DOC_LANGS)[number];
export type PerLang<T> = Readonly<Record<DocLang, T>>;

/** The switch label for each language. */
export const LANG_LABELS: PerLang<string> = { js: 'JavaScript', py: 'Python' };
/** The fence tag each language's code uses. */
export const LANG_FENCE: PerLang<string> = { js: 'js', py: 'python' };

export const PYPI_NAME = 'terset';
export const PYPI_URL = `https://pypi.org/project/${PYPI_NAME}/`;
export const DOCS_URL = `${SITE_URL}/docs`;

/** A runnable example and the exact text it prints. A test runs every one. */
export interface CodeSample {
  readonly code: string;
  readonly output: string;
}

/** The public names that differ between the two packages. */
export const NAMES: PerLang<{ readonly rulesFor: string; readonly encode: string; readonly decode: string; readonly rules: string }> = {
  js: { rulesFor: 'rulesFor', encode: 'encode', decode: 'decode', rules: 'RULES' },
  py: { rulesFor: 'rules_for', encode: 'encode', decode: 'decode', rules: 'RULES' },
};

// Head of the page and the READMEs

export const DOCS_TITLE = 'Terset docs';
export const DOCS_DESCRIPTION = 'Install Terset for JavaScript or Python, encode your first table, and look up every function, error and limit.';
export const DOCS_LEAD = 'Install, a quick start, a cheat sheet and the full API for JavaScript and Python.';
export const VERSION_LINE = `Version ${PACKAGE_VERSION} for JavaScript and Python. Both packages write the same text.`;

/** The sections of /docs, in order. The page, its contents list and /docs.md share them. */
export const DOCS_SECTIONS = [
  { id: 'install', title: 'Install' },
  { id: 'quick-start', title: 'Quick start' },
  { id: 'cheat-sheet', title: 'Cheat sheet' },
  { id: 'api', title: 'API reference' },
  { id: 'rules', title: 'Rules text' },
  { id: 'errors', title: 'Errors and limits' },
  { id: 'when-not', title: 'When not to use it' },
  { id: 'links', title: 'Links' },
] as const;
export type DocsSectionId = (typeof DOCS_SECTIONS)[number]['id'];

/** The title of one section, for headings. */
export function sectionTitle(id: DocsSectionId): string {
  return DOCS_SECTIONS.find((section) => section.id === id)?.title ?? id;
}

export const QUICK_START_INTRO = 'Encode the data, send the fitted rules with it, and decode to check the round trip.';
export const CHEAT_INTRO = 'Common shapes, as JSON and as the text `encode` writes for them. The Terset side is made by the encoder when the site builds. The gaps are tabs.';
export const API_INTRO = 'Every public name in both packages. Pick a language to see its signatures, errors and examples.';
export const EXPORTS_LINE: PerLang<string> = {
  js: `\`${PACKAGE_NAME}\` exports \`encode\`, \`decode\`, \`rulesFor\`, \`RULES\` and the types \`JsonValue\`, \`JsonObject\` and \`JsonRoot\`.`,
  py: '`terset` exports `encode`, `decode`, `rules_for`, `RULES` and the type aliases `JsonValue`, `JsonObject`, `JsonRoot`, `JsonInputValue` and `JsonInputRoot`.',
};

/** The first line of each package README. */
export const OFFICIAL_LINE: PerLang<string> = {
  js: 'The official JavaScript and TypeScript package for Terset.',
  py: 'The official Python package for Terset.',
};

/** The h2 headings of both package READMEs, in order. A test checks both files. */
export const PACKAGE_README_HEADINGS: readonly string[] = [
  'See it',
  'Install',
  'Use it',
  'How it works',
  'Benchmark',
  'When not to use it',
  'Reference',
  'For agents',
  'Source',
  'License',
];

/** The README badges, each pointing at its own registry. */
export const BADGES: PerLang<readonly { readonly src: string; readonly alt: string }[]> = {
  js: [
    { src: `https://img.shields.io/npm/v/${PACKAGE_NAME}`, alt: 'npm version' },
    { src: `https://img.shields.io/npm/l/${PACKAGE_NAME}`, alt: 'license MIT' },
    { src: 'https://img.shields.io/badge/dependencies-0-brightgreen', alt: 'zero dependencies' },
    { src: `https://img.shields.io/node/v/${PACKAGE_NAME}`, alt: 'node 20 and up' },
  ],
  py: [
    { src: `https://img.shields.io/pypi/v/${PYPI_NAME}`, alt: 'PyPI version' },
    { src: `https://img.shields.io/pypi/l/${PYPI_NAME}`, alt: 'license MIT' },
    { src: 'https://img.shields.io/badge/dependencies-0-brightgreen', alt: 'zero dependencies' },
    { src: `https://img.shields.io/pypi/pyversions/${PYPI_NAME}`, alt: 'Python 3.10 and up' },
  ],
};

// 1. Install

export interface InstallInfo {
  /** Every install command, first one shown by default. */
  readonly commands: readonly { readonly label: string; readonly command: string }[];
  readonly note: string;
}

export const INSTALL: PerLang<InstallInfo> = {
  js: {
    commands: PACKAGE_MANAGERS.map((name) => ({ label: name, command: INSTALL_COMMANDS[name] })),
    note: 'Zero dependencies. Node 20 and up. Types are included.',
  },
  py: {
    commands: [{ label: 'pip', command: `pip install ${PYPI_NAME}` }],
    note: 'Zero dependencies. Python 3.10 and up. Type hints are included.',
  },
};

// 2. Quick start

export const QUICK_START: PerLang<CodeSample> = {
  js: {
    code: `import { rulesFor, decode, encode } from "${PACKAGE_NAME}";

const data = {
  team: "core",
  users: [
    { id: "u1", name: "Ada", role: "admin" },
    { id: "u2", name: "Ben", role: "ops" },
    { id: "u3", name: "Chen" },
  ],
};

const text = encode(data);

// Send the fitted rules once in the system prompt, and the text as the data.
const messages = [
  { role: "system", content: \`You read Terset data. \${rulesFor(text)}\` },
  { role: "user", content: \`Which users have no role?\\n\\n\${text}\` },
];

console.log(text);
console.log(JSON.stringify(decode(text)) === JSON.stringify(data)); // true`,
    output: 'team: core\nusers[3]:\nid\tname\trole\nu1\tAda\tadmin\nu2\tBen\tops\nu3\tChen\t\ntrue',
  },
  py: {
    code: `from terset import decode, encode, rules_for

data = {
    "team": "core",
    "users": [
        {"id": "u1", "name": "Ada", "role": "admin"},
        {"id": "u2", "name": "Ben", "role": "ops"},
        {"id": "u3", "name": "Chen"},
    ],
}

text = encode(data)

# Send the fitted rules once in the system prompt, and the text as the data.
messages = [
    {"role": "system", "content": f"You read Terset data. {rules_for(text)}"},
    {"role": "user", "content": f"Which users have no role?\\n\\n{text}"},
]

print(text)
print(decode(text) == data)  # True`,
    output: 'team: core\nusers[3]:\nid\tname\trole\nu1\tAda\tadmin\nu2\tBen\tops\nu3\tChen\t\nTrue',
  },
};

/** The three steps under the quick start, with each language's names. */
export function quickStartSteps(lang: DocLang): readonly string[] {
  const name = NAMES[lang];
  return [
    `\`${name.encode}(value)\` turns a JSON object or array into Terset text.`,
    `Put \`${name.rulesFor}(text)\` in the system prompt once. The data carries no legend.`,
    `\`${name.decode}(text)\` gives back the same value. Ask the model to answer in JSON, since Terset is for reading.`,
  ];
}

export const NEVER_BY_HAND = 'Never write Terset by hand. Always use `encode`.';

/** The few lines where each language behaves its own way. */
export const LANG_NOTES: PerLang<readonly string[]> = {
  js: [
    '`decode` and `rulesFor` throw `SyntaxError` on any text they reject, and `TypeError` when the input is not a string.',
    'Values must be plain objects, arrays and JSON scalars. Class instances, symbol keys and sparse arrays throw `TypeError`.',
    'Numbers are JavaScript numbers. Numeric `-0`, `NaN` and infinities throw `TypeError`.',
  ],
  py: [
    '`decode` and `rules_for` raise `ValueError` on any text they reject, and `TypeError` when the input is not a string.',
    'Numbers follow JavaScript, so `1.0` writes as `1`. Decoded whole numbers within `[-2**53, 2**53]` become `int`. Others become `float`.',
    'An `int` that a binary64 float cannot hold exactly, such as `9007199254740993`, raises `TypeError` instead of rounding.',
    'Numeric `-0`, `nan`, infinities, cycles and types other than `dict`, `list`, `str`, numbers, `bool` and `None` raise `TypeError`.',
    'Dictionary order is kept, with array-index keys such as `"2"` and `"10"` first, in numeric order, as in JavaScript.',
    '`encode` takes the read-only `JsonInputRoot` type. `decode` returns `JsonRoot`. The package ships `py.typed`.',
  ],
};

// 3. Cheat sheet. The Terset side is encoded at build time by scripts/samples-build.ts.

export interface CheatInput {
  readonly id: string;
  readonly title: string;
  readonly about: string;
  /** The input. generate-samples.ts encodes it into src/generated/samples.json. */
  readonly value: JsonRoot;
}

export const CHEAT_SHEET: readonly CheatInput[] = [
  {
    id: 'uniform',
    title: 'Uniform rows',
    about: 'A root list of records becomes `[N]`, one header and one row per record.',
    value: [
      { id: 'a1', name: 'Ada', age: 36 },
      { id: 'b2', name: 'Ben', age: 41 },
      { id: 'c3', name: 'Chen', age: 29 },
    ],
  },
  {
    id: 'uneven',
    title: 'Uneven rows',
    about: 'A missing field is an empty cell. The header holds every field once.',
    value: {
      users: [
        { id: 'u1', name: 'Ada', role: 'admin' },
        { id: 'u2', name: 'Ben' },
        { id: 'u3', name: 'Chen', role: 'ops', team: 'core' },
      ],
    },
  },
  {
    id: 'nested',
    title: 'Nested objects',
    about: 'When every row has the same nested keys, they become dotted columns.',
    value: {
      orders: [
        { id: 'o1', ship: { city: 'Lisbon', zip: '1100' } },
        { id: 'o2', ship: { city: 'Porto', zip: '4000' } },
        { id: 'o3', ship: { city: 'Braga', zip: '4700' } },
      ],
    },
  },
  {
    id: 'keyed',
    title: 'Keyed map',
    about: 'A map of records can become `name{N}`. The `@key` column holds each key.',
    value: {
      servers: {
        web: { cpu: 2, ram: 4, zone: 'eu' },
        db: { cpu: 8, ram: 32, zone: 'eu' },
        cache: { cpu: 1, ram: 2, zone: 'us' },
      },
    },
  },
  {
    id: 'scalars',
    title: 'Scalars and escaping',
    about: 'Text that looks like a number, boolean or null gets JSON quotes. So do empty text and escapes.',
    value: { name: 'Ada', code: '007', count: '42', empty: '', none: null, flag: true, note: 'line\nbreak' },
  },
];

// 5. Rules

export const RULES_INTRO: readonly string[] = [
  'A model needs the rules once, in the system prompt. The data itself carries no legend.',
  '`rulesFor(text)` returns only the sentences that text needs. In Python it is `rules_for(text)`. It checks the text like `decode` does, so it rejects the same input.',
  '`RULES` is the full text, for one prompt that serves many texts. It is the same string in both packages.',
];

export const RULES_PARTS: readonly { readonly when: string; readonly adds: string }[] = [
  { when: 'Always', adds: 'The five base sentences: tables, empty cells, quotes, nested cells and the `id` header.' },
  { when: 'A keyed table `name{N}` is present', adds: 'The `@key` sentence.' },
  { when: 'A dotted header `a.b` is present', adds: 'The dotted header sentence.' },
];

// 6. Errors and limits

export const LIMITS: readonly { readonly limit: string; readonly value: string }[] = [
  { limit: 'Root', value: 'An object or an array. A bare scalar is an error.' },
  { limit: 'JSON depth', value: '500 levels at most.' },
  { limit: 'Dotted header path', value: '8 segments at most. Anything deeper stays JSON inside the cell.' },
  { limit: 'Table size', value: 'Two or more records. One record stays JSON.' },
  { limit: 'Numbers', value: 'Finite, and not negative zero.' },
  { limit: 'Python integers', value: 'Exactly representable as a binary64 float.' },
];

export const ERROR_KINDS: readonly { readonly call: string; readonly js: string; readonly py: string }[] = [
  { call: 'encode with data that is not JSON', js: '`TypeError`', py: '`TypeError`' },
  { call: 'decode or the rules call with rejected text', js: '`SyntaxError`', py: '`ValueError`' },
  { call: 'decode or the rules call with a value that is not a string', js: '`TypeError`', py: '`TypeError`' },
];

export const ERROR_MESSAGES: readonly { readonly message: string; readonly cause: string }[] = [
  { message: 'Row count mismatch.', cause: 'A table has more or fewer rows than its count.' },
  { message: 'Wrong cell count.', cause: 'A row has more or fewer cells than its header.' },
  { message: 'Noncanonical Terset text.', cause: 'The text decodes, but `encode` would write it another way.' },
  { message: 'Maximum JSON depth is 500.', cause: 'The data nests deeper than 500 levels.' },
  { message: 'Numbers must be finite and must not be negative zero.', cause: 'A number is `NaN`, infinite or `-0`.' },
  { message: 'Cyclic JSON data.', cause: 'An object or list contains itself.' },
  { message: 'Expected Terset text.', cause: 'The input to decode is not a string.' },
];

export const DEPTH_NOTE = 'In Python, very deep data and an already deep call stack can raise `RecursionError` before the 500 level check. This depends on the stack, not the Python version.';

// 7. When not to use it. Shared word for word with both package READMEs.

export const WHEN_NOT: readonly { readonly title: string; readonly text: string }[] = [
  { title: 'No lists of records.', text: 'Config files and deeply nested data stay JSON, so the rules line only adds tokens.' },
  { title: 'One-row lists.', text: 'A list needs two or more objects to become a table.' },
  { title: 'Mixed arrays.', text: 'A list with any item that is not an object stays JSON.' },
  { title: 'Nested lists.', text: 'Lists of objects inside a record stay JSON inside their cell. Only the top level becomes tables.' },
  { title: 'Hard limits.', text: 'The root must be an object or an array. Numeric `-0` and nesting deeper than 500 levels are explicit errors.' },
  { title: 'Writing back.', text: 'Terset is for the model to read. Ask for answers in JSON.' },
];

// 8. Links

export const DOC_LINKS: readonly { readonly label: string; readonly href: string; readonly about: string }[] = [
  { label: 'Format spec', href: '/format', about: 'Every rule of the format, with examples.' },
  { label: 'Benchmark', href: '/benchmark', about: 'Token counts, answer accuracy, the method and the limits.' },
  { label: 'Agents', href: '/agents', about: 'Plain files an agent can read, and a prompt to paste.' },
  { label: 'npm', href: NPM_URL, about: `The ${PACKAGE_NAME} package.` },
  { label: 'PyPI', href: PYPI_URL, about: `The ${PYPI_NAME} package.` },
];

/** The short Reference section both package READMEs carry. */
export const README_REFERENCE = `Every function, parameter, error and limit, for JavaScript and Python: [terset.dev/docs](${DOCS_URL}).`;
