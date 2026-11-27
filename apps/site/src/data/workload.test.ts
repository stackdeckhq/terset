// The /workload helpers read every figure from real-accuracy-results.json and refuse a claim the data does not support.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCount } from './bench.ts';
import { REAL_ACCURACY } from './real-accuracy.ts';
import type { RealAccuracyFile } from './real-accuracy-schema.ts';
import { REPO_URL } from './site.ts';
import {
  NO_ANSWER,
  correctRange,
  fileResults,
  lowestFormats,
  outputCapNotes,
  tersetSaving,
  workloadGroups,
  workloadHeadline,
  workloadLinks,
  workloadPrices,
  workloadRow,
  wrongAnswerRows,
} from './workload.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** A deep copy, so a test can change one figure without touching the committed data. */
function copy(file: RealAccuracyFile = REAL_ACCURACY): RealAccuracyFile {
  return structuredClone(file);
}

function model(file: RealAccuracyFile, id: RealAccuracyFile['models'][number]['id']) {
  const found = file.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

function oneDecimal(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

describe('workload headline', () => {
  it('says accuracy is level and gives each model the saving the totals give', () => {
    const lead = workloadHeadline(REAL_ACCURACY).join(' ');
    const all = REAL_ACCURACY.models.flatMap((item) => item.rows.filter((row) => row.dataset === 'ALL'));
    const { min, max } = correctRange(REAL_ACCURACY);
    expect(min).toBe(Math.min(...all.map((row) => row.correct)));
    expect(max).toBe(Math.max(...all.map((row) => row.correct)));
    expect(lead).toContain(`${String(min)} or ${String(max)} of ${String(REAL_ACCURACY.questions)} questions right on each model`);
    for (const item of REAL_ACCURACY.models) {
      const terset = workloadRow(item, 'ALL', 'terset').inputTokens;
      const json = workloadRow(item, 'ALL', 'json-compact').inputTokens;
      expect(lead).toContain(oneDecimal(1 - terset / json));
    }
    expect(lead).toContain('Claude Opus 5.5');
    expect(lead).toContain('GPT 6.2 Sol');
    expect(lead).toContain('too small to show a difference in accuracy');
    expect(lead).not.toMatch(/more accurate|better accuracy|—/u);
  });

  it('matches the measured savings: about 22% on Claude Opus 5.5 and about 19% on GPT 6.2 Sol', () => {
    expect(tersetSaving(model(REAL_ACCURACY, 'claude-opus-5-5'), 'ALL')).toBeCloseTo(0.225, 2);
    expect(tersetSaving(model(REAL_ACCURACY, 'gpt-6.2-sol'), 'ALL')).toBeCloseTo(0.188, 2);
  });

  it('refuses to call accuracy level when formats are more than one answer apart', () => {
    const file = copy();
    workloadRow(model(file, 'gpt-6.2-sol'), 'ALL', 'toon').correct = 30;
    expect(() => workloadHeadline(file)).toThrow(/level/u);
  });

  it('refuses to say Terset used fewer tokens when it did not', () => {
    const file = copy();
    const opus = model(file, 'claude-opus-5-5');
    workloadRow(opus, 'ALL', 'terset').inputTokens = workloadRow(opus, 'ALL', 'json-compact').inputTokens + 1;
    expect(() => workloadHeadline(file)).toThrow(/fewer input tokens/u);
  });
});

describe('workload tables', () => {
  it('shows every row as counts from the data, file groups then both files', () => {
    for (const item of REAL_ACCURACY.models) {
      const groups = workloadGroups(REAL_ACCURACY, item);
      expect(groups.map((group) => group.dataset)).toEqual([...REAL_ACCURACY.datasets, 'ALL']);
      for (const group of groups) {
        expect(group.rows.map((row) => row.format)).toEqual(REAL_ACCURACY.formats);
        for (const row of group.rows) {
          const source = workloadRow(item, group.dataset, row.format);
          expect(row.correct).toBe(`${formatCount(source.correct)} of ${formatCount(source.total)}`);
          expect(row.inputTokens).toBe(formatCount(source.inputTokens));
          expect(row.lowest).toBe(lowestFormats(item, group.dataset).includes(row.format));
        }
      }
    }
  });

  it('marks the change against compact JSON with its sign, and a change too small to round in tokens', () => {
    const sol = workloadGroups(REAL_ACCURACY, model(REAL_ACCURACY, 'gpt-6.2-sol'));
    const grid = sol.find((group) => group.dataset === 'nws-gridpoint');
    expect(grid?.rows.map((row) => row.change)).toEqual(['-', '−8.6%', '−200 tokens']);
  });
});

describe('workload file results', () => {
  it('shows the loss as plainly as the win', () => {
    const [quakes, grid] = fileResults(REAL_ACCURACY);
    expect(quakes?.dataset).toBe('usgs-earthquakes');
    expect(quakes?.lines[0]).toBe('Terset used the fewest input tokens on both models.');
    expect(quakes?.lines.join(' ')).toMatch(/TOON used [\d.]+% more on Claude Opus 5\.5 and [\d.]+% more on GPT 6\.2 Sol\./u);
    expect(grid?.dataset).toBe('nws-gridpoint');
    expect(grid?.lines[0]).toBe('TOON used the fewest input tokens on both models.');
    expect(grid?.lines).toContain('So on this file Terset saves under 1.0% against compact JSON on both models.');
    expect(grid?.lines.join(' ')).toContain('200 fewer tokens on GPT 6.2 Sol');
  });

  it('names each model when the lowest format differs between them', () => {
    const file = copy();
    const sol = model(file, 'gpt-6.2-sol');
    workloadRow(sol, 'nws-gridpoint', 'terset').inputTokens = 1;
    expect(fileResults(file)[1]?.lines[0]).toBe('The fewest input tokens: TOON on Claude Opus 5.5 and Terset on GPT 6.2 Sol.');
  });
});

describe('workload wrong answers', () => {
  it('lists every wrong answer, and an answer cut off by the output limit as no answer', () => {
    const rows = wrongAnswerRows(REAL_ACCURACY);
    expect(rows).toHaveLength(REAL_ACCURACY.wrongAnswers.length);
    REAL_ACCURACY.wrongAnswers.forEach((answer, index) => {
      expect(rows[index]?.[3]).toBe(`${answer.questionId}: ${answer.prompt}`);
      expect(rows[index]?.[4]).toBe(answer.expected);
      expect(rows[index]?.[5]).toBe(answer.hitOutputCap ? NO_ANSWER : answer.text);
    });
  });

  it('explains the output limit from the data, and why it was not rerun', () => {
    const notes = outputCapNotes(REAL_ACCURACY);
    expect(notes[0]).toBe(`Claude Opus 5.5 returned no answer to r006 in all three formats. Each time it used the whole output limit of ${formatCount(REAL_ACCURACY.perCallMaxOutputTokens)} tokens before it wrote one. The limit is the same in every format.`);
    expect(notes.at(-1)).toBe('We did not rerun with a higher limit, because that would change the method after seeing the results.');
    const none = copy();
    none.wrongAnswers = none.wrongAnswers.filter((answer) => !answer.hitOutputCap);
    expect(outputCapNotes(none)).toEqual([]);
  });
});

describe('workload links and prices', () => {
  it('links each run file and the questions on main, and every linked file is in the repo', () => {
    const links = workloadLinks(REAL_ACCURACY);
    for (const run of REAL_ACCURACY.publishedRuns) {
      expect(links.map((link) => link.href)).toContain(`${REPO_URL}/blob/main/${run.publishedPath}/${run.runId}.json`);
      expect(links.map((link) => link.href)).toContain(`${REPO_URL}/blob/main/${run.publishedPath}/${run.runId}.md`);
    }
    for (const { href } of links) {
      expect(href.startsWith(`${REPO_URL}/blob/main/`)).toBe(true);
      expect(existsSync(`${REPO_ROOT}${href.slice(`${REPO_URL}/blob/main/`.length)}`), href).toBe(true);
    }
  });

  it('gives each list price and its read date from the run', () => {
    const prices = workloadPrices(REAL_ACCURACY);
    REAL_ACCURACY.publishedRuns.forEach((run, index) => {
      expect(prices[index]?.line).toContain(`$${String(run.price.inputPerMillion)} per million input tokens`);
      expect(prices[index]?.line).toContain(run.price.dateRead);
      expect(prices[index]?.sourceUrl).toBe(run.price.sourceUrl);
    });
  });
});
