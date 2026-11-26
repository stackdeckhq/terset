// The small copy button is an icon with a name and a tooltip; the strong one keeps its
// visible label. A screen reader hears what the button does, never a bare icon.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CopyButton, shownState } from './CopyButton.tsx';
import type { CopyButtonProps } from './CopyButton.tsx';

const render = (props: Omit<CopyButtonProps, 'getText'>): string => renderToStaticMarkup(createElement(CopyButton, { getText: () => 'a\tb', ...props }));
/** The button's visible text: its markup without the tooltip, the icon and the tags. */
const visibleText = (html: string): string =>
  (/<button[^>]*>([\s\S]*?)<\/button>/u.exec(html)?.[1] ?? '')
    .replace(/<span class="copy-tip"[^>]*>[\s\S]*?<\/span>/u, '')
    .replace(/<[^>]*>/gu, '')
    .trim();

describe('small copy button', () => {
  it('is an icon named "Copy" by default, with a hidden duplicate tooltip', () => {
    const html = render({});
    expect(html).toContain('aria-label="Copy"');
    expect(html).toContain('copy-icon');
    expect(html).toContain('<span class="copy-tip" aria-hidden="true">Copy</span>');
    expect(visibleText(html)).toBe('');
    expect(html).toContain('role="status"');
  });

  it('takes its name and tooltip from label', () => {
    const html = render({ label: 'Copy URL', onLight: true });
    expect(html).toContain('aria-label="Copy URL"');
    expect(html).toContain('>Copy URL</span>');
    expect(html).toContain('on-light');
  });
});

describe('labelled copy button', () => {
  it('is small, shows its label as text and needs no aria-label', () => {
    const html = render({ label: 'Copy for a prompt', labelled: true });
    expect(html).toContain('mini-btn copy-text');
    expect(html).not.toContain('copy-icon');
    expect(html).not.toContain('aria-label');
    expect(html).not.toContain('copy-tip');
    expect(visibleText(html)).toContain('Copy for a prompt');
  });
});

// aria-disabled, not disabled: the button stays in the tab order and keeps focus while it waits.
describe('disabled copy button', () => {
  it('is marked aria-disabled and stays focusable', () => {
    const html = render({ label: 'Copy for a prompt', labelled: true, disabled: true });
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]* disabled=/u);
    expect(render({})).not.toContain('aria-disabled');
  });
});

// A copy can finish after the text it copied is gone. Its result must not show on another text.
describe('copy feedback', () => {
  it('shows the result of a copy of the current text', () => {
    expect(shownState({ state: 'copied', of: 'a: 1' }, 'a: 1', false)).toBe('copied');
    expect(shownState({ state: 'failed', of: undefined }, undefined, false)).toBe('failed');
    expect(shownState(null, 'a: 1', false)).toBe('idle');
  });

  it('hides the result of a copy of an older text', () => {
    expect(shownState({ state: 'failed', of: 'old: 1' }, 'new: 2', false)).toBe('idle');
    expect(shownState({ state: 'copied', of: 'old: 1' }, undefined, false)).toBe('idle');
  });

  it('hides any result while the button is disabled', () => {
    expect(shownState({ state: 'failed', of: 'a: 1' }, 'a: 1', true)).toBe('idle');
    expect(shownState({ state: 'copied', of: undefined }, undefined, true)).toBe('idle');
  });
});

describe('strong copy button', () => {
  it('shows its label as text and needs no aria-label', () => {
    const html = render({ label: 'Copy prompt', strong: true });
    expect(html).not.toContain('aria-label');
    expect(html).not.toContain('copy-tip');
    expect(html).toContain('Copy prompt');
  });
});

describe('copy tooltip styles', () => {
  const css = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8');

  it('shows on keyboard focus, on hover and while a result shows', () => {
    expect(css).toMatch(/\.copy-icon:focus-visible > \.copy-tip[^{]*\{[^}]*visibility: visible/u);
    expect(css).toMatch(/\.copy-icon\[data-state\] > \.copy-tip[^{]*\{[^}]*visibility: visible/u);
    expect(css).toMatch(/@media \(hover: hover\) \{ \.copy-icon:hover > \.copy-tip \{ visibility: visible; \} \}/u);
  });

  it('colors the copied and failed tooltips', () => {
    expect(css).toMatch(/\.copy-icon\[data-state="copied"\] > \.copy-tip \{[^}]*var\(--ok-fg\)/u);
    expect(css).toMatch(/\.copy-icon\[data-state="failed"\] > \.copy-tip \{[^}]*var\(--bad-fg\)/u);
  });
});
