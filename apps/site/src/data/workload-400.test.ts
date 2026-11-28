// The 400-question helpers read every figure from real-400-accuracy-results.json and refuse a claim the data does not support.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCount } from './bench.ts';
import { REAL_400_ACCURACY } from './real-400-accuracy.ts';
import type { Real400AccuracyFile } from './real-400-accuracy-schema.ts';
import { REPO_URL } from './site.ts';
import { NO_ANSWER, workloadGroups } from './workload.ts';
import {
  PILOT_QUESTIONS,
  REAL_400_KIND_LABELS,
  SIGNIFICANCE,
  kindHead,
  kindTable,
  pairedGroups,
  pairedReading,
  real400Headline,
  real400Intro,
  real400Links,
  real400PerFile,
  real400PerKind,
  real400RunNotes,
  real400WrongSummary,
  wrong400Groups,
} from './workload-400.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

type ModelId = Real400AccuracyFile['models'][number]['id'];

interface FrozenQuestion {
  readonly dataset: string;
  readonly type: string;
}

function frozen(name: string): readonly FrozenQuestion[] {
  return JSON.parse(readFileSync(`${REPO_ROOT}bench/data/real/suite-400/${name}`, 'utf8')) as FrozenQuestion[];
}

function copy(): Real400AccuracyFile {
  return structuredClone(REAL_400_ACCURACY);
}

function model(file: Real400AccuracyFile, id: ModelId) {
  const found = file.models.find((item) => item.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

function row(file: Real400AccuracyFile, id: ModelId, format: Real400AccuracyFile['formats'][number]) {
  const found = model(file, id).rows.find((item) => item.dataset === 'ALL' && item.format === format);
  if (found === undefined) throw new Error(`no ${format} row`);
  return found;
}

describe('400-question headline', () => {
  it('says accuracy is level, gives each count and each saving from the data', () => {
    const lead = real400Headline(REAL_400_ACCURACY).join(' ');
    expect(lead).toContain('Accuracy was level across the three formats.');
    expect(lead).toContain('No gap between them is statistically significant.');
    for (const item of REAL_400_ACCURACY.models) {
      const [json, toon, terset] = REAL_400_ACCURACY.formats.map((format) => row(REAL_400_ACCURACY, item.id, format));
      expect(lead).toContain(`got ${formatCount(json?.correct ?? -1)} of ${formatCount(REAL_400_ACCURACY.questions)} right in compact JSON, ${formatCount(toon?.correct ?? -1)} in TOON and ${formatCount(terset?.correct ?? -1)} in Terset`);
      expect(lead).toContain(`${Math.abs(terset?.inputTokenChangePct ?? 0).toFixed(1)}% fewer`);
    }
    expect(lead).toContain('Claude Opus 5.5 got 398 of 400 right in compact JSON, 398 in TOON and 400 in Terset.');
    expect(lead).toContain('GPT 6.2 Sol got 389 of 400 right in compact JSON, 389 in TOON and 390 in Terset.');
    expect(lead).toContain('Both files together, Terset used 22.5% fewer input tokens than compact JSON on Claude Opus 5.5 and 18.8% fewer on GPT 6.2 Sol.');
    expect(lead).toContain('Per file it differs. On the NWS forecast grid, Terset used about as many input tokens as compact JSON, and TOON used the fewest.');
    expect(lead).not.toMatch(/more accurate|better accuracy|—/u);
  });

  it('refuses to say no gap is significant when one is', () => {
    const file = copy();
    const pair = model(file, 'gpt-6.2-sol').paired[0];
    if (pair === undefined) throw new Error('no pair');
    pair.pValue = SIGNIFICANCE / 2;
    expect(() => real400Headline(file)).toThrow(/significant/u);
  });

  it('refuses to say no gap is significant when an interval leaves out zero', () => {
    const file = copy();
    const pair = model(file, 'claude-opus-5-5').paired[1];
    if (pair === undefined) throw new Error('no pair');
    pair.interval95Points.lower = 0.1;
    expect(() => real400Headline(file)).toThrow(/zero/u);
  });

  it('refuses to say Terset used fewer tokens when it did not', () => {
    const file = copy();
    row(file, 'gpt-6.2-sol', 'terset').inputTokens = row(file, 'gpt-6.2-sol', 'json-compact').inputTokens;
    expect(() => real400Headline(file)).toThrow(/fewer input tokens/u);
  });
});

describe('400-question intro', () => {
  it('counts questions per file and per kind from the data and the frozen questions', () => {
    const questions = frozen('questions.json');
    expect(questions).toHaveLength(REAL_400_ACCURACY.questions);
    expect(real400PerFile(REAL_400_ACCURACY)).toBe(200);
    expect(real400PerKind(REAL_400_ACCURACY)).toBe(25);
    for (const dataset of REAL_400_ACCURACY.datasets) {
      for (const kind of Object.keys(REAL_400_KIND_LABELS)) {
        expect(questions.filter((item) => item.dataset === dataset && item.type === kind), `${dataset} ${kind}`).toHaveLength(real400PerKind(REAL_400_ACCURACY));
      }
    }
  });

  it('gives the pilot size of the frozen pilot file', () => {
    expect(frozen('pilot.json')).toHaveLength(PILOT_QUESTIONS);
  });

  it('states the design in plain lines', () => {
    const intro = real400Intro(REAL_400_ACCURACY).join(' ');
    expect(intro).toContain('400 new questions: 200 per file, 25 of each of eight kinds.');
    expect(intro).toContain('field retrieval, count, extreme, nested lookup, count with two conditions, compare, position and rank');
    expect(intro).toContain('frozen before any model call');
    expect(intro).toContain(`A separate pilot of ${String(PILOT_QUESTIONS)} questions ran first. It changed no question`);
    expect(intro).toContain('8,192 tokens per call');
    expect(intro).not.toContain('—');
  });
});

describe('400-question paired comparison', () => {
  it('shows each model and comparison as the data gives it', () => {
    const groups = pairedGroups(REAL_400_ACCURACY);
    expect(groups.map((group) => group.model)).toEqual(['Claude Opus 5.5', 'GPT 6.2 Sol']);
    expect(groups[0]?.rows).toEqual([
      { comparison: 'Compact JSON', tersetOnly: '2', otherOnly: '0', gap: '+0.5', interval: '−1.0 to 2.0', p: '0.5' },
      { comparison: 'TOON', tersetOnly: '2', otherOnly: '0', gap: '+0.5', interval: '−1.0 to 2.0', p: '0.5' },
    ]);
    expect(groups[1]?.rows).toEqual([
      { comparison: 'Compact JSON', tersetOnly: '7', otherOnly: '6', gap: '+0.25', interval: '−2.9 to 3.4', p: '1' },
      { comparison: 'TOON', tersetOnly: '5', otherOnly: '4', gap: '+0.25', interval: '−2.5 to 2.9', p: '1' },
    ]);
  });

  it('has gaps that match the discordant counts', () => {
    for (const item of REAL_400_ACCURACY.models) {
      for (const pair of item.paired) expect(pair.gapPoints).toBeCloseTo(((pair.tersetOnly - pair.otherOnly) / pair.total) * 100, 10);
    }
  });

  it('signs a gap where the other format was ahead', () => {
    const file = copy();
    const pair = model(file, 'gpt-6.2-sol').paired[0];
    if (pair === undefined) throw new Error('no pair');
    Object.assign(pair, { tersetOnly: 4, otherOnly: 6, gapPoints: -0.5 });
    expect(pairedGroups(file)[1]?.rows[0]?.gap).toBe('−0.5');
  });

  it('explains how to read it, with the bar it uses', () => {
    const reading = pairedReading(REAL_400_ACCURACY).join(' ');
    expect(reading).toContain('the same question asked in two formats');
    expect(reading).toContain(String(SIGNIFICANCE));
    expect(reading).toContain('every 95% interval includes zero');
  });
});

describe('400-question wrong answers', () => {
  it('counts wrong answers by kind and format, with totals that match the scores', () => {
    expect(kindHead(REAL_400_ACCURACY)).toEqual(['Question kind', 'Compact JSON', 'TOON', 'Terset']);
    for (const item of REAL_400_ACCURACY.models) {
      const table = kindTable(REAL_400_ACCURACY, item);
      expect(table.rows.map((entry) => entry.kind)).toEqual(item.wrongByKind.map((entry) => entry.kind));
      table.rows.forEach((entry, index) => {
        expect(entry.label).toBe(REAL_400_KIND_LABELS[entry.kind]);
        expect(entry.cells).toEqual(REAL_400_ACCURACY.formats.map((format) => formatCount(item.wrongByKind[index]?.counts[format] ?? -1)));
      });
      expect(table.total).toEqual(REAL_400_ACCURACY.formats.map((format) => formatCount(REAL_400_ACCURACY.questions - row(REAL_400_ACCURACY, item.id, format).correct)));
    }
  });

  it('lists every wrong answer once, under its model', () => {
    const groups = wrong400Groups(REAL_400_ACCURACY);
    expect(groups.map((group) => group.rows.length)).toEqual([4, 32]);
    expect(groups.flatMap((group) => group.rows)).toHaveLength(REAL_400_ACCURACY.wrongAnswers.length);
    for (const group of groups) {
      const answers = REAL_400_ACCURACY.wrongAnswers.filter((answer) => answer.model === group.id);
      answers.forEach((answer, index) => {
        const [, , kind, question, expected, said] = group.rows[index] ?? [];
        expect(kind).toBe(REAL_400_KIND_LABELS[answer.kind]);
        expect(question).toBe(`${answer.questionId}: ${answer.prompt}`);
        expect(expected).toBe(answer.expected);
        expect(said).toBe(answer.hitOutputCap ? NO_ANSWER : answer.text);
      });
    }
  });

  it('sums them up from the data', () => {
    expect(real400WrongSummary(REAL_400_ACCURACY)).toBe('36 wrong of 2,400 answers: 4 on Claude Opus 5.5 and 32 on GPT 6.2 Sol.');
  });
});

describe('400-question tables reuse the 40-question cells', () => {
  it('gives both files together and each file per model', () => {
    const opus = workloadGroups(REAL_400_ACCURACY, model(REAL_400_ACCURACY, 'claude-opus-5-5'));
    const all = opus.find((group) => group.dataset === 'ALL');
    expect(all?.rows.map((cell) => cell.correct)).toEqual(['398 of 400', '398 of 400', '400 of 400']);
    expect(all?.rows.map((cell) => cell.change)).toEqual(['-', '−1.5%', '−22.5%']);
  });
});

describe('400-question run notes and links', () => {
  it('notes the resumed run and its kept charge, from the data', () => {
    const notes = real400RunNotes(REAL_400_ACCURACY).join(' ');
    expect(notes).toContain('A time limit stopped the full Claude Opus 5.5 run once. It resumed with the same run id and answered all 400 questions in each format.');
    expect(notes).toContain('One interrupted call stays in the run\'s budget ledger as a charge.');
    expect(notes).not.toContain('GPT 6.2 Sol run once');
    const none = copy();
    for (const run of none.publishedRuns) run.retainedCharges = 0;
    expect(real400RunNotes(none).join(' ')).not.toContain('time limit');
  });

  it('links every run file, pilot included, and the frozen questions, and each file is in the repo', () => {
    const links = real400Links(REAL_400_ACCURACY);
    const hrefs = links.map((link) => link.href);
    for (const run of [...REAL_400_ACCURACY.publishedRuns, ...REAL_400_ACCURACY.pilotRuns]) {
      expect(hrefs).toContain(`${REPO_URL}/blob/main/${run.publishedPath}/${run.runId}.json`);
      expect(hrefs).toContain(`${REPO_URL}/blob/main/${run.publishedPath}/${run.runId}.md`);
    }
    expect(hrefs).toContain(`${REPO_URL}/blob/main/bench/data/real/suite-400/questions.json`);
    expect(hrefs).toContain(`${REPO_URL}/blob/main/bench/data/real/suite-400/pilot.json`);
    for (const { href } of links) {
      expect(existsSync(`${REPO_ROOT}${href.slice(`${REPO_URL}/blob/main/`.length)}`), href).toBe(true);
    }
  });
});
