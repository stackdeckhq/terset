// Recompute the weather comparison from the saved 1.1 and 1.2 answer rows.
import { loadSuite } from '../../../bench/src/data.ts';
import { pairedComparisons, summarize } from '../../../bench/src/report.ts';
import { Weather12AccuracyFileSchema } from '../src/data/weather-12-accuracy-schema.ts';
import { REAL_400_PUBLISHED_RUNS, readReal400Run } from './accuracy-real-400.ts';
import { equalField } from './accuracy-runs.ts';

export const WEATHER_12_ACCURACY_OUTPUT = new URL('../src/data/weather-12-accuracy-results.json', import.meta.url);
export const WEATHER_12_PUBLISHED_RUNS = REAL_400_PUBLISHED_RUNS.map(({ model, path }) => ({
  model, path: path.replace('/real400-', '/real400-weather12-'),
}));
const DATASET = 'nws-gridpoint';

export function weather12AccuracyText(): string {
  const suite = loadSuite('real-400');
  const questions = suite.questions.filter((question) => question.dataset === DATASET);
  const weather = { ...suite, questions };
  const models = WEATHER_12_PUBLISHED_RUNS.map((source) => {
    const baseline = REAL_400_PUBLISHED_RUNS.find(({ model }) => model === source.model);
    if (baseline === undefined) throw new Error(`Missing full run for ${source.model}`);
    const older = readReal400Run(baseline, suite);
    const newer = readReal400Run(source, weather, ['terset']);
    equalField(older.run.tersetFormat, '1.1', `${older.run.runId} Terset format`);
    equalField(newer.run.tersetFormat, '1.2', `${newer.run.runId} Terset format`);
    equalField(newer.run.models, older.run.models, `${newer.run.runId} model settings`);
    equalField(newer.run.failures.length, 0, `${newer.run.runId} failed calls`);

    const rows = [...newer.run.rows, ...older.run.rows.filter((row) => row.dataset === DATASET).map((row) => ({
      ...row, format: row.format === 'terset' ? 'terset-1.1' as const : row.format,
    }))];
    function score(format: typeof rows[number]['format']) {
      const { correct, total, inputTokens } = summarize(rows.filter((row) => row.format === format));
      if (total !== questions.length) throw new Error(`${source.model} ${format}: expected one answer per weather question`);
      return { correct, inputTokens };
    }
    const scores = {
      'json-compact': score('json-compact'),
      toon: score('toon'),
      'terset-1.1': score('terset-1.1'),
      'terset-1.2': score('terset'),
    };
    const paired = pairedComparisons(rows, [source.model], ['json-compact', 'toon', 'terset-1.1', 'terset'])
      .map(({ comparisonFormat, total, tersetOnly, otherOnly, gap, interval95, pValue }) => {
        if (gap === null || interval95 === null) throw new Error(`${newer.run.runId}: no paired questions`);
        return {
          comparisonFormat, total, tersetOnly, otherOnly, pValue,
          gapPoints: gap * 100,
          interval95Points: { lower: interval95.lower * 100, upper: interval95.upper * 100 },
          inputTokensFewerPct: (1 - scores['terset-1.2'].inputTokens / scores[comparisonFormat].inputTokens) * 100,
        };
      });
    const runLink = ({ runId, runOn, publishedPath }: typeof older.publication) => ({ runId, runOn, publishedPath });
    return {
      id: source.model,
      runs: { '1.1': runLink(older.publication), '1.2': runLink(newer.publication) },
      scores, paired, wrongAnswers: newer.wrongAnswers,
    };
  });
  const data = Weather12AccuracyFileSchema.parse({
    dataset: DATASET, questions: questions.length, perCallMaxOutputTokens: 8192, models,
  });
  return `${JSON.stringify(data, null, 2)}\n`;
}
