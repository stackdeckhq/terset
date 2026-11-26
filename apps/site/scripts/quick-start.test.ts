import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import npmPackage from '../../../packages/terset/package.json' with { type: 'json' };
import { QUICK_START } from '../src/data/docs.ts';
import { buildTerset } from './measure-bundle-sizes.ts';

const ROOT = mkdtempSync(join(tmpdir(), 'terset-quick-start-'));
const JS_FILE = join(ROOT, QUICK_START.js.filename);
const PY_FILE = join(ROOT, QUICK_START.py.filename);
const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const PY_SRC = fileURLToPath(new URL('../../../packages/terset-py/src', import.meta.url));
const mypy = spawnSync('mypy', ['--version']);

beforeAll(() => {
  const pkg = join(ROOT, 'node_modules', npmPackage.name);
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(ROOT, 'package.json'), JSON.stringify({ type: 'commonjs' }));
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ type: npmPackage.type, exports: npmPackage.publishConfig.exports }));
  buildTerset(join(pkg, 'dist'));
  writeFileSync(JS_FILE, QUICK_START.js.code);
  writeFileSync(PY_FILE, QUICK_START.py.code);
}, 20_000);

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

it('runs the JavaScript quick start in a CommonJS project', () => {
  const run = spawnSync(process.execPath, [JS_FILE], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  expect(run.stdout.trimEnd()).toBe(QUICK_START.js.output);
});

it('type checks the JavaScript quick start with strict TypeScript', { timeout: 20_000 }, () => {
  const check = spawnSync(process.execPath, [
    TSC, '--strict', '--allowJs', '--checkJs', '--noEmit', '--module', 'NodeNext', '--target', 'ES2022', JS_FILE,
  ], { encoding: 'utf8' });
  expect(check.status, check.stdout + check.stderr).toBe(0);
});

it('runs the Python quick start', () => {
  const run = spawnSync('python3', ['-B', PY_FILE], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', PYTHONPATH: PY_SRC },
  });
  expect(run.status, run.stderr).toBe(0);
  expect(run.stdout.trimEnd()).toBe(QUICK_START.py.output);
});

it.skipIf(mypy.error !== undefined && 'code' in mypy.error && mypy.error.code === 'ENOENT')(
  'type checks the Python quick start with strict mypy',
  { timeout: 20_000 },
  () => {
    const check = spawnSync('mypy', ['--strict', '--config-file=', '--cache-dir', join(ROOT, 'mypy-cache'), PY_FILE], {
      encoding: 'utf8',
      env: { ...process.env, MYPYPATH: PY_SRC },
    });
    expect(check.status, check.stdout + check.stderr).toBe(0);
  },
);
