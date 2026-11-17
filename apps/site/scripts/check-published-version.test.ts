import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPublishedVersion, readVersionSources } from './check-published-version.ts';

const versions = { site: '0.2.3', npm: '0.2.3', python: '0.2.3' };
const published = () => Promise.resolve(new Response(JSON.stringify({
  versions: { '0.2.3': {} },
  'dist-tags': { latest: '0.2.3' },
  releases: { '0.2.3': [{}] },
  info: { version: '0.2.3' },
})));

describe('published site version', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('reads the three committed version sources', () => {
    const sources = readVersionSources();
    expect(sources.site).toMatch(/^\d+\.\d+\.\d+/u);
    expect(sources.npm).toBe(sources.site);
    expect(sources.python).toBe(sources.site);
  });
  it('passes when the exact version exists in both registries', async () => {
    await expect(checkPublishedVersion(versions, { fetch: published })).resolves.toBeUndefined();
  });

  it.each(['npm', 'PyPI'])('fails when the exact version is missing on %s', async (registry) => {
    const lookup: typeof fetch = async (url) => {
      const address = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if ((registry === 'npm') === address.includes('npmjs.org')) {
        return new Response(JSON.stringify({
          versions: { '0.2.2': {} }, 'dist-tags': { latest: '0.2.2' },
          releases: { '0.2.2': [{}] }, info: { version: '0.2.2' },
        }));
      }
      return published();
    };
    await expect(checkPublishedVersion(versions, { fetch: lookup })).rejects.toThrow(
      `Site names 0.2.3 but ${registry} has 0.2.2. Push tag v0.2.3 to publish, then rerun this deploy.`,
    );
  });

  it('fails before any lookup when the three version sources disagree', async () => {
    await expect(checkPublishedVersion({ ...versions, python: '0.2.2' }, {
      fetch: () => { throw new Error('Must not reach the registry'); },
    })).rejects.toThrow('Version sources disagree: site 0.2.3, npm package 0.2.3, Python package 0.2.2. Align all three versions before deploying.');
  });

  it('fails closed with a distinct network message', async () => {
    await expect(checkPublishedVersion(versions, {
      fetch: () => { throw new Error('Connection refused'); },
    })).rejects.toThrow('Registry lookup failed for npm. Check registry connectivity and rerun this deploy.');
  });

  it.each(['http', 'json', 'schema', 'timeout'])('fails closed for a %s lookup failure', async (failure) => {
    const lookup: typeof fetch = () => {
      if (failure === 'timeout') return Promise.reject(new DOMException('Timed out', 'TimeoutError'));
      return Promise.resolve(failure === 'http'
        ? new Response('', { status: 503 })
        : new Response(failure === 'json' ? 'invalid json' : '{}'));
    };
    await expect(checkPublishedVersion(versions, { fetch: lookup })).rejects.toThrow('Registry lookup failed for npm.');
  });

  it('retries a missing version until registry propagation completes', async () => {
    vi.useFakeTimers();
    let available = false;
    const lookup: typeof fetch = () => available ? published() : Promise.resolve(new Response(JSON.stringify({
      versions: {}, 'dist-tags': { latest: '0.2.2' },
    })));
    const check = checkPublishedVersion(versions, { fetch: lookup, retryMs: 120_000 });
    await vi.advanceTimersByTimeAsync(1);
    available = true;
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(check).resolves.toBeUndefined();
  });

  it('stops retrying missing versions after two minutes', async () => {
    vi.useFakeTimers();
    const lookup: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({
      versions: {}, 'dist-tags': { latest: '0.2.2' },
    })));
    const check = expect(checkPublishedVersion(versions, { fetch: lookup, retryMs: 120_000 })).rejects.toThrow('Site names 0.2.3 but npm has 0.2.2.');
    await vi.advanceTimersByTimeAsync(120_000);
    await check;
  });
});
