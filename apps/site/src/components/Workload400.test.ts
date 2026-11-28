// The 400-question sections of /workload show only numbers from their data. Rendered from a
// changed copy, they show the new numbers and none of the committed ones.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCount } from '../data/bench.ts';
import { REAL } from '../data/real.ts';
import { REAL_ACCURACY } from '../data/real-accuracy.ts';
import { REAL_400_ACCURACY } from '../data/real-400-accuracy.ts';
import type { Real400AccuracyFile } from '../data/real-400-accuracy-schema.ts';
import { pairedGroups } from '../data/workload-400.ts';
import { WorkloadPage } from './Workload.tsx';
import { Real400Sections } from './Workload400.tsx';

const ROUTE = readFileSync(new URL('../routes/workload.tsx', import.meta.url), 'utf8');
const VIEW = readFileSync(new URL('./Workload400.tsx', import.meta.url), 'utf8');

function render(file: Real400AccuracyFile): string {
  return renderToStaticMarkup(createElement(Real400Sections, { file }));
}

/** The text without tags or entities, so a number or a quote split by markup still reads as one. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&')
    .replace(/\s+/gu, ' ');
}

/** Every token count tripled and the output limit doubled. Savings, scores and gaps stay the same. */
function changed(): Real400AccuracyFile {
  const file = structuredClone(REAL_400_ACCURACY);
  for (const model of file.models) for (const row of model.rows) row.inputTokens *= 3;
  (file as { perCallMaxOutputTokens: number }).perCallMaxOutputTokens *= 2;
  return file;
}

describe('/workload 400-question sections', () => {
  it('shows every correct count, token count and paired figure from the data', () => {
    const page = text(render(REAL_400_ACCURACY));
    for (const model of REAL_400_ACCURACY.models) {
      for (const row of model.rows) {
        expect(page).toContain(formatCount(row.inputTokens));
        expect(page).toContain(`${formatCount(row.correct)} of ${formatCount(row.total)}`);
      }
    }
    for (const group of pairedGroups(REAL_400_ACCURACY)) {
      for (const row of group.rows) expect(page).toContain(`${row.comparison} ${row.tersetOnly} ${row.otherOnly} ${row.gap} ${row.interval} ${row.p}`);
    }
    expect(page).toContain(formatCount(REAL_400_ACCURACY.perCallMaxOutputTokens));
    expect(page).toContain('No gap between them is statistically significant.');
  });

  it('lists every wrong answer, folded per model in a native details element', () => {
    const html = render(REAL_400_ACCURACY);
    const page = text(html);
    for (const answer of REAL_400_ACCURACY.wrongAnswers) {
      expect(page).toContain(`${answer.questionId}: ${answer.prompt}`);
      expect(page).toContain(answer.expected);
    }
    expect(html.match(/<details\b/gu)).toHaveLength(REAL_400_ACCURACY.models.length);
    expect(page).toContain('36 wrong of 2,400 answers');
  });

  it('follows the data when it changes, and keeps no committed figure', () => {
    const file = changed();
    const page = text(render(file));
    for (const model of REAL_400_ACCURACY.models) {
      for (const row of model.rows) {
        expect(page).toContain(formatCount(row.inputTokens * 3));
        expect(page).not.toContain(formatCount(row.inputTokens));
      }
    }
    expect(page).toContain(formatCount(file.perCallMaxOutputTokens));
    expect(page).not.toContain(formatCount(REAL_400_ACCURACY.perCallMaxOutputTokens));
  });

  it('types no number into the view', () => {
    const strings = [...VIEW.matchAll(/>([^<>{}]+)</gu)].map((match) => match[1] ?? '');
    for (const value of strings) expect(value, value).not.toMatch(/\d/u);
  });

  it('has real table headers and captions, and no em dash', () => {
    const html = render(REAL_400_ACCURACY);
    expect(html).not.toContain('<h1');
    expect(html.match(/<table\b/gu)?.length).toBe(html.match(/<caption\b/gu)?.length);
    expect(html).toContain('<th scope="col">');
    expect(html).toContain('<th scope="row"');
    expect(html).toContain('<th scope="rowgroup"');
    expect(html).not.toContain('—');
  });

  it('comes after the 40-question content, with a link to it from the top of the page', () => {
    const page = renderToStaticMarkup(createElement(WorkloadPage, { file: REAL_ACCURACY, real: REAL, real400: REAL_400_ACCURACY }));
    expect(page).toContain('href="#q400"');
    expect(page.indexOf('id="q400"')).toBeGreaterThan(page.indexOf('id="raw"'));
    expect(page.match(/<h1\b/gu)).toHaveLength(1);
    expect(ROUTE).toContain('real400={REAL_400_ACCURACY}');
  });
});
