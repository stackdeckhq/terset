// The versions block and worked example on /format, and the implementations list on /docs
// and in the READMEs, state facts about both packages. Each fact is checked here against
// the package source, the conformance manifests, SPEC.md or a real run of each package.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InstallSection } from '../components/docs/DocsSections.tsx';
import { decode, encode } from '../lib/format.ts';
import { docsMarkdown } from './docs-md.ts';
import { README_FILES, README_IDS, readBlocks } from './docs-readme.ts';
import { DOC_LANGS, FAQ_STABLE, FORMAT_LINE, IMPLEMENTATIONS, INSTALL, LANG_LABELS, REGISTRY_URLS, implementationsMarkdown } from './docs.ts';
import { GENERATED } from './generated.ts';
import { PACKAGE_VERSION, REPO_URL } from './site.ts';
import { CONFORMANCE_SUITES, DEFAULT_FORMAT, FORMAT_EXAMPLE, FORMAT_INTRO, FORMAT_VERSIONS, FROZEN_FORMAT, VERSIONS_TEXT, formatDoc } from './versions.ts';
import { WORKED_EXAMPLE } from './worked-example.ts';

const ROOT = new URL('../../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, ROOT), 'utf8');
const JS_SOURCE = read('packages/terset/src/terset.ts');
const PY_SOURCE = read('packages/terset-py/src/terset/_terset.py');

/** Every test file of one package, as one text. */
function testSources(directory: string): string {
  return readdirSync(new URL(directory, ROOT))
    .filter((name) => /\.(?:ts|py)$/u.test(name))
    .map((name) => read(`${directory}${name}`))
    .join('\n');
}

/** What the Python package does with the worked example: its default text, each version's text read back, and the rejected spelling. */
interface PythonRun {
  readonly defaultText: string;
  readonly texts: Readonly<Record<string, string>>;
  readonly decoded: Readonly<Record<string, string>>;
  readonly rejection: { readonly name: string; readonly message: string } | null;
}

const PYTHON = `
import json, sys
from terset import decode, encode
value = json.loads(sys.argv[1])
versions = json.loads(sys.argv[2])
texts = {v: encode(value, format=v) for v in versions}
decoded = {v: json.dumps(decode(t)) for v, t in texts.items()}
try:
    decode(sys.argv[3])
    rejection = None
except Exception as error:
    rejection = {"name": type(error).__name__, "message": str(error)}
print(json.dumps({"defaultText": encode(value), "texts": texts, "decoded": decoded, "rejection": rejection}))
`;

function runPython(): PythonRun {
  const result = spawnSync('python3', ['-B', '-c', PYTHON, FORMAT_EXAMPLE.json, JSON.stringify(FORMAT_VERSIONS), FORMAT_EXAMPLE.rejection.text], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', PYTHONPATH: new URL('packages/terset-py/src', ROOT).pathname, PYTHONDONTWRITEBYTECODE: '1' },
  });
  if (result.status !== 0) throw new Error(`python3 exited ${String(result.status)}: ${result.stderr}`);
  return JSON.parse(result.stdout) as PythonRun;
}

describe('format versions', () => {
  it('lists the versions both packages type as FormatVersion', () => {
    const js = /^export type FormatVersion = ([^;]+);$/mu.exec(JS_SOURCE)?.[1] ?? '';
    const py = /^FormatVersion: TypeAlias = Literal\[([^\]]+)\]$/mu.exec(PY_SOURCE)?.[1] ?? '';
    const versions = (union: string): string[] => [...union.matchAll(/"(\d+\.\d+)"/gu)].map((match) => match[1] ?? '');
    expect(versions(js)).toEqual([...FORMAT_VERSIONS]);
    expect(versions(py)).toEqual([...FORMAT_VERSIONS]);
  });

  it('names as the default the version encode writes with no option, in both packages', () => {
    expect(DEFAULT_FORMAT).toBe('1.2');
    expect(encode(FORMAT_EXAMPLE.input)).toBe(encode(FORMAT_EXAMPLE.input, { format: DEFAULT_FORMAT }));
    expect(JS_SOURCE).toContain(`const { format = "${DEFAULT_FORMAT}" } = options`);
    expect(PY_SOURCE).toContain(`format: FormatVersion = "${DEFAULT_FORMAT}"`);
    expect(runPython().defaultText).toBe(FORMAT_EXAMPLE.terset);
  });

  it('names as frozen the version SPEC.md freezes, and only that one', () => {
    const spec = read('packages/terset/SPEC.md');
    expect(spec).toContain(`Format ${FROZEN_FORMAT} freezes every text`);
    for (const version of FORMAT_VERSIONS.filter((item) => item !== FROZEN_FORMAT)) expect(spec).not.toContain(`Format ${version} freezes`);
  });

  it('links one conformance suite per version, each a folder whose manifest names that version', () => {
    expect(CONFORMANCE_SUITES.map((suite) => suite.version)).toEqual([...FORMAT_VERSIONS]);
    for (const suite of CONFORMANCE_SUITES) {
      expect(existsSync(new URL(suite.path, ROOT))).toBe(true);
      const manifest = JSON.parse(read(`${suite.path}manifest.json`)) as { formatVersion: string };
      expect(manifest.formatVersion).toBe(suite.version);
      expect(suite.url).toBe(`${REPO_URL}/tree/main/${suite.path.replace(/\/$/u, '')}`);
    }
  });

  it('reads the text of every version back to the same value, in both packages', () => {
    const python = runPython();
    for (const version of FORMAT_VERSIONS) {
      const text = encode(FORMAT_EXAMPLE.input, { format: version });
      expect(JSON.stringify(decode(text))).toBe(FORMAT_EXAMPLE.json);
      expect(python.texts[version]).toBe(text);
      expect(JSON.stringify(JSON.parse(python.decoded[version] ?? 'null'))).toBe(FORMAT_EXAMPLE.json);
    }
  });

  it('runs every conformance suite in both packages', () => {
    const js = testSources('packages/terset/tests/');
    const py = testSources('packages/terset-py/tests/');
    for (const suite of CONFORMANCE_SUITES) {
      expect(js).toContain(`"../../../${suite.path}`);
      const pyPath = ['"conformance"', ...suite.path.split('/').slice(1, -1).map((part) => `"${part}"`)].join(' / ');
      expect(py).toMatch(new RegExp(`${pyPath.replaceAll('.', '\\.')}$`, 'mu'));
    }
  });
});

describe('format worked example', () => {
  it('shows the input, and the text encode writes for it', () => {
    expect(FORMAT_EXAMPLE.input).toEqual(WORKED_EXAMPLE.input);
    expect(FORMAT_EXAMPLE.json).toBe(JSON.stringify(FORMAT_EXAMPLE.input));
    expect(FORMAT_EXAMPLE.terset).toBe(encode(FORMAT_EXAMPLE.input));
  });

  it('rejects a second spelling of the same value, with the error both packages raise', () => {
    const { rejection, terset } = FORMAT_EXAMPLE;
    expect(rejection.line).toBe('team: core');
    expect(rejection.spelled).toBe('team: "core"');
    expect(JSON.parse(rejection.spelled.slice('team: '.length))).toBe(FORMAT_EXAMPLE.input.team);
    expect(rejection.text).toBe(terset.replace(rejection.line, rejection.spelled));
    expect(() => decode(rejection.text)).toThrow(SyntaxError);
    expect(() => decode(rejection.text)).toThrow(rejection.message);
    expect(rejection.message).toBe('Noncanonical Terset text.');
    expect(runPython().rejection).toEqual({ name: 'ValueError', message: rejection.message });
  });

  it('puts the versions and the example on /format, after the spec opening and before its first section', () => {
    const doc = formatDoc(read('packages/terset/SPEC.md'));
    expect(doc.headings.slice(0, 3).map((heading) => heading.text)).toEqual(['Versions', 'Worked example', 'Stability']);
    const html = doc.blocks.map((block) => (block.kind === 'html' ? block.html : block.text)).join('\n');
    expect(html.indexOf('Format version')).toBeLessThan(html.indexOf('id="versions"'));
    for (const suite of CONFORMANCE_SUITES) expect(html).toContain(`<a href="${suite.url}">${suite.path}</a>`);
    for (const shown of [FORMAT_EXAMPLE.json, FORMAT_EXAMPLE.terset, `SyntaxError: ${FORMAT_EXAMPLE.rejection.message}`]) expect(html).toContain(shown);
    expect(html).toContain(`Packages ${PACKAGE_VERSION}`);
    expect(html).toContain('a/b: 1');
    expect(html).toContain('{&quot;a&quot;:{&quot;b&quot;:1}}');
    expect(read('apps/site/src/routes/format.tsx')).toContain('formatDoc(spec)');
  });

  it('says which version is the default and which is frozen, newest first', () => {
    expect(FORMAT_INTRO).toContain(`| ${DEFAULT_FORMAT} | The default.`);
    expect(FORMAT_INTRO).toContain(`| ${FROZEN_FORMAT} | Frozen.`);
    expect(FORMAT_INTRO.indexOf(`| ${DEFAULT_FORMAT} |`)).toBeLessThan(FORMAT_INTRO.indexOf(`| ${FROZEN_FORMAT} |`));
  });
});

describe('implementations list', () => {
  it('has one row per language, with its package, first install line and suites', () => {
    expect(IMPLEMENTATIONS.map((row) => row.language)).toEqual(DOC_LANGS.map((lang) => LANG_LABELS[lang]));
    for (const [index, lang] of DOC_LANGS.entries()) {
      const row = IMPLEMENTATIONS[index];
      expect(row?.install).toBe(INSTALL[lang].commands[0]?.command);
      expect(row?.href).toBe(REGISTRY_URLS[lang]);
    }
    expect(read('packages/terset/package.json')).toContain(`"name": "${IMPLEMENTATIONS[0]?.packageName ?? ''}"`);
    expect(read('packages/terset-py/pyproject.toml')).toContain(`name = "${IMPLEMENTATIONS[1]?.packageName ?? ''}"`);
    expect(VERSIONS_TEXT).toBe('1.0, 1.1, and 1.2');
    expect(implementationsMarkdown()).toContain(`Passes the ${VERSIONS_TEXT} suites`);
  });

  it('shows the list on /docs, in /docs.md and in every README', () => {
    const html = renderToStaticMarkup(createElement(InstallSection));
    for (const row of IMPLEMENTATIONS) {
      expect(html).toContain(`<a href="${row.href}">${row.packageName}</a>`);
      expect(html).toContain(`<code>${row.install}</code>`);
    }
    expect(docsMarkdown(GENERATED.rules, GENERATED.cheatSheet)).toContain(implementationsMarkdown());
    for (const id of README_IDS) expect(readBlocks(read(README_FILES[id])).get('implementations')).toBe(implementationsMarkdown());
  });

  it('states the format versions in the docs and FAQ lines from the same source', () => {
    expect(FORMAT_LINE).toContain(`format version ${DEFAULT_FORMAT} by default`);
    expect(FORMAT_LINE).toContain(`format ${FROZEN_FORMAT} still decodes`);
    expect(FAQ_STABLE).toContain(`Format ${FROZEN_FORMAT} is frozen`);
    expect(FAQ_STABLE).toContain(`writes format ${DEFAULT_FORMAT}`);
  });
});
