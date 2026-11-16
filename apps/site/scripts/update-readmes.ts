// Rewrites the docs blocks in the three READMEs from src/data/docs.ts.
// Usage: pnpm docs:readme (from the repository root).
// docs.test.ts fails when a block differs, so run this after editing the docs source.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { README_FILES, README_IDS, writeBlocks } from '../src/data/docs-readme.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

for (const id of README_IDS) {
  const path = `${ROOT}${README_FILES[id]}`;
  const before = readFileSync(path, 'utf8');
  const after = writeBlocks(id, before);
  if (after !== before) writeFileSync(path, after);
  console.log(`${README_FILES[id]}: ${after === before ? 'up to date' : 'updated'}`);
}
