// A home step can carry a small tag next to its headline and a plain line under it.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Step } from './Step.tsx';

describe('home step heading', () => {
  it('puts the tag inside the heading and the line under it', () => {
    const html = renderToStaticMarkup(createElement(Step, { id: 'b6', title: 'Fewer tokens than TOON in 11 of 11 cases.', tag: 'OpenAI tokenizer', line: 'Fewer than compact JSON in 9 of 11.', children: null }));
    expect(html).toContain('<h2 id="h-b6" class="with-tag">Fewer tokens than TOON in 11 of 11 cases. <span class="tok">OpenAI tokenizer</span></h2><p class="line">Fewer than compact JSON in 9 of 11.</p>');
  });

  it('keeps a plain heading without a tag', () => {
    const html = renderToStaticMarkup(createElement(Step, { id: 'b6', title: 'Numbers pending', children: null }));
    expect(html).toContain('<h2 id="h-b6">Numbers pending</h2>');
    expect(html).not.toContain('class="line"');
  });
});
