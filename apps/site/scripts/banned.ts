// Names that must never appear in this repo or its built output.
// The list is local: it loads from apps/site/.banned.local.json, which git ignores,
// so the public repo holds no such names. With no file the list is empty, and every
// scan says so in its output line. Set TERSET_BANNED_FILE to point at another file.
// Each entry is [pattern source, flags, label]; the label is what a failure prints.
// A second local list, apps/site/.banned-agent-files.local.json, holds names that only
// the raw agent files must avoid. The repo and the site may still carry them, for
// example the package scope and the legal lines, so the repo-wide scans skip it.
// A built browser chunk that holds the o200k_base rank table may match a name as often
// as the vendored table does by chance, and no more (see bannedIn).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const LOCAL_LIST = '.banned.local.json';
const AGENT_FILE_LIST = '.banned-agent-files.local.json';
export const DEFAULT_BANNED_FILE = fileURLToPath(new URL(`../${LOCAL_LIST}`, import.meta.url));
export const DEFAULT_AGENT_FILE_BANNED_FILE = fileURLToPath(new URL(`../${AGENT_FILE_LIST}`, import.meta.url));

// No g or y: those keep lastIndex between test() calls, so a reused pattern would skip matches.
const FLAGS = /^[dimsuv]*$/u;
const BannedFileSchema = z.array(z.tuple([z.string().min(1), z.string().regex(FLAGS), z.string().min(1)]));

export interface BannedList {
  readonly names: readonly (readonly [RegExp, string])[];
  /** One line for scan output: how many names, and from where. */
  readonly note: string;
}

/**
 * Reads a local list. A missing file gives an empty list; a malformed one throws.
 * `kind` names the list in the note, and `fileName` is the file the note says is missing.
 */
export function loadBannedNames(
  path: string = process.env.TERSET_BANNED_FILE ?? DEFAULT_BANNED_FILE,
  kind = 'banned names',
  fileName = LOCAL_LIST,
): BannedList {
  if (!existsSync(path)) return { names: [], note: `${kind}: none configured (no ${fileName})` };
  const entries = BannedFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const names = entries.map(([source, flags, label]) => [new RegExp(source, flags), label] as const);
  return { names, note: `${kind}: ${String(names.length)} from the local list` };
}

const LOADED = loadBannedNames();
export const BANNED_NAMES: readonly (readonly [RegExp, string])[] = LOADED.names;
export const BANNED_NOTE: string = LOADED.note;

/** Reads the list that only the raw agent files are checked against. */
export function loadAgentFileBannedNames(
  path: string = process.env.TERSET_AGENT_FILE_BANNED_FILE ?? DEFAULT_AGENT_FILE_BANNED_FILE,
): BannedList {
  return loadBannedNames(path, 'agent-file names', AGENT_FILE_LIST);
}

type Names = readonly (readonly [RegExp, string])[];

/** One word from the o200k_base rank table, so a chunk that holds the table can be found. */
export const RANK_TABLE_MARKER = 'parâmetros';
const RANK_TABLE = fileURLToPath(new URL('../node_modules/gpt-tokenizer/esm/bpeRanks/o200k_base.js', import.meta.url));
let rankTable: string | null = null;

/** The vendored o200k_base rank table, as the package ships it. */
export function rankTableText(): string {
  rankTable ??= readFileSync(RANK_TABLE, 'utf8');
  return rankTable;
}

function countMatches(pattern: RegExp, text: string): number {
  return text.match(new RegExp(pattern.source, `${pattern.flags}g`))?.length ?? 0;
}

/** True for a built browser script that holds the rank table. Source files never qualify. */
function holdsRankTable(path: string, text: string): boolean {
  return /(?:^|\/)dist\/client\/.+\.js$/u.test(path) && text.includes(RANK_TABLE_MARKER);
}

/**
 * The banned names `text` holds. The rank table is 200k subword pieces, so a pattern can match
 * a piece by chance. A browser chunk that holds the table may match each name as often as the
 * vendored table does, and no more, so a real name anywhere else in that chunk still fails.
 */
export function bannedIn(path: string, text: string, names: Names = BANNED_NAMES): readonly string[] {
  const table = holdsRankTable(path, text) ? rankTableText() : '';
  return names.filter(([pattern]) => countMatches(pattern, text) > countMatches(pattern, table)).map(([, name]) => name);
}

const SKIP_DIRS = new Set(['node_modules']);
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);
const LOCAL_LISTS = new Set([LOCAL_LIST, AGENT_FILE_LIST]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name) || LOCAL_LISTS.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return BINARY.has(extname(name).toLowerCase()) ? [] : [path];
  });
}

export interface BannedHit {
  readonly file: string;
  readonly line: number;
  readonly name: string;
}

export interface BannedScan {
  readonly files: number;
  readonly hits: readonly BannedHit[];
}

/** Scans every text file under `root`, skipping node_modules and the local list. Paths in hits are relative to `root`. */
export function scanBanned(root: string, only?: (path: string) => boolean, names: readonly (readonly [RegExp, string])[] = BANNED_NAMES): BannedScan {
  const files = walk(root).filter((path) => only === undefined || only(relative(root, path)));
  const hits: BannedHit[] = [];
  for (const path of files) {
    const file = relative(root, path);
    const content = readFileSync(path, 'utf8');
    const found = new Set(bannedIn(file, content, names));
    const fileNames = names.filter(([, name]) => found.has(name));
    content.split('\n').forEach((text, index) => {
      for (const [pattern, name] of fileNames) {
        if (pattern.test(text)) hits.push({ file: relative(root, path), line: index + 1, name });
      }
    });
  }
  return { files: files.length, hits };
}

/**
 * A filter for scanBanned that keeps the files git tracks or has staged under `root`. Untracked
 * and ignored files, such as local plans and caches, are not repo source, and git's own files
 * are never tracked. Throws when `root` is not inside a git checkout.
 */
export function isTracked(root: string): (path: string) => boolean {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  const tracked = new Set(listed.split('\0').filter((path) => path !== ''));
  return (path) => tracked.has(path.split(sep).join('/'));
}

/** True for paths inside a build output folder. */
export function isBuiltOutput(path: string): boolean {
  return /(^|\/)(dist|\.output)\//u.test(path);
}
