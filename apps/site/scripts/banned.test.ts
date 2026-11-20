// Fails if a banned name appears in the repo source or in the built output.
// The names come from a local, gitignored list (see banned.ts). The loader tests
// use a made-up name in a temp file, so this file names nothing real.
// The build also runs scripts/check-build.ts, which scans dist again after a fresh build.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { BANNED_NAMES, RANK_TABLE_MARKER, bannedIn, isBuiltOutput, isTracked, loadAgentFileBannedNames, loadBannedNames, rankTableText, scanBanned } from './banned.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TEMP = mkdtempSync(join(tmpdir(), 'terset-banned-'));

afterAll(() => {
  rmSync(TEMP, { recursive: true, force: true });
});

describe('banned name loader', () => {
  it('gives an empty list and says so when the local file is missing', () => {
    const list = loadBannedNames(join(TEMP, 'missing.json'));
    expect(list.names).toEqual([]);
    expect(list.note).toBe('banned names: none configured (no .banned.local.json)');
  });

  it('loads a made-up name with word matching, and catches it in a planted file', () => {
    const file = join(TEMP, 'list.json');
    writeFileSync(file, JSON.stringify([['\\bZORBLAX\\b', 'iu', 'a made-up name']]));
    const list = loadBannedNames(file);
    expect(list.note).toBe('banned names: 1 from the local list');
    const hit = (text: string): boolean => list.names.some(([pattern]) => pattern.test(text));
    expect(hit('zorblax')).toBe(true);
    expect(hit('zorblaxing, unzorblax')).toBe(false);
    writeFileSync(join(TEMP, 'planted.md'), 'line one\nwe use Zorblax here\n');
    const scan = scanBanned(TEMP, (path) => path === 'planted.md', list.names);
    expect(scan.hits).toEqual([{ file: 'planted.md', line: 2, name: 'a made-up name' }]);
  });

  // Local plans, ignored caches and git's own files are not repo source, so the source scans
  // read only what git tracks. A staged file counts, since it is about to be committed.
  it('scans only files git tracks or has staged, never untracked, ignored or git metadata files', () => {
    const root = mkdtempSync(join(TEMP, 'repo-'));
    const git = (...args: string[]): void => {
      execFileSync('git', ['-c', 'init.defaultBranch=main', ...args], { cwd: root, stdio: 'ignore' });
    };
    git('init', '-q');
    const homePath = new RegExp('/(?:Users|home)' + '/[\\w.-]+/', 'u');
    const line = 'see /' + 'Users/someone/notes\n';
    writeFileSync(join(root, '.gitignore'), 'ignored.md\n');
    writeFileSync(join(root, 'staged.md'), line);
    writeFileSync(join(root, 'untracked.md'), line);
    writeFileSync(join(root, 'ignored.md'), line);
    git('add', '.gitignore', 'staged.md');
    const scan = scanBanned(root, isTracked(root), [[homePath, 'a home folder path']]);
    expect(scan).toEqual({ files: 2, hits: [{ file: 'staged.md', line: 1, name: 'a home folder path' }] });
  });

  it('names the agent-file list in its note, and loads it like the main list', () => {
    const missing = loadAgentFileBannedNames(join(TEMP, 'missing-agent.json'));
    expect(missing.names).toEqual([]);
    expect(missing.note).toBe('agent-file names: none configured (no .banned-agent-files.local.json)');
    const file = join(TEMP, 'agent-list.json');
    writeFileSync(file, JSON.stringify([['zorblax', 'iu', 'a made-up org name']]));
    const list = loadAgentFileBannedNames(file);
    expect(list.note).toBe('agent-file names: 1 from the local list');
    expect(list.names.some(([pattern]) => pattern.test('by Zorblax'))).toBe(true);
  });

  it('skips both local lists when it scans a folder', () => {
    const root = mkdtempSync(join(TEMP, 'lists-'));
    const name = [['\\bZORBLAX\\b', 'iu', 'a made-up name']] as const;
    writeFileSync(join(root, '.banned.local.json'), JSON.stringify(name));
    writeFileSync(join(root, '.banned-agent-files.local.json'), JSON.stringify(name));
    writeFileSync(join(root, 'source.md'), 'clean\n');
    const names = [[/\bZORBLAX\b/iu, 'a made-up name']] as const;
    expect(scanBanned(root, undefined, names)).toEqual({ files: 1, hits: [] });
  });

  // The o200k_base table is 200k subword pieces, so a banned pattern can match one by chance.
  // " conhecer" is one such piece; a made-up name stands in for a real one.
  it('excuses a vocabulary piece only in a browser chunk that holds the rank table, and only as often as the table holds it', () => {
    const names = [
      [/\bconhecer\b/u, 'a vocabulary word'],
      [/\bzorblax\b/u, 'a made-up name'],
    ] as const;
    const chunk = 'dist/client/assets/tokens-a1b2.js';
    const table = rankTableText();
    expect(bannedIn(chunk, table, names)).toEqual([]);
    expect(bannedIn(chunk, `${table}\nconst word = "conhecer";`, names)).toEqual(['a vocabulary word']);
    expect(bannedIn(chunk, `${table}\nby zorblax`, names)).toEqual(['a made-up name']);
    // A source file that only names the marker word gets no excuse.
    expect(bannedIn('apps/site/src/lib/tokens.test.ts', `'${RANK_TABLE_MARKER}' conhecer`, names)).toEqual(['a vocabulary word']);
    const root = mkdtempSync(join(TEMP, 'vocab-'));
    writeFileSync(join(root, 'page.js'), `const words = ["${RANK_TABLE_MARKER}", "conhecer"];\n`);
    expect(scanBanned(root, undefined, names).hits).toEqual([{ file: 'page.js', line: 1, name: 'a vocabulary word' }]);
  });

  // A g or y pattern keeps lastIndex between test() calls, so a reused pattern would skip matches.
  it('rejects the g and y flags', () => {
    for (const flags of ['g', 'iy']) {
      const file = join(TEMP, `flags-${flags}.json`);
      writeFileSync(file, JSON.stringify([['zorblax', flags, 'a made-up name']]));
      expect(() => loadBannedNames(file), flags).toThrow();
    }
  });

  it('rejects a malformed list', () => {
    const file = join(TEMP, 'bad.json');
    writeFileSync(file, JSON.stringify([['x', 'not-flags', 'label']]));
    expect(() => loadBannedNames(file)).toThrow();
  });
});

describe('banned names', () => {
  it('finds none in the repo source', () => {
    const scan = scanBanned(ROOT, isTracked(ROOT));
    expect(scan.files).toBeGreaterThan(50);
    expect(scan.hits).toEqual([]);
  });

  // A path inside one person's home folder works on that machine only.
  it('finds no home folder path in the repo source', () => {
    const homePath = new RegExp('/(?:Users|home)' + '/[\\w.-]+/', 'u');
    const scan = scanBanned(ROOT, isTracked(ROOT), [[homePath, 'a home folder path']]);
    expect(scan.files).toBeGreaterThan(50);
    expect(scan.hits).toEqual([]);
  });

  it.runIf(existsSync(DIST) && BANNED_NAMES.length > 0)('finds none in the built output', () => {
    const scan = scanBanned(ROOT, isBuiltOutput);
    expect(scan.files).toBeGreaterThan(0);
    expect(scan.hits).toEqual([]);
  });
});
