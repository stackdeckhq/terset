// /workload shows only numbers from its data. Rendered from a changed copy of the data,
// the page shows the new numbers and none of the committed ones.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCount } from '../data/bench.ts';
import { REAL } from '../data/real.ts';
import { REAL_ACCURACY } from '../data/real-accuracy.ts';
import type { RealAccuracyFile } from '../data/real-accuracy-schema.ts';
import { REAL_400_ACCURACY } from '../data/real-400-accuracy.ts';
import { WorkloadPage } from './Workload.tsx';

const ROUTE = readFileSync(new URL('../routes/workload.tsx', import.meta.url), 'utf8');
const VIEW = ['./Workload.tsx', './WorkloadParts.tsx'].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const BENCHMARK_ROUTE = readFileSync(new URL('../routes/benchmark.tsx', import.meta.url), 'utf8');

function render(file: RealAccuracyFile): string {
  return renderToStaticMarkup(createElement(WorkloadPage, { file, real: REAL, real400: REAL_400_ACCURACY }));
}

/** The page's text, without tags, so a number split by markup still reads as one. */
function text(html: string): string {
  return html.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ');
}

/** The data with every token count tripled and the output limit doubled. Savings and accuracy stay the same. */
function changed(): RealAccuracyFile {
  const file = structuredClone(REAL_ACCURACY);
  for (const model of file.models) for (const row of model.rows) row.inputTokens *= 3;
  file.perCallMaxOutputTokens *= 2;
  return file;
}

describe('/workload page', () => {
  it('shows every token count and correct count from the data', () => {
    const page = text(render(REAL_ACCURACY));
    for (const model of REAL_ACCURACY.models) {
      for (const row of model.rows) {
        expect(page).toContain(formatCount(row.inputTokens));
        expect(page).toContain(`${formatCount(row.correct)} of ${formatCount(row.total)}`);
      }
    }
    expect(page).toContain(formatCount(REAL_ACCURACY.perCallMaxOutputTokens));
    for (const answer of REAL_ACCURACY.wrongAnswers) expect(page).toContain(answer.prompt);
  });

  it('follows the data when it changes, and keeps no committed figure', () => {
    const file = changed();
    const page = text(render(file));
    for (const model of REAL_ACCURACY.models) {
      for (const row of model.rows) {
        expect(page).toContain(formatCount(row.inputTokens * 3));
        expect(page).not.toContain(formatCount(row.inputTokens));
      }
    }
    expect(page).toContain(formatCount(file.perCallMaxOutputTokens));
    expect(page).not.toContain(formatCount(REAL_ACCURACY.perCallMaxOutputTokens));
  });

  it('types no number into the page', () => {
    // Every figure is read from data, so no text between tags in the view holds a digit.
    const strings = [...VIEW.matchAll(/>([^<>{}]+)</gu)].map((match) => match[1] ?? '');
    for (const value of strings) expect(value, value).not.toMatch(/\d/u);
    expect(ROUTE).toContain('file={REAL_ACCURACY}');
  });

  it('has one h1, real table headers, and no em dash', () => {
    const html = render(REAL_ACCURACY);
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain('<th scope="col">');
    expect(html).toContain('<th scope="row"');
    expect(html).toContain('<th scope="rowgroup"');
    expect(html).not.toContain('—');
  });

  it('is linked from /benchmark', () => {
    expect(BENCHMARK_ROUTE).toContain('href="/workload"');
  });
});
