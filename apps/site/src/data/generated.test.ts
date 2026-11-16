// The generated samples match a fresh run of the generate script, so no
// sample on the site is stale or written by hand.
import { describe, expect, it } from 'vitest';
import { buildSamples } from '../../scripts/samples-build.ts';
import { GENERATED } from './generated.ts';

describe('generated samples', () => {
  it('equal a fresh build with the real encoder', () => {
    expect(GENERATED).toEqual(buildSamples());
  });
});
