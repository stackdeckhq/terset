// Fails if a banned name appears in the repo source or in the built output.
// The names come from a local, gitignored list (see banned.ts). The loader tests
// use a made-up name in a temp file, so this file names nothing real.
// The build also runs scripts/check-build.ts, which scans dist again after a fresh build.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { BANNED_NAMES, isBuiltOutput, isGitMetadata, loadAgentFileBannedNames, loadBannedNames, scanBanned } from './banned.ts';

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

  // In a git worktree `.git` is a one-line file that names the main checkout, so it holds a home folder path.
  it('treats a .git folder and a worktree .git file as git metadata, not repo source', () => {
    expect(['.git', '.git/config', '.github/workflows/ci.yml', 'docs/.git-notes.md'].map(isGitMetadata)).toEqual([true, true, false, false]);
    const root = mkdtempSync(join(TEMP, 'worktree-'));
    writeFileSync(join(root, '.git'), 'gitdir: /' + 'Users/someone/repo/.git/worktrees/x\n');
    writeFileSync(join(root, 'source.md'), 'clean\n');
    const homePath = new RegExp('/(?:Users|home)' + '/[\\w.-]+/', 'u');
    expect(scanBanned(root, (path) => !isGitMetadata(path), [[homePath, 'a home folder path']]).hits).toEqual([]);
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

  it('rejects a malformed list', () => {
    const file = join(TEMP, 'bad.json');
    writeFileSync(file, JSON.stringify([['x', 'not-flags', 'label']]));
    expect(() => loadBannedNames(file)).toThrow();
  });
});

describe('banned names', () => {
  it('finds none in the repo source', () => {
    const scan = scanBanned(ROOT, (path) => !isBuiltOutput(path));
    expect(scan.files).toBeGreaterThan(50);
    expect(scan.hits).toEqual([]);
  });

  // A path inside one person's home folder works on that machine only.
  it('finds no home folder path in the repo source', () => {
    const homePath = new RegExp('/(?:Users|home)' + '/[\\w.-]+/', 'u');
    const scan = scanBanned(ROOT, (path) => !isBuiltOutput(path) && !isGitMetadata(path), [[homePath, 'a home folder path']]);
    expect(scan.files).toBeGreaterThan(50);
    expect(scan.hits).toEqual([]);
  });

  it.runIf(existsSync(DIST) && BANNED_NAMES.length > 0)('finds none in the built output', () => {
    const scan = scanBanned(ROOT, isBuiltOutput);
    expect(scan.files).toBeGreaterThan(0);
    expect(scan.hits).toEqual([]);
  });
});
