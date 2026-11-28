import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WEATHER_12_ACCURACY_OUTPUT, weather12AccuracyText } from './accuracy-weather-12.ts';
import { Weather12AccuracyFileSchema } from '../src/data/weather-12-accuracy-schema.ts';

describe('Terset 1.2 weather accuracy data', () => {
  it('keeps the site data byte-identical to a rebuild from the four published runs', () => {
    expect(readFileSync(WEATHER_12_ACCURACY_OUTPUT, 'utf8')).toBe(weather12AccuracyText());
  });

  it('matches the weather-only answer counts, reported input tokens and paired scores', () => {
    const file = Weather12AccuracyFileSchema.parse(JSON.parse(weather12AccuracyText()));
    expect(file.questions).toBe(200);
    expect(file.dataset).toBe('nws-gridpoint');
    expect(file.models.map(({ scores }) => Object.values(scores).map(({ correct, inputTokens }) => [correct, inputTokens]))).toEqual([
      [[198, 8_364_304], [199, 6_893_104], [200, 8_358_904], [200, 6_439_504]],
      [[198, 6_838_792], [196, 6_251_392], [197, 6_836_792], [199, 5_782_592]],
    ]);
    expect(file.models.map(({ paired }) => paired.map(({ comparisonFormat, total, tersetOnly, otherOnly }) =>
      [comparisonFormat, total, tersetOnly, otherOnly]))).toEqual([
      [['json-compact', 200, 2, 0], ['toon', 200, 1, 0], ['terset-1.1', 200, 0, 0]],
      [['json-compact', 200, 2, 1], ['toon', 200, 4, 1], ['terset-1.1', 200, 3, 1]],
    ]);
    expect(file.models.flatMap(({ paired }) => paired.map(({ pValue }) => Number(pValue.toFixed(3))))).toEqual([0.5, 1, 1, 1, 0.375, 0.625]);
    expect(file.models.flatMap(({ wrongAnswers }) => wrongAnswers)).toMatchObject([
      { model: 'gpt-6.2-sol', questionId: 'q358', text: '2026-11-20T01:00:00+00:00/PT1H', expected: '2026-11-20T02:00:00+00:00/PT1H', hitOutputCap: false },
    ]);
  });
});
