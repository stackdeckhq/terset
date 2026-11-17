import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { PACKAGE_VERSION } from '../src/data/site.ts';

interface Versions {
  readonly site: string;
  readonly npm: string;
  readonly python: string;
}

interface Options {
  readonly fetch?: typeof fetch;
  readonly retryMs?: number;
  /** Manual registry probe only. Source agreement is still checked first. */
  readonly version?: string;
}

const npmSchema = z.object({ versions: z.record(z.string(), z.unknown()), 'dist-tags': z.object({ latest: z.string() }) });
const pypiSchema = z.object({ releases: z.record(z.string(), z.array(z.unknown())), info: z.object({ version: z.string() }) });

export function readVersionSources(): Versions {
  const npm: unknown = JSON.parse(readFileSync(new URL('../../../packages/terset/package.json', import.meta.url), 'utf8'));
  const python = readFileSync(new URL('../../../packages/terset-py/pyproject.toml', import.meta.url), 'utf8');
  const project = python.split(/^\[project\]\s*$/mu)[1]?.split(/^\[/mu)[0];
  const pythonVersion = /^version\s*=\s*"([^"]+)"\s*$/mu.exec(project ?? '')?.[1];
  if (pythonVersion === undefined) throw new Error('Cannot read the Python project version. Fix pyproject.toml before deploying.');
  return { site: PACKAGE_VERSION, npm: z.object({ version: z.string() }).parse(npm).version, python: pythonVersion };
}

async function registryVersion(registry: 'npm' | 'PyPI', version: string, lookup: typeof fetch, timeout: number): Promise<{ present: boolean; latest: string }> {
  try {
    const url = registry === 'npm' ? 'https://registry.npmjs.org/@stackdeck%2fterset' : 'https://pypi.org/pypi/terset/json';
    const response = await lookup(url, { signal: AbortSignal.timeout(timeout), credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (registry === 'npm') {
      const npm = npmSchema.parse(data);
      return { present: Object.hasOwn(npm.versions, version), latest: npm['dist-tags'].latest };
    }
    const pypi = pypiSchema.parse(data);
    return { present: (pypi.releases[version]?.length ?? 0) > 0, latest: pypi.info.version };
  } catch {
    throw new Error(`Registry lookup failed for ${registry}. Check registry connectivity and rerun this deploy.`);
  }
}

export async function checkPublishedVersion(versions: Versions, options: Options = {}): Promise<void> {
  if (versions.site !== versions.npm || versions.site !== versions.python) {
    throw new Error(`Version sources disagree: site ${versions.site}, npm package ${versions.npm}, Python package ${versions.python}. Align all three versions before deploying.`);
  }
  const version = options.version ?? versions.site;
  const lookup = options.fetch ?? fetch;
  const retryMs = options.retryMs ?? 0;
  const deadline = Date.now() + retryMs;
  let failure = '';
  do {
    failure = '';
    for (const registry of ['npm', 'PyPI'] as const) {
      const timeout = retryMs > 0 ? Math.max(1, Math.min(10_000, deadline - Date.now())) : 10_000;
      const result = await registryVersion(registry, version, lookup, timeout);
      if (!result.present) {
        failure = `Site names ${version} but ${registry} has ${result.latest}. Push tag v${version} to publish, then rerun this deploy.`;
        break;
      }
    }
    if (failure === '') return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, remaining)));
  } while (Date.now() < deadline);
  throw new Error(failure);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const versionArg = args.find((arg) => arg.startsWith('--version='));
    if (args.some((arg) => arg !== '--retry' && arg !== versionArg)) throw new Error('Use --retry or --version=<version> for a manual registry probe.');
    const sources = readVersionSources();
    const version = versionArg?.slice('--version='.length) ?? sources.site;
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(version)) throw new Error('Provide a valid package version for the registry probe.');
    await checkPublishedVersion(sources, { version, retryMs: args.includes('--retry') ? 120_000 : 0 });
    console.log(`PASS: ${version} exists on npm and PyPI${versionArg === undefined ? '' : ' (manual version override)'}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
