// The raw agent files tell search engines which page they mirror, or to leave them out.
import { describe, expect, it } from 'vitest';
import type { RawPath } from '../data/site.ts';
import { rawResponse } from './raw.ts';

const CANONICAL: readonly (readonly [RawPath, string])[] = [
  ['/docs.md', 'https://terset.dev/docs'],
  ['/spec.md', 'https://terset.dev/format'],
  ['/benchmark.md', 'https://terset.dev/benchmark'],
  ['/agents.md', 'https://terset.dev/agents'],
];

describe('rawResponse search headers', () => {
  it('points each file that mirrors a page at that page', () => {
    for (const [path, page] of CANONICAL) {
      const headers = rawResponse(path, 'text').headers;
      expect(headers.get('link'), path).toBe(`<${page}>; rel="canonical"`);
      expect(headers.get('x-robots-tag'), path).toBeNull();
    }
  });

  it('keeps llms-full.txt out of the index, since it only repeats the others', () => {
    const headers = rawResponse('/llms-full.txt', 'text').headers;
    expect(headers.get('x-robots-tag')).toBe('noindex');
    expect(headers.get('link')).toBeNull();
  });

  it('leaves llms.txt and the skill file as they are', () => {
    for (const path of ['/llms.txt', '/skill/SKILL.md'] as const) {
      const headers = rawResponse(path, 'text').headers;
      expect([...headers.keys()].sort(), path).toEqual(['cache-control', 'content-type', 'x-content-type-options']);
    }
  });
});
