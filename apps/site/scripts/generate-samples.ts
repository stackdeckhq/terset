// Writes src/generated/samples.json: every sample text the site shows,
// encoded by the real package. Usage: pnpm generate (dev and build run it).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSamples } from './samples-build.ts';

const OUT = fileURLToPath(new URL('../src/generated/', import.meta.url));

mkdirSync(OUT, { recursive: true });
const built = buildSamples();
writeFileSync(`${OUT}samples.json`, `${JSON.stringify(built, null, 2)}\n`);
console.log(`Wrote src/generated/samples.json (${String(Object.keys(built.samples).length)} samples, ${String(Object.keys(built.docExamples).length)} doc examples).`);
