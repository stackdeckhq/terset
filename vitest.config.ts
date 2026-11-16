import { defineConfig } from 'vitest/config';

// The package tests use node:test and run with `node --test`.
export default defineConfig({
  test: {
    include: ['apps/site/src/**/*.test.ts', 'apps/site/scripts/**/*.test.ts', 'bench/**/*.test.ts'],
  },
});
