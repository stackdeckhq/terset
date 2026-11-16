import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// A path inside one person's home folder works on that machine only and puts their
// account name in git history. `\x2F` is a slash, written so the selector parses
// and this file holds no such path itself. Use tmpdir() from node:os instead.
const HOME_PATH = String.raw`\x2F(?:Users|home)\x2F[\w.-]+\x2F`;
const HOME_PATH_MESSAGE = 'No home folder paths in code. Use tmpdir() from node:os, or a path relative to the repo.';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/.output/**',
      '**/.tanstack/**',
      'apps/site/src/routeTree.gen.ts',
      'apps/site/src/generated/**',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { noInlineConfig: true },
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Numbers print the same in a template as with String(), so they are allowed.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${HOME_PATH}/u]`, message: HOME_PATH_MESSAGE },
        { selector: `TemplateElement[value.raw=/${HOME_PATH}/u]`, message: HOME_PATH_MESSAGE },
      ],
    },
  },
  { files: ['apps/site/**/*.tsx'], plugins: { 'react-hooks': reactHooks }, rules: reactHooks.configs.recommended.rules },
  { files: ['apps/site/src/routes/**/*.tsx'], rules: { '@typescript-eslint/only-throw-error': 'off' } },
  // The copy fallback needs execCommand outside a secure context. Inline
  // disables are off, so the one exception lives here.
  { files: ['apps/site/src/lib/clipboard.ts'], rules: { '@typescript-eslint/no-deprecated': 'off' } },
  // This test runs the plain JavaScript shown on the page, which needs the Function constructor.
  { files: ['apps/site/src/lib/handles-demo.test.ts'], rules: { '@typescript-eslint/no-implied-eval': 'off' } },
  // node:test returns promises from test() and describe() that the runner awaits itself.
  {
    files: ['packages/terset/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', { allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['test', 'describe', 'it'] }] }],
    },
  },
  // The encoder and its tests are copied from the reference source with few edits,
  // so the copy stays easy to compare. These three rules are relaxed here only.
  {
    files: ['packages/terset/src/terset.ts', 'packages/terset/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      'no-control-regex': 'off',
    },
  },
);
