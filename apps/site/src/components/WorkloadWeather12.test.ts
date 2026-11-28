// The weather 1.2 sections of /workload show only numbers from their data. Rendered from a
// changed copy, they show the new numbers and none of the committed ones.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCount } from '../data/bench.ts';
import { REAL } from '../data/real.ts';
import { REAL_ACCURACY } from '../data/real-accuracy.ts';
import { REAL_400_ACCURACY } from '../data/real-400-accuracy.ts';
import { WEATHER_12_ACCURACY } from '../data/weather-12-accuracy.ts';
import type { Weather12AccuracyFile } from '../data/weather-12-accuracy.ts';
import { WEATHER_12_TITLE, weather12Links, weather12PairedRows, weather12Pointer } from '../data/workload-weather-12.ts';
import { WorkloadPage } from './Workload.tsx';
import { Real400Sections } from './Workload400.tsx';
import { WEATHER_12_ANCHOR, Weather12Sections } from './WorkloadWeather12.tsx';

const ROUTE = readFileSync(new URL('../routes/workload.tsx', import.meta.url), 'utf8');
const VIEW = readFileSync(new URL('./WorkloadWeather12.tsx', import.meta.url), 'utf8');

function render(file: Weather12AccuracyFile): string {
  return renderToStaticMarkup(createElement(Weather12Sections, { file }));
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
function changed(): Weather12AccuracyFile {
  const file = structuredClone(WEATHER_12_ACCURACY);
  for (const model of file.models) for (const score of Object.values(model.scores)) score.inputTokens *= 3;
  (file as { perCallMaxOutputTokens: number }).perCallMaxOutputTokens *= 2;
  return file;
}

describe('/workload weather 1.2 sections', () => {
  it('shows every score, token count and paired figure from the data', () => {
    const page = text(render(WEATHER_12_ACCURACY));
    expect(page).toContain(WEATHER_12_TITLE);
    for (const model of WEATHER_12_ACCURACY.models) {
      for (const score of Object.values(model.scores)) {
        expect(page).toContain(formatCount(score.inputTokens));
        expect(page).toContain(`${formatCount(score.correct)} of ${formatCount(WEATHER_12_ACCURACY.questions)}`);
      }
    }
    for (const row of weather12PairedRows(WEATHER_12_ACCURACY)) expect(page).toContain(row.slice(1).join(' '));
    expect(page).toContain(formatCount(WEATHER_12_ACCURACY.perCallMaxOutputTokens));
    expect(page).toContain('None of the paired tests found a statistically significant accuracy difference.');
  });

  it('lists every wrong answer and links every run file', () => {
    const html = render(WEATHER_12_ACCURACY);
    const page = text(html);
    for (const model of WEATHER_12_ACCURACY.models) {
      for (const answer of model.wrongAnswers) {
        expect(page).toContain(`${answer.questionId}: ${answer.prompt}`);
        expect(page).toContain(answer.expected);
        expect(page).toContain(answer.text);
      }
    }
    for (const link of weather12Links(WEATHER_12_ACCURACY)) expect(html).toContain(`href="${link.href}"`);
  });

  it('follows the data when it changes, and keeps no committed figure', () => {
    const file = changed();
    const page = text(render(file));
    for (const model of WEATHER_12_ACCURACY.models) {
      for (const score of Object.values(model.scores)) {
        expect(page).toContain(formatCount(score.inputTokens * 3));
        expect(page).not.toContain(formatCount(score.inputTokens));
      }
    }
    expect(page).toContain(formatCount(file.perCallMaxOutputTokens));
    expect(page).not.toContain(formatCount(WEATHER_12_ACCURACY.perCallMaxOutputTokens));
  });

  it('types no number into the view', () => {
    const strings = [...VIEW.matchAll(/>([^<>{}]+)</gu)].map((match) => match[1] ?? '');
    for (const value of strings) expect(value, value).not.toMatch(/\d/u);
  });

  it('has real table headers and captions, and no em dash', () => {
    const html = render(WEATHER_12_ACCURACY);
    expect(html).not.toContain('<h1');
    expect(html.match(/<table\b/gu)?.length).toBe(html.match(/<caption\b/gu)?.length);
    expect(html).toContain('<th scope="col">');
    expect(html).toContain('<th scope="row"');
    expect(html).toContain('<th scope="rowgroup"');
    expect(html).not.toContain('—');
  });

  it('points from the format 1.1 weather results to this section', () => {
    const html = renderToStaticMarkup(createElement(Real400Sections, { file: REAL_400_ACCURACY, weather12: WEATHER_12_ACCURACY }));
    expect(text(html)).toContain(weather12Pointer(WEATHER_12_ACCURACY));
    expect(html.match(new RegExp(`href="#${WEATHER_12_ANCHOR}"`, 'gu'))?.length).toBeGreaterThanOrEqual(1);
  });

  it('comes right after the 400-question sections', () => {
    const page = renderToStaticMarkup(createElement(WorkloadPage, { file: REAL_ACCURACY, real: REAL, real400: REAL_400_ACCURACY, weather12: WEATHER_12_ACCURACY }));
    const start = page.indexOf(`id="${WEATHER_12_ANCHOR}"`);
    expect(start).toBeGreaterThan(page.indexOf('id="q400-runs"'));
    // Only the weather section's own opening tag sits between the two ids.
    expect(page.slice(page.indexOf('id="q400-runs"'), start).match(/<section\b/gu)).toHaveLength(1);
    expect(page.match(/<h1\b/gu)).toHaveLength(1);
    expect(ROUTE).toContain('weather12={WEATHER_12_ACCURACY}');
  });
});
