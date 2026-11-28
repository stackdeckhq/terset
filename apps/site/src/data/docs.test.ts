// The docs source and the READMEs cannot drift apart. Every README block
// equals what docs-readme.ts renders, both package READMEs keep the same
// sections, and every example prints the output the docs show.
// Fix a failure with `pnpm docs:readme`, or by editing src/data/docs.ts.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInThisContext } from 'node:vm';
import { encode as tokenize } from 'gpt-tokenizer/encoding/o200k_base';
import { describe, expect, it } from 'vitest';
import { RULES, RULES_PLACEMENT, decode, encode, rulesFor } from '../lib/format.ts';
import type { JsonObject } from '../lib/format.ts';
import { API, PUBLIC_EXPORTS, exampleFence } from './docs-api.ts';
import { CHEAT_SHEET, DOCS_SECTIONS, ERROR_MESSAGES, INSTALL, OFFICIAL_LINE, PACKAGE_README_HEADINGS, RULES_INTRO, WHEN_NOT, quickStartSteps } from './docs.ts';
import { COUNTERS, counterLosses } from './numbers.ts';
import { SAMPLES } from './samples.ts';
import type { CodeSample } from './docs.ts';
import { README_FILES, README_IDS, expectedBlocks, h2Headings, readBlocks, sections } from './docs-readme.ts';
import { PACKAGE_VERSION } from './site.ts';

const ROOT = new URL('../../../../', import.meta.url);

function read(path: string): string {
  return readFileSync(new URL(path, ROOT), 'utf8');
}

/** The sections only the language notes may change. Every other section is the same text in both package READMEs. */
const PER_LANGUAGE = new Set(['Install', 'Use it']);

/** Built from parts so this file does not contain the phrase it bans. */
const STALE_PYPI = ['Coming', 'soon', 'on', 'PyPI'].join(' ');

/** The old advice to put the fitted rules in the system prompt. Built from parts for the same reason. */
const STALE_PLACEMENT = ['in', 'the', 'system', 'prompt', 'once'].join(' ');

describe('README blocks', () => {
  it('links to the converter at the top and under See it in every README', () => {
    for (const id of README_IDS) {
      const text = read(README_FILES[id]);
      const [top] = text.split('<!-- docs:pitch -->', 1);
      const seeIt = sections(text).get('See it');
      expect(top, README_FILES[id]).toContain('<a href="https://terset.dev/#b2">Try it with your JSON</a>');
      expect(seeIt, README_FILES[id]).toContain('[Try it with your JSON](https://terset.dev/#b2)');
    }
  });

  it.each(README_IDS)('shows the measured counts for both user examples in the %s README', (id) => {
    const section = readBlocks(read(README_FILES[id])).get('see-it') ?? '';
    const json = /```json\n([^\n]+)\n```/u.exec(section)?.[1];
    if (json === undefined) throw new Error(`${README_FILES[id]} is missing the example JSON`);
    const input = JSON.parse(json) as JsonObject & { users: JsonObject[] };
    expect(input.users).toHaveLength(4);
    const users = [...input.users, ...input.users, ...input.users.slice(0, 2)]
      .map((user, index) => ({ ...user, id: `u${String(index + 1)}` }));
    const measure = (value: JsonObject, compact: string) => {
      const data = encode(value);
      const prompt = [rulesFor(data), data].filter(Boolean).join('\n');
      const dataTokens = tokenize(data).length;
      const promptTokens = tokenize(prompt).length;
      const jsonTokens = tokenize(compact).length;
      return {
        dataTokens, promptTokens, jsonTokens,
        rows: [
          `| Terset data alone | ${String(Buffer.byteLength(data))} | ${String(dataTokens)} |`,
          `| Terset data plus rules | ${String(Buffer.byteLength(prompt))} | ${String(promptTokens)} |`,
          `| Compact JSON | ${String(Buffer.byteLength(compact))} | ${String(jsonTokens)} |`,
        ],
      };
    };
    const enlarged = { ...input, users };
    const four = measure(input, json);
    const ten = measure(enlarged, JSON.stringify(enlarged));
    const tables = section.split('\n\n').filter((paragraph) => paragraph.startsWith('| Format | Bytes | Tokens |'));
    expect(tables.map((table) => table.split('\n').slice(2))).toEqual([four.rows, ten.rows]);
    expect(four.dataTokens).toBeLessThan(four.jsonTokens);
    // Strictly greater: at break-even the sentence below would be false.
    expect(four.promptTokens).toBeGreaterThan(four.jsonTokens);
    expect(section).toContain('Four records do not save enough tokens to pay for the rules line.');
    const saving = ten.jsonTokens - ten.promptTokens;
    expect(saving).toBeGreaterThan(0);
    expect(section).toContain(`Repeat the same record shapes to make 10 users, each with a unique ID. With the rules included, Terset uses ${String(saving)} fewer tokens.`);
  });
  for (const id of README_IDS) {
    it(`keeps every docs block in ${README_FILES[id]} equal to the source`, () => {
      const text = read(README_FILES[id]);
      const found = readBlocks(text);
      const expected = expectedBlocks(id, text);
      expect([...found.keys()].sort(), README_FILES[id]).toEqual(Object.keys(expected).sort());
      for (const [name, body] of Object.entries(expected)) {
        expect(found.get(name), `${README_FILES[id]} block "${name}" (run pnpm docs:readme)`).toBe(body);
      }
    });
  }

  it('puts the losses line of each counter in the benchmark summary of every README', () => {
    if (COUNTERS === null || COUNTERS.claude === null) throw new Error('the committed counters should be ready');
    for (const id of README_IDS) {
      const summary = expectedBlocks(id, read(README_FILES[id]))['bench-summary'] ?? '';
      expect(summary, README_FILES[id]).toContain(`- ${counterLosses(COUNTERS.o200k)}\n- ${counterLosses(COUNTERS.claude)}`);
    }
  });

  it('gives both package READMEs the same headings, in the agreed order', () => {
    expect(h2Headings(read(README_FILES.js))).toEqual(PACKAGE_README_HEADINGS);
    expect(h2Headings(read(README_FILES.py))).toEqual(PACKAGE_README_HEADINGS);
  });

  it('keeps every shared section the same text in both package READMEs', () => {
    const js = sections(read(README_FILES.js));
    const py = sections(read(README_FILES.py));
    for (const heading of PACKAGE_README_HEADINGS) {
      if (PER_LANGUAGE.has(heading)) continue;
      expect(py.get(heading), heading).toBe(js.get(heading));
    }
  });

  it('starts each package README with its official line under the title', () => {
    for (const id of ['js', 'py'] as const) {
      const lines = read(README_FILES[id]).split('\n');
      const title = lines.findIndex((line) => line.includes('<h1'));
      const first = lines.slice(title + 1).find((line) => line.trim() !== '');
      expect(first, README_FILES[id]).toContain('The official');
      expect(first, README_FILES[id]).toContain(OFFICIAL_LINE[id]);
    }
  });

  it('never says the Python package is coming soon, anywhere in the repository', () => {
    const files = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0').filter(Boolean);
    expect(files.length).toBeGreaterThan(10);
    const text = /\.(md|ts|tsx|txt|toml|json|py|html|css)$/u;
    const hits = files.filter((path) => text.test(path) && read(path).includes(STALE_PYPI));
    expect(hits).toEqual([]);
  });

  it('sends the fitted rules right before the data and keeps RULES for a shared system prompt', () => {
    for (const lang of ['js', 'py'] as const) {
      const [, placement] = quickStartSteps(lang);
      expect(placement).toContain('right before the data');
      expect(placement).toContain('`RULES` instead');
    }
    expect(RULES_PLACEMENT).toContain('right before the data');
    expect(RULES_INTRO.join(' ')).toContain('shared or cached system prompt');
    const files = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md', 'apps/site/src'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0').filter((path) => path !== '' && !path.startsWith('output/'));
    expect(files.length).toBeGreaterThan(10);
    const hits = files.filter((path) => /\.(md|ts|tsx)$/u.test(path) && read(path).includes(STALE_PLACEMENT));
    expect(hits).toEqual([]);
  });
});

describe('when not to use it', () => {
  it('explains why a shorter config in bytes can still use more tokens with the path rule', () => {
    const [noLists] = WHEN_NOT;
    expect(noLists?.text).toBe('Path entries can save bytes and still cost more tokens. Compact JSON uses fewer tokens on the config example once Terset includes its rules line.');
    const config = encode(SAMPLES.config);
    expect(rulesFor(config)).toBe('Key a/b is field b in object a.');
    expect(Buffer.byteLength(config)).toBeLessThan(Buffer.byteLength(JSON.stringify(SAMPLES.config)));
    if (COUNTERS === null || COUNTERS.claude === null) throw new Error('the bench or the Claude counts are pending');
    expect(COUNTERS.o200k.samples.config).toMatchObject({ json: 99, terset: 108 });
    expect(COUNTERS.o200k.cases.find((row) => row.name === 'Deep nested config')).toMatchObject({ json: 251, terset: 319 });
    expect(rulesFor(encode(SAMPLES.config, { format: '1.1' }))).toBe('');
  });
});

describe('package facts', () => {
  it('explains why the count line can make a tiny table larger than JSON', () => {
    const value = [{ a: 1, b: 2 }, { b: 2 }];
    const text = encode(value);
    expect(text).toMatch(/^\[2\]\n/u);
    expect(Buffer.byteLength(text)).toBe(26);
    expect(Buffer.byteLength(JSON.stringify(value))).toBe(23);
    const summary = API.find((entry) => entry.id === 'encode')?.summary;
    expect(summary).toContain('For lists, the encoder uses a table only if the header and rows are shorter in UTF-8 bytes than compact JSON.');
    expect(summary).toContain('The list check excludes the count line, so a tiny list table can be larger than compact JSON.');
  });

  it('explains why keyed maps compare the complete field', () => {
    const value = { longRootName: { a: { a: 1, b: 2 }, b: { b: 2, c: 1 } } };
    const fallback = `longRootName: ${JSON.stringify(value.longRootName)}`;
    expect(encode(value)).toBe(fallback);
    expect(runPy(`from terset import encode\nprint(encode(${JSON.stringify(value)}))`)).toBe(fallback);
    const summary = API.find((entry) => entry.id === 'encode')?.summary;
    expect(summary).toContain('A keyed map uses a table only if the complete named block, including the count line, is shorter in UTF-8 bytes than the field with compact JSON.');
    const shorterName = { m: value.longRootName };
    const paths = 'm/a/a: 1\nm/a/b: 2\nm/b/b: 2\nm/b/c: 1';
    expect(encode(shorterName)).toBe(paths);
    expect(runPy(`from terset import encode\nprint(encode(${JSON.stringify(shorterName)}))`)).toBe(paths);
  });

  it('matches each package version, runtime and export list', () => {
    const npm = JSON.parse(read('packages/terset/package.json')) as { version: string; engines: { node: string } };
    const pyproject = read('packages/terset-py/pyproject.toml');
    expect(npm.version).toBe(PACKAGE_VERSION);
    expect(pyproject).toContain(`version = "${PACKAGE_VERSION}"`);
    expect(INSTALL.js.note).toContain(`Node ${npm.engines.node.replace('>=', '')} and up`);
    const python = /requires-python = ">=(\d+\.\d+)"/u.exec(pyproject)?.[1];
    expect(INSTALL.py.note).toContain(`Python ${python ?? 'unknown'} and up`);

    const index = read('packages/terset/src/index.ts');
    const jsNames = [...index.matchAll(/export (?:type )?\{([^}]+)\}/gu)].flatMap((match) => (match[1] ?? '').split(',').map((name) => name.trim()));
    expect([...jsNames].sort()).toEqual([...PUBLIC_EXPORTS.js].sort());

    const all = /__all__ = \[([^\]]+)\]/u.exec(read('packages/terset-py/src/terset/__init__.py'))?.[1] ?? '';
    const pyNames = [...all.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
    expect([...pyNames].sort()).toEqual([...PUBLIC_EXPORTS.py].sort());
  });

  it('documents every export in the API reference', () => {
    const documented = API.flatMap((entry) => [entry.name.js, entry.name.py]);
    for (const name of ['encode', 'decode', 'rulesFor', 'rules_for', 'RULES']) expect(documented).toContain(name);
  });

  it('gives every heading on /docs its own anchor id', () => {
    const ids = [...DOCS_SECTIONS.map((section) => section.id), ...CHEAT_SHEET.map((input) => `cheat-${input.id}`), ...API.map((entry) => entry.id)];
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(repeated).toEqual([]);
  });

  it('lists only error messages that both packages raise word for word', () => {
    const js = [read('packages/terset/src/terset.ts'), read('packages/terset/src/entry-syntax.ts')];
    const py = read('packages/terset-py/src/terset/_terset.py');
    const missing = ERROR_MESSAGES.map((item) => item.message)
      .filter((message) => !js.some((source) => source.includes(message)) || !py.includes(message));
    expect(missing).toEqual([]);
  });
});

/** Runs a JavaScript or TypeScript example against the site's encoder and returns what it printed. */
function runJs(code: string, typescript: boolean): string {
  const body = code
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n');
  const plain = typescript ? stripTypeScriptTypes(body) : body;
  const printed: string[] = [];
  const fakeConsole = { log: (...parts: unknown[]) => printed.push(parts.map(String).join(' ')) };
  const run = runInThisContext(`(function (encode, decode, rulesFor, RULES, console) {\n${plain}\n})`) as (...args: unknown[]) => void;
  run(encode, decode, rulesFor, RULES, fakeConsole);
  return printed.join('\n');
}

/** Runs a Python example against the package source. The child gets only PATH and the package path. */
function runPy(code: string): string {
  const result = spawnSync('python3', ['-B', '-c', code], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', PYTHONPATH: new URL('packages/terset-py/src', ROOT).pathname, PYTHONDONTWRITEBYTECODE: '1' },
  });
  if (result.status !== 0) throw new Error(`python3 exited ${String(result.status)}: ${result.stderr}`);
  return result.stdout.replace(/\n$/u, '');
}

const EXAMPLES: readonly (readonly [label: string, js: CodeSample, py: CodeSample, typescript: boolean])[] =
  API.map((entry) => [entry.id, entry.example.js, entry.example.py, exampleFence(entry, 'js') === 'ts'] as const);

describe('examples', () => {
  for (const [label, js, py, typescript] of EXAMPLES) {
    it(`prints the documented output for the ${label} example in JavaScript`, () => {
      expect(runJs(js.code, typescript)).toBe(js.output);
    });
    it(`prints the documented output for the ${label} example in Python`, () => {
      expect(runPy(py.code)).toBe(py.output);
    });
  }
});
