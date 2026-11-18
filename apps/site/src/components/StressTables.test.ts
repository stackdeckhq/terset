// The stress cards render every number from the data as text, mark only the fewest
// input tokens, keep every loss plain, and each table scrolls inside its own box.
// The headline card stays open on /benchmark and the group card sits in a fold.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STRESS, STRESS_DAMAGE_NOTE, STRESS_GROUP_LABELS, STRESS_QUOTED_NOTE, stressGroupRows, stressGroups, stressHeadlineNote, stressTableRows } from '../data/stress.ts';
import { StressGroupTables, StressHeadline } from './StressTables.tsx';

const headline = renderToStaticMarkup(createElement(StressHeadline, { file: STRESS }));
const groups = renderToStaticMarkup(createElement(StressGroupTables, { file: STRESS }));
const html = headline + groups;

describe('stress tables', () => {
  it('prints every headline and group cell from the data', () => {
    for (const row of stressTableRows(STRESS)) for (const cell of row) expect(html).toContain(`>${cell}</`);
    for (const group of stressGroups(STRESS)) {
      expect(html).toContain(`<h3>${STRESS_GROUP_LABELS[group].label}</h3><p class="tbl-note">${STRESS_GROUP_LABELS[group].tests}</p>`);
      for (const row of stressGroupRows(STRESS, group)) expect(html).toContain(`<tr${row[0] === 'Terset' ? ' class="is-terset"' : ''}><th scope="row">${row[0] ?? ''}</th><td>${row.slice(1).join('</td><td>')}</td></tr>`);
    }
  });

  it('marks the fewest input tokens on each model and leaves every score plain', () => {
    expect(html.match(/class="[^"]*is-less[^"]*"/gu)).toEqual(['class="is-less"', 'class="is-less"', 'class="is-less"']);
    expect(html).toContain('<td class="grp-start">109 of 120</td><td class="is-less">512,108</td>');
    expect(html).not.toMatch(/is-more|terset-cheaper|terset-pricier/u);
  });

  it('gives each table its own sideways scroll box, reachable by keyboard', () => {
    expect(html.match(/<div class="tablewrap scroll-x on-light" tabindex="0" role="region"/gu)).toHaveLength(1 + stressGroups(STRESS).length);
  });

  it('carries the damage note in the fold, the quote-mark note under the open table, and the three run report links', () => {
    expect(groups).toContain(STRESS_DAMAGE_NOTE);
    // The quote-mark note explains the compact JSON score in the open table, so it sits right under it, once.
    expect(headline).toContain(`</table></div><p class="tbl-note">${stressHeadlineNote(STRESS)}</p><p class="tbl-note">${STRESS_QUOTED_NOTE}</p>`);
    expect(groups).not.toContain(STRESS_QUOTED_NOTE);
    for (const run of STRESS.publishedRuns) expect(headline).toContain(`/blob/main/${run.publishedPath}/${run.runId}.md">`);
  });

  it('keeps the lowest Terset score and its token count in the open card', () => {
    expect(headline).toContain('<td class="grp-start">109 of 120</td><td class="is-less">512,108</td>');
  });
});
