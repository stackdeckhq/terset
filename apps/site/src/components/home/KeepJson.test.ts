// "When to keep something else" explains the config sample from its own counts.
// The config has no table, so rulesFor gives no rules and Terset can only tie or beat JSON by a little.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BENCH } from '../../data/numbers.ts';
import { SAMPLES } from '../../data/samples.ts';
import { encode, rulesFor } from '../../lib/format.ts';
import { KeepJson, configWhy } from './KeepJson.tsx';

describe('when to keep JSON', () => {
  it('sends no rules for the config sample, as the line says', () => {
    expect(rulesFor(encode(SAMPLES.config))).toBe('');
  });

  it('says what the config sample counts show, a tie included', () => {
    expect(configWhy({ json: 99, toon: 118, terset: 99 })).toBe('Nothing to put in a table, so Terset sends no rules and ties compact JSON.');
    expect(configWhy({ json: 99, toon: 118, terset: 97 })).toBe('Nothing to put in a table, so Terset sends no rules and saves little over compact JSON.');
    expect(configWhy({ json: 99, toon: 118, terset: 101 })).toBe('Nothing to put in a table, so Terset sends no rules, and compact JSON is still smaller.');
    expect(configWhy(null)).toBe('Nothing to put in a table, so Terset sends no rules and has little to save.');
  });

  it('shows the line for the committed config counts', () => {
    const config = BENCH.status === 'ready' ? BENCH.samples.config : null;
    const html = renderToStaticMarkup(createElement(KeepJson));
    expect(html).toContain(configWhy(config));
    expect(html).not.toContain('pure cost');
  });
});
