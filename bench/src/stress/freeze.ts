import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStress, serializeStress } from './generate.ts';

const destination = process.argv[2] ?? fileURLToPath(new URL('../../data/stress/', import.meta.url));
await mkdir(destination, { recursive: true });
const files = serializeStress(generateStress());
for (const [name, text] of Object.entries(files)) {
  await writeFile(join(destination, name), text);
  console.log(`${name}: ${Buffer.byteLength(text)} bytes; SHA-256 ${createHash('sha256').update(text).digest('hex')}`);
}
