import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from '../data.ts';
import { generateReal, serializeReal } from './generate.ts';

const destination = process.argv[2] ?? fileURLToPath(new URL('../../data/real/suite/', import.meta.url));
const files = serializeReal(generateReal());
await mkdir(destination, { recursive: true });
for (const [name, text] of Object.entries(files)) {
  await writeFile(join(destination, name), text);
  console.log(`${name}: ${Buffer.byteLength(text)} bytes; SHA-256 ${hash(text)}`);
}
