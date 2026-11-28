import { formatCount } from './bench.ts';
import type { Weather12AccuracyFile } from './weather-12-accuracy.ts';
import { blob, WORKLOAD_MODEL_NAMES } from './workload.ts';

type Model = Weather12AccuracyFile['models'][number];
type Format = keyof Model['scores'];
const LABELS = {
  'json-compact': 'Compact JSON',
  toon: 'TOON',
  'terset-1.1': 'Terset 1.1',
  'terset-1.2': 'Terset 1.2',
} satisfies Record<Format, string>;
const FORMATS: readonly Format[] = ['json-compact', 'toon', 'terset-1.1', 'terset-1.2'];

export const WEATHER_12_TITLE = 'The weather file with Terset 1.2';
export const WEATHER_12_SCORE_HEAD = ['Model', 'Format', 'Correct', 'Input tokens'] as const;
export const WEATHER_12_PAIRED_HEAD = [
  'Model', 'Terset 1.2 against', 'Only 1.2 right', 'Only the other right',
  '1.2 input tokens', 'Gap, points', '95% interval, points', 'Exact p',
] as const;

export function weather12Intro(file: Weather12AccuracyFile): readonly string[] {
  return [
    `Both models answered the same ${formatCount(file.questions)} weather questions again with Terset 1.2. Each prompt included the whole forecast grid.`,
    'The compact JSON, TOON and Terset 1.1 results come from the earlier 400-question runs on the same weather questions.',
    `Code scored each answer against the frozen answer key. Each call had an output limit of ${formatCount(file.perCallMaxOutputTokens)} tokens.`,
  ];
}

function tokensFewer(value: number): string {
  if (value === 0) return 'the same';
  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? 'fewer' : 'more'}`;
}

export function weather12ResultLines(file: Weather12AccuracyFile): readonly string[] {
  const lines = file.models.map(({ id, scores, paired }) => {
    const baseline = paired.find(({ comparisonFormat }) => comparisonFormat === 'json-compact');
    if (baseline === undefined) throw new Error(`${id} has no compact JSON comparison`);
    return `${WORKLOAD_MODEL_NAMES[id]} got ${formatCount(scores['terset-1.2'].correct)} of ${formatCount(file.questions)} right with Terset 1.2 and used ${tokensFewer(baseline.inputTokensFewerPct)} input tokens than compact JSON.`;
  });
  if (file.models.every(({ paired }) => paired.every(({ pValue }) => pValue >= 0.05))) {
    lines.push('None of the paired tests found a statistically significant accuracy difference.');
  }
  return lines;
}

export function weather12ScoreRows(file: Weather12AccuracyFile): readonly (readonly string[])[] {
  return file.models.flatMap(({ id, scores }) => FORMATS.map((format) => [
    WORKLOAD_MODEL_NAMES[id], LABELS[format],
    `${formatCount(scores[format].correct)} of ${formatCount(file.questions)}`,
    formatCount(scores[format].inputTokens),
  ]));
}

export const WEATHER_12_PAIRED_NOTE = 'Each pair uses the same question. The exact p-value comes from a two-sided McNemar test. All questions use one file, so treat these results as descriptive.';

export function weather12PairedRows(file: Weather12AccuracyFile): readonly (readonly string[])[] {
  return file.models.flatMap(({ id, paired }) => paired.map((row) => [
    WORKLOAD_MODEL_NAMES[id], LABELS[row.comparisonFormat],
    formatCount(row.tersetOnly), formatCount(row.otherOnly), tokensFewer(row.inputTokensFewerPct),
    row.gapPoints.toFixed(2), `${row.interval95Points.lower.toFixed(2)} to ${row.interval95Points.upper.toFixed(2)}`,
    String(Number(row.pValue.toPrecision(3))),
  ]));
}

export function weather12WrongAnswers(file: Weather12AccuracyFile) {
  return file.models.flatMap(({ id, wrongAnswers }) => wrongAnswers.map((answer) => ({
    ...answer, model: WORKLOAD_MODEL_NAMES[id],
  })));
}

export function weather12Links(file: Weather12AccuracyFile) {
  return file.models.flatMap(({ id, runs }) => (['1.1', '1.2'] as const).flatMap((format) => {
    const { publishedPath, runId } = runs[format];
    const label = `${WORKLOAD_MODEL_NAMES[id]}, Terset ${format}`;
    return [
      { label: `${label} answers`, href: blob(`${publishedPath}/${runId}.json`) },
      { label: `${label} report`, href: blob(`${publishedPath}/${runId}.md`) },
    ];
  }));
}
