import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, expect, it } from 'vitest';
import { KeepJson } from '../src/components/home/KeepJson.tsx';
import { TOON_VERSION } from '../src/data/bench.ts';
import { SIZE_BYTES } from '../src/data/size.ts';
import { measureBundleSizes } from './measure-bundle-sizes.ts';

let measured: ReturnType<typeof measureBundleSizes>;
beforeAll(() => {
  measured = measureBundleSizes();
}, 20_000);

it('publishes the measured gzip sizes of the browser bundles', () => {
  expect(SIZE_BYTES).toEqual(measured);
});

it('shows each measured bundle size with its label in the home page limits', () => {
  const html = renderToStaticMarkup(createElement(KeepJson));
  const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;
  expect(html).toContain('Minified ES2022 browser bundles built with esbuild, then gzipped.');
  expect(html).toContain(`Terset encode ${kb(measured.tersetEncode)}, encode plus decode ${kb(measured.tersetAll)}.`);
  expect(html).toContain(`TOON ${TOON_VERSION} encode ${kb(measured.toonEncode)}, encode plus decode ${kb(measured.toonAll)}.`);
});
