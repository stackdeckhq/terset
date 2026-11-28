import { describe, expect, it } from 'vitest';
import { WEATHER_12_ACCURACY } from './weather-12-accuracy.ts';
import { weather12Intro, weather12Links, weather12PairedRows, weather12ResultLines, weather12ScoreRows, weather12WrongAnswers } from './workload-weather-12.ts';

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
    expect(paired[1]?.slice(0, 5)).toEqual(['Claude Opus 5.5', 'TOON', '1', '0', '6.6% fewer']);
    expect(paired.at(-1)?.slice(0, 5)).toEqual(['GPT 6.2 Sol', 'Terset 1.1', '3', '1', '15.4% fewer']);
    expect(paired.at(-1)?.at(-1)).toBe('0.625');
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
});
