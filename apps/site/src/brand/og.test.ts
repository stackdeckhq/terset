// The share image repeats published results, so its text must follow the data.
// Each number is one the README states, written the same way, so the two never disagree.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCURACY, formatRow, intervalsOverlap } from '../data/accuracy.ts';
import type { AccuracyModel } from '../data/accuracy-schema.ts';
import { COUNTERS, benchTotals, totalsNote, underToon } from '../data/numbers.ts';
import { THEME_COLORS } from '../theme.ts';
import { OG_IMAGE_ALT, OG_IMAGE_PATH, OG_LAYOUT, OG_TEXT, darkToken, ogColors, ogSvg } from './og.ts';

const TOKENS_CSS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const OG_SVG = readFileSync(new URL('../../public/brand/og.svg', import.meta.url), 'utf8');

/** The share of compact JSON's input tokens that Terset saves on one model. */
function tokenSaving(model: AccuracyModel): number {
  return 1 - formatRow(model, 'terset').inputTokens / formatRow(model, 'json-compact').inputTokens;
}

/** The model the image quotes: the one with the largest token saving. */
function quotedModel(): AccuracyModel {
  const [best] = [...ACCURACY.models].sort((a, b) => tokenSaving(b) - tokenSaving(a));
  if (best === undefined) throw new Error('The accuracy data has no models');
  return best;
}

function stat(index: number): { readonly value: string; readonly label: string; readonly win: boolean } {
  const found = OG_TEXT.stats[index];
  if (found === undefined) throw new Error(`OG_TEXT has no stat ${String(index)}`);
  return found;
}

/** Text in an SVG <text> element, with the XML entities ogSvg escapes turned back. */
function svgTexts(svg: string): readonly string[] {
  return [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/gu)].map((match) => (match[1] ?? '').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&'));
}

describe('share image text follows the data', () => {
  // The README's o200k_base totals line says "26.8% fewer than JSON compact", from the same function.
  it('shows the o200k_base total saving against compact JSON exactly as the README states it', () => {
    if (COUNTERS === null) throw new Error('the committed bench file should be ready');
    const totals = benchTotals(COUNTERS.o200k);
    expect(totals.terset).toBeLessThan(totals.json);
    expect(totalsNote(COUNTERS.o200k)).toContain(`${stat(0).value} fewer than JSON compact`);
    expect(stat(0).label).toBe('fewer tokens than JSON');
    expect(stat(0).win).toBe(true);
  });

  // The README says "under TOON's best in 9 of 11 cases" for o200k_base.
  it('shows the o200k_base cases under TOON, and calls it a win only when that is every case', () => {
    if (COUNTERS === null) throw new Error('the committed bench file should be ready');
    const total = COUNTERS.o200k.cases.length;
    const under = underToon(COUNTERS.o200k);
    expect(stat(1).value).toBe(`${String(under)} of ${String(total)}`);
    expect(stat(1).label).toBe('cases smaller than TOON');
    expect(stat(1).win).toBe(under === total);
  });

  it('shows right answers from the same model and calls accuracy a tie, never a win', () => {
    const model = quotedModel();
    expect(stat(2).value).toBe(`${String(formatRow(model, 'terset').correct)} of ${String(ACCURACY.questions)}`);
    expect(ACCURACY.models.every(intervalsOverlap)).toBe(true);
    expect(stat(2).label).toContain('A tie with JSON');
    expect(stat(2).win).toBe(false);
  });

  it('says every word in the alt text, which uses the same constant', () => {
    for (const words of [...OG_TEXT.headline, ...OG_TEXT.stats.flatMap((item) => [item.value, item.label])]) expect(OG_IMAGE_ALT).toContain(words);
    expect(OG_IMAGE_PATH).toBe('/og-v5.png');
  });
});

describe('share image file', () => {
  it('public/brand/og.svg is built from the current source', () => {
    expect(OG_SVG).toBe(ogSvg(ogColors(TOKENS_CSS)));
  });

  it('every text in the image comes from OG_TEXT', () => {
    const expected = [OG_TEXT.name, ...OG_TEXT.headline, OG_TEXT.sub, ...OG_TEXT.stats.flatMap((item) => [item.value, item.label])];
    expect([...svgTexts(OG_SVG)].sort()).toEqual([...expected].sort());
  });

  it('uses the site dark mode: ground from the theme, text and labels from tokens.css', () => {
    const colors = ogColors(TOKENS_CSS);
    expect(colors.ground).toBe(THEME_COLORS.dark);
    expect(colors.text).toBe(darkToken(TOKENS_CSS, '--fg'));
    expect(colors.muted).toBe(darkToken(TOKENS_CSS, '--muted-fg'));
    expect(OG_SVG).toContain(`<rect width="1200" height="630" fill="${THEME_COLORS.dark}"/>`);
  });

  it('keeps everything above y=500, so the corner under the X label stays clear', () => {
    const baselines = [...OG_SVG.matchAll(/<text x="\d+" y="(\d+)"/gu)].map((match) => Number(match[1]));
    expect(baselines).toHaveLength(svgTexts(OG_SVG).length);
    expect(Math.max(...baselines)).toBeLessThanOrEqual(500);
    expect(OG_LAYOUT.divider.bottom).toBeLessThanOrEqual(500);
    expect(OG_LAYOUT.mark.y + OG_LAYOUT.mark.size).toBeLessThanOrEqual(500);
  });

  it('lines up the sub line with the last label and the columns at the top', () => {
    expect(OG_LAYOUT.sub.y).toBe(OG_LAYOUT.stats.labelYs.at(-1));
    expect(OG_LAYOUT.divider.top).toBe(OG_LAYOUT.mark.y);
    expect(OG_LAYOUT.headline.x).toBe(OG_LAYOUT.mark.x);
    expect(OG_LAYOUT.sub.x).toBe(OG_LAYOUT.mark.x);
  });
});
