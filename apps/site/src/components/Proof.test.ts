// The proof charts render real text for every number, mark wins and keep losses in view,
// and the full tables sit in a native fold that works by keyboard and by anchor link.
// The accuracy charts render a small hand-written file.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ACCURACY_FIXTURE } from '../data/accuracy-fixtures.ts';
import type { AccuracyFile } from '../data/accuracy.ts';
import { BENCH_TABLE_NOTE, COUNTERS, counterList } from '../data/numbers.ts';
import { datasetFoldAbout } from '../data/proof.ts';
import { AccuracyTables, KindTable } from './AccuracyTables.tsx';
import { BenchTable } from './BenchTable.tsx';
import { Fold } from './Fold.tsx';
import { BigNumbers, CostBars, DatasetChart } from './Proof.tsx';
import { SampleTables } from './SampleTables.tsx';

const BENCH_CSS = readFileSync(new URL('../styles/bench.css', import.meta.url), 'utf8');
const ACCURACY = ACCURACY_FIXTURE;

/** The fixture with Terset over compact JSON and TOON on Opus's keyed data set. */
function withOpusKeyedLoss(): AccuracyFile {
  const copy = structuredClone(ACCURACY);
  const tokens = copy.kinds.find((item) => item.kind === 'keyed')?.models.find((item) => item.id === 'claude-opus-5-5');
  if (tokens === undefined) throw new Error('no keyed tokens');
  tokens.inputTokens = { ...tokens.inputTokens, terset: 190 };
  return copy;
}

describe('big numbers', () => {
  const html = renderToStaticMarkup(createElement(BigNumbers, { file: ACCURACY }));

  it('prints each value as text, wins marked, accuracy plain', () => {
    expect(html).toContain('<li class="big-n big-tokens win">');
    expect(html).toContain('<li class="big-n big-cost win">');
    // The answers card holds a range, so it may wrap inside its column instead of pushing the page sideways.
    expect(html).toContain('<li class="big-n big-answers">');
    expect(BENCH_CSS).toMatch(/\.big-answers \.big-c b \{[^}]*white-space: normal;/u);
    for (const text of ['33.3%', '27.3%', '29.4%', '25.0%']) expect(html).toContain(`<b>${text}</b>`);
    // The lowest to the highest format on each model.
    expect(html).toContain('<b>241 to 243<span class="big-t"> of 244</span></b>');
    expect(html).toContain('<b>236 to 242<span class="big-t"> of 244</span></b>');
  });

  it('names the metric first, then one column per model with the model before its number', () => {
    const cards = html.match(/<li class="big-n[^"]*">.*?<\/li>/gu) ?? [];
    expect(cards).toHaveLength(3);
    for (const [index, metric] of ['Fewer input tokens than compact JSON', 'Lower cost than compact JSON', 'Right answers across all four formats'].entries()) {
      const card = cards[index] ?? '';
      expect(card).toMatch(new RegExp(`^<li class="big-n[^"]*"><span class="big-l">${metric}</span> <span class="big-v">`, 'u'));
      expect(card.match(/<span class="big-c"><small>(Opus|Sol)<\/small> <b>/gu)).toHaveLength(2);
    }
  });

  // The overlap line under the cards states the accuracy result; the cards only show numbers.
  it('leaves the accuracy result to the overlap line under the cards', () => {
    expect(html).not.toMatch(/\bti(?:e|ed|es)\b|overlap/iu);
  });

  it('splits each card into two equal columns with a thin line between them', () => {
    expect(BENCH_CSS).toMatch(/\.big-v \{ [^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u);
    expect(BENCH_CSS).toMatch(/\.big-c \+ \.big-c \{ [^}]*border-left: 1px solid var\(--line\);/u);
    expect(BENCH_CSS).toMatch(/\.big-c b \{ [^}]*font-variant-numeric: tabular-nums;[^}]*white-space: nowrap;/u);
    expect(BENCH_CSS).toMatch(/\.big-n\.win \.big-c b \{ color: var\(--accent\); \}/u);
  });
});

describe('cost bars', () => {
  it('dates every row with its run and marks the Terset row', () => {
    const html = renderToStaticMarkup(createElement(CostBars, { file: ACCURACY, headingId: 'h', title: 'Cost' }));
    expect(html.match(/class="cost-bar terset[ "]/gu)).toHaveLength(2);
    // One short line, so the Terset label fits the value column beside the bar.
    expect(html.match(/<small>run 2099-01-01<\/small>/gu)).toHaveLength(8);
    expect(html).not.toContain('mean of');
    expect(html).toContain('<b>$4.80</b>');
    expect(html).toContain('<b>$1.80</b>');
  });

  it('marks the cheapest format per model, and only the Terset number is accent', () => {
    for (const model of ACCURACY.models) {
      const html = renderToStaticMarkup(createElement(CostBars, { file: { ...ACCURACY, models: [model] }, headingId: 'h' }));
      const cheapest = Math.min(...model.rows.map((row) => row.totalCost));
      const marked = model.rows.filter((row) => row.totalCost === cheapest);
      expect(html.match(/class="cost-bar[^"]* min"/gu)).toHaveLength(marked.length);
    }
    expect(BENCH_CSS).toMatch(/\.cost-v b \{ [^}]*font-weight: 400;/u);
    expect(BENCH_CSS).toMatch(/\.cost-bar\.min \.cost-v b \{ [^}]*font-weight: 700;/u);
    expect(BENCH_CSS).toMatch(/\.cost-bar\.min \.cost-t i \{ [^}]*background: var\(--c-other-bar-strong\);/u);
    expect(BENCH_CSS).toMatch(/\.cost-bar\.terset \.cost-v b \{ [^}]*color: var\(--accent\);/u);
  });
});

describe('data set chart', () => {
  const html = renderToStaticMarkup(createElement(DatasetChart, { file: ACCURACY, headingId: 'ds-h' }));

  it('draws one row per data set and model, each with a spoken line', () => {
    expect(html.match(/<li class="ds-row/gu)).toHaveLength(6);
    expect(html.match(/<span class="sr">/gu)).toHaveLength(6);
  });

  it('shows a loss plainly, and no loss or tie where there is none', () => {
    expect(html).not.toContain('<span class="dv more">');
    expect(html).not.toContain('<span class="dv tie">');
    const loss = renderToStaticMarkup(createElement(DatasetChart, { file: withOpusKeyedLoss(), headingId: 'ds-h' }));
    expect(loss.match(/<span class="dv more">/gu)).toHaveLength(2);
    expect(loss).toContain('<b class="dv-v">+5.6%</b>');
    expect(loss).toContain('<b class="dv-v">+72.7%</b>');
  });

  it('names the tokenizer per model', () => {
    expect(html).toContain('<span class="tok">Claude tokenizer</span>');
    expect(html).toContain('<span class="tok">OpenAI tokenizer</span>');
  });
});

describe('accuracy and sample tables', () => {
  const accuracy = renderToStaticMarkup(createElement(AccuracyTables, { file: ACCURACY }));
  const kind = renderToStaticMarkup(createElement(KindTable, { file: ACCURACY }));
  if (COUNTERS === null) throw new Error('the bench file is pending');
  const counters = COUNTERS;
  const samples = renderToStaticMarkup(createElement(SampleTables, { counters }));

  it('keeps the accuracy tables per model apart from the table by data set', () => {
    for (const model of ACCURACY.models) expect(accuracy).toContain(`<h3>${model.name}</h3>`);
    expect(accuracy).not.toContain('<h3>By data set</h3>');
    expect(kind).toContain('<h3>By data set</h3>');
  });

  it('holds both counters, with no toggle of its own and the reading note above each token table', () => {
    expect(samples.startsWith('<div class="full-body">')).toBe(true);
    expect(samples).not.toContain('<details');
    for (const counter of counterList(counters)) expect(samples).toContain(`<h3>Sample cases, ${counter.label}</h3><p class="tbl-note">${BENCH_TABLE_NOTE.replace("'", '&#x27;')}</p><div class="tablewrap`);
    // The lossy line is in the note above, so the note below does not repeat it.
    expect(samples).not.toContain('CSV marked lossy');
  });

  it('leaves the home table notes as they were', () => {
    const [counter] = counterList(counters);
    if (counter === undefined) throw new Error('no counter');
    const home = renderToStaticMarkup(createElement(BenchTable, { counter }));
    expect(home).toContain('<p class="tbl-note">CSV marked lossy did not read back to the same typed data. Each Terset count includes rulesFor(text), the rules line fitted to that text. Pretty JSON is in this table only, not in the chart.</p>');
    expect(home).not.toContain(BENCH_TABLE_NOTE.replace("'", '&#x27;'));
  });
});

describe('data set fold', () => {
  it('says what is inside and the result in one line, from the data', () => {
    expect(datasetFoldAbout(ACCURACY)).toBe('Input tokens on each of the 3 data sets, per model, against compact JSON and TOON. Both models: Fewer tokens than TOON on 3 of 3. Fewer than compact JSON on 3 of 3.');
    expect(datasetFoldAbout(withOpusKeyedLoss())).toBe('Input tokens on each of the 3 data sets, per model, against compact JSON and TOON. Opus: Fewer tokens than TOON on 2 of 3 (1 more). Fewer than compact JSON on 2 of 3 (1 more). Sol: Fewer tokens than TOON on 3 of 3. Fewer than compact JSON on 3 of 3.');
  });
});

describe('fold', () => {
  const html = renderToStaticMarkup(createElement(Fold, { title: 'Method', tag: 'o200k_base', about: 'How each count was made.', bodyId: 'method', children: 'Body' }));

  it('is a closed native details element with the anchor on its body, so a link opens it', () => {
    expect(html).toBe(
      '<details class="fold"><summary><span class="fold-t">Method<span class="tok">o200k_base</span></span><span class="fold-d">How each count was made.</span></summary><div class="fold-body" id="method">Body</div></details>',
    );
  });
});
