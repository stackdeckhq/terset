import { formatCount } from './bench.ts';
import type { Weather12AccuracyFile } from './weather-12-accuracy.ts';
import { pairedTestCells } from './workload-400.ts';
import { NO_ANSWER, WORKLOAD_DATASET_LABELS, WORKLOAD_MODEL_NAMES, blob, listPhrase } from './workload.ts';

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
export const WEATHER_12_PAIRED_TITLE = 'Terset 1.2 against each format';
export const WEATHER_12_WRONG_TITLE = 'Terset 1.2: wrong answers and run files';
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
  return file.models.flatMap(({ id, paired }) => paired.map((row) => {
    const { gap, interval, p } = pairedTestCells(row);
    return [
      WORKLOAD_MODEL_NAMES[id], LABELS[row.comparisonFormat],
      formatCount(row.tersetOnly), formatCount(row.otherOnly), tokensFewer(row.inputTokensFewerPct),
      gap, interval, p,
    ];
  }));
}

export function weather12WrongAnswers(file: Weather12AccuracyFile) {
  return file.models.flatMap(({ id, wrongAnswers }) => wrongAnswers.map((answer) => ({
    ...answer, model: WORKLOAD_MODEL_NAMES[id],
  })));
}

export const WEATHER_12_WRONG_HEAD = ['Model', 'Question', 'Expected', 'Model said'] as const;

export type Weather12WrongRow = readonly [model: string, question: string, expected: string, said: string];

export function weather12WrongRows(file: Weather12AccuracyFile): readonly Weather12WrongRow[] {
  return weather12WrongAnswers(file).map((answer) => [
    answer.model,
    `${answer.questionId}: ${answer.prompt}`,
    answer.expected,
    answer.hitOutputCap ? NO_ANSWER : answer.text,
  ]);
}

/** "1 wrong of 400 Terset 1.2 answers, on GPT 6.2 Sol." Names the models that missed. */
export function weather12WrongSummary(file: Weather12AccuracyFile): string {
  const answers = file.questions * file.models.length;
  const wrong = weather12WrongAnswers(file);
  const head = `${formatCount(wrong.length)} wrong of ${formatCount(answers)} Terset 1.2 answers`;
  if (wrong.length === 0) return `${head}.`;
  const perModel = file.models
    .filter(({ wrongAnswers }) => wrongAnswers.length > 0)
    .map(({ id, wrongAnswers }) => (wrong.length === wrongAnswers.length
      ? WORKLOAD_MODEL_NAMES[id]
      : `${formatCount(wrongAnswers.length)} on ${WORKLOAD_MODEL_NAMES[id]}`));
  return `${head}, on ${listPhrase(perModel)}.`;
}

/** The link after the pointer, to the weather 1.2 section. */
export const WEATHER_12_POINTER_LINK = 'See the Terset 1.2 run below.';

/**
 * The note for the format 1.1 weather results: they stay true for 1.1, and 1.2 changed them.
 * Throws when Terset 1.2 did not use fewer input tokens than TOON on every model.
 */
export function weather12Pointer(file: Weather12AccuracyFile): string {
  const parts = file.models.map(({ id, paired }, index) => {
    const toon = paired.find(({ comparisonFormat }) => comparisonFormat === 'toon');
    if (toon === undefined) throw new Error(`${id} has no TOON comparison`);
    if (toon.inputTokensFewerPct <= 0) throw new Error(`Terset 1.2 did not use fewer input tokens than TOON on ${id}`);
    const fewer = `${toon.inputTokensFewerPct.toFixed(1)}% fewer`;
    return index === 0 ? `${fewer} input tokens than TOON on ${WORKLOAD_MODEL_NAMES[id]}` : `${fewer} on ${WORKLOAD_MODEL_NAMES[id]}`;
  });
  return `These runs used Terset 1.1. On the ${WORKLOAD_DATASET_LABELS[file.dataset]}, Terset 1.2 used ${listPhrase(parts)}.`;
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
