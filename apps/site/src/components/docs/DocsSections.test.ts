// The cheat sheet's Terset cards line their columns up on screen, but the copy
// button must still copy the encoder's exact text, real tabs and all.
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { CHEAT_SHEET } from '../../data/docs.ts';
import { GENERATED } from '../../data/generated.ts';
import { tables } from '../../lib/format.ts';
import { CodeBlock } from '../CodeBlock.tsx';
import type { CodeBlockProps } from '../CodeBlock.tsx';
import { CheatSheetSection } from './DocsSections.tsx';

/** Every CodeBlock in an element tree, by its props. The section itself calls no hooks. */
function codeBlocks(node: ReactNode): CodeBlockProps[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => codeBlocks(child));
  if (!isValidElement<{ readonly children?: ReactNode }>(node)) return [];
  if (node.type === CodeBlock) return [node.props as unknown as CodeBlockProps];
  return codeBlocks(node.props.children);
}

const UNESCAPE: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
const textOf = (html: string): string => html.replace(/<[^>]*>/gu, '').replace(/&(?:amp|lt|gt|quot);/gu, (entity) => UNESCAPE[entity] ?? entity);

describe('cheat sheet Terset cards', () => {
  const cards = codeBlocks(CheatSheetSection()).filter((props) => props.label === 'Terset');

  it('has one Terset card per example', () => {
    expect(cards).toHaveLength(CHEAT_SHEET.length);
  });

  it('copies the encoder text with its real tabs, not the aligned view', () => {
    const tabled = cards.filter((card) => tables(card.text).length > 0);
    expect(tabled.length).toBeGreaterThan(0);
    for (const [index, card] of cards.entries()) {
      const id = CHEAT_SHEET[index]?.id;
      expect(card.text).toBe(GENERATED.cheatSheet.find((row) => row.id === id)?.terset);
    }
    for (const card of tabled) {
      expect(card.text).toContain('\t');
      expect(card.text).not.toMatch(/ {2}/u);
      // The aligned view shows the same characters, so a selection copies the same text.
      expect(card.html).toContain('class="tc"');
      expect(textOf(card.html ?? '')).toBe(card.text);
    }
  });
});
