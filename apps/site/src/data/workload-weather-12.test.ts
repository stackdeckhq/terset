import { describe, expect, it } from 'vitest';
import { WEATHER_12_ACCURACY } from './weather-12-accuracy.ts';
import {
  WEATHER_12_WRONG_HEAD,
  weather12Intro,
  weather12Links,
  weather12PairedRows,
  weather12Pointer,
  weather12ResultLines,
  weather12ScoreRows,
  weather12WrongAnswers,
  weather12WrongRows,
  weather12WrongSummary,
} from './workload-weather-12.ts';

describe('weather 1.2 workload text', () => {
  it('identifies the new run and the earlier runs, and states what the results show', () => {
    const intro = weather12Intro(WEATHER_12_ACCURACY).join(' ');
    expect(intro).toContain('same 200 weather questions');
    expect(intro).toContain('Terset 1.2');
    expect(intro).toContain('Terset 1.1');
    expect(weather12ResultLines(WEATHER_12_ACCURACY)).toEqual([
      'Claude Opus 5.5 got 200 of 200 right with Terset 1.2 and used 23.0% fewer input tokens than compact JSON.',
      'GPT 6.2 Sol got 199 of 200 right with Terset 1.2 and used 15.4% fewer input tokens than compact JSON.',
      'None of the paired tests found a statistically significant accuracy difference.',
    ]);
  });

  it('shows four versions or formats for each model and six paired results', () => {
    const scores = weather12ScoreRows(WEATHER_12_ACCURACY);
    expect(scores).toHaveLength(8);
    expect(scores[0]).toEqual(['Claude Opus 5.5', 'Compact JSON', '198 of 200', '8,364,304']);
    expect(scores[3]).toEqual(['Claude Opus 5.5', 'Terset 1.2', '200 of 200', '6,439,504']);
    expect(scores.at(-1)).toEqual(['GPT 6.2 Sol', 'Terset 1.2', '199 of 200', '5,782,592']);
    const paired = weather12PairedRows(WEATHER_12_ACCURACY);
    expect(paired).toHaveLength(6);
    // Gap, interval and p read the same as the 400-question paired table: signed gap, true minus sign.
    expect(paired[1]).toEqual(['Claude Opus 5.5', 'TOON', '1', '0', '6.6% fewer', '+0.5', '−2.2 to 3.1', '1']);
    expect(paired[2]?.slice(5)).toEqual(['0', '−2.2 to 2.2', '1']);
    expect(paired.at(-1)).toEqual(['GPT 6.2 Sol', 'Terset 1.1', '3', '1', '15.4% fewer', '+1', '−2.9 to 4.8', '0.625']);
  });

  it('lists the miss and links to both versions of each model run', () => {
    expect(weather12WrongAnswers(WEATHER_12_ACCURACY)).toMatchObject([{ questionId: 'q358', model: 'GPT 6.2 Sol' }]);
    const links = weather12Links(WEATHER_12_ACCURACY);
    expect(links).toHaveLength(8);
    expect(links[0]?.label).toContain('Terset 1.1');
    expect(links[0]?.href).toContain('real400-opus-2026-11-28.json');
    expect(links.at(-1)?.label).toContain('Terset 1.2');
    expect(links.at(-1)?.href).toContain('real400-weather12-sol-2026-11-28.md');
  });

  it('counts the wrong Terset 1.2 answers over both models', () => {
    expect(weather12WrongSummary(WEATHER_12_ACCURACY)).toBe('1 wrong of 400 Terset 1.2 answers, on GPT 6.2 Sol.');
    const none = structuredClone(WEATHER_12_ACCURACY);
    for (const model of none.models) model.wrongAnswers = [];
    expect(weather12WrongSummary(none)).toBe('0 wrong of 400 Terset 1.2 answers.');
    expect(weather12WrongRows(WEATHER_12_ACCURACY)).toEqual([[
      'GPT 6.2 Sol',
      'q358: What is the exact validTime of entry 56 in properties.relativeHumidity.values, counting from 1 in the given order?',
      '2026-11-20T02:00:00+00:00/PT1H',
      '2026-11-20T01:00:00+00:00/PT1H',
    ]]);
    expect(WEATHER_12_WRONG_HEAD).toHaveLength(4);
  });

  it('points the format 1.1 weather result to the 1.2 run, and refuses when 1.2 is not smaller than TOON', () => {
    expect(weather12Pointer(WEATHER_12_ACCURACY)).toBe(
      'These runs used Terset 1.1. On the NWS forecast grid, Terset 1.2 used 6.6% fewer input tokens than TOON on Claude Opus 5.5 and 7.5% fewer on GPT 6.2 Sol.',
    );
    const larger = structuredClone(WEATHER_12_ACCURACY);
    const toon = larger.models[1]?.paired.find(({ comparisonFormat }) => comparisonFormat === 'toon');
    if (toon === undefined) throw new Error('No TOON comparison');
    toon.inputTokensFewerPct = -0.4;
    expect(() => weather12Pointer(larger)).toThrow(/TOON/u);
  });
});
