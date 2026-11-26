import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildSync } from 'esbuild';

const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const CONFIG = fileURLToPath(new URL('../../../packages/terset/tsconfig.build.json', import.meta.url));
const SITE = fileURLToPath(new URL('../', import.meta.url));

function gzipBundle(entry: string, names: string): number {
  const result = buildSync({
    stdin: { contents: `export { ${names} } from ${JSON.stringify(entry)};`, resolveDir: SITE },
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    write: false,
  });
  const [file] = result.outputFiles;
  if (file === undefined) throw new Error(`No bundle produced for ${entry}`);
  return gzipSync(file.contents).length;
}

export function measureBundleSizes() {
  const dist = mkdtempSync(join(tmpdir(), 'terset-bundle-'));
  try {
    execFileSync(process.execPath, [TSC, '-p', CONFIG, '--outDir', dist]);
    const terset = join(dist, 'index.js');
    const toon = '@toon-format/toon';
    return {
      tersetEncode: gzipBundle(terset, 'encode'),
      tersetAll: gzipBundle(terset, 'encode, decode'),
      toonEncode: gzipBundle(toon, 'encode'),
      toonAll: gzipBundle(toon, 'encode, decode'),
    };
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const sizes = measureBundleSizes();
  const text = `${JSON.stringify(sizes, null, 2)}\n`;
  writeFileSync(new URL('../src/data/bundle-sizes.json', import.meta.url), text);
  console.log(text.trimEnd());
}
