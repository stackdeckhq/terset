import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { KeepJson } from '../src/components/home/KeepJson.tsx';
import { SIZE_BYTES, SIZE_LINE } from '../src/data/size.ts';
import { measureBundleSizes } from './measure-bundle-sizes.ts';

it('publishes the measured gzip sizes of the browser bundles', { timeout: 20_000 }, () => {
  expect(SIZE_BYTES).toEqual(measureBundleSizes());
});

it('shows the size line and its bundler in the home page limits', () => {
  expect(SIZE_LINE).toContain('esbuild');
  expect(renderToStaticMarkup(createElement(KeepJson))).toContain(SIZE_LINE);
});
