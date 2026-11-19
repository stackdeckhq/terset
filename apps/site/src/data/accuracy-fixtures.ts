// Small hand-written accuracy and stress files for the site tests. Nothing in the app imports them.
// Each one makes every claim in the copy hold, so a test can change one figure and see the claim throw.
import { wilson95 } from '../../scripts/accuracy-runs.ts';
import type { AccuracyFile, AccuracyFormat, AccuracyKind, AccuracyModel } from './accuracy-schema.ts';
import type { StressAccuracyFile } from './accuracy-stress-schema.ts';
import { STRESS_GROUPS } from './accuracy-stress-schema.ts';

type AccuracyRow = AccuracyModel['rows'][number];

function accuracyRow(format: AccuracyFormat, correct: number, inputTokens: number, outputTokens: number, price: readonly [number, number]): AccuracyRow {
  const { low, high } = wilson95(correct, 244);
  return { format, correct, total: 244, low, high, inputTokens, outputTokens, totalCost: (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000 };
}

function accuracyKind(kind: AccuracyKind['kind'], questions: number, terset: number, compact: number, toon: number): AccuracyKind {
  const inputTokens = { terset, 'json-compact': compact, 'json-pretty': compact * 2, toon };
  return { kind, datasets: [kind], questions, models: [{ id: 'claude-opus-5-5', inputTokens: { ...inputTokens } }, { id: 'gpt-6.1-sol', inputTokens: { ...inputTokens } }] };
}

/** Two models, one run each. Terset costs less than compact JSON on both, and every interval overlaps. */
export const ACCURACY_FIXTURE: AccuracyFile = {
  publishedRuns: [
    { runId: 'fixture-opus', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: 'claude-opus-5-5', failedRequests: 0 },
    { runId: 'fixture-sol', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: 'gpt-6.1-sol', failedRequests: 2 },
  ],
  upstreamSha: '0123456789abcdef0123456789abcdef01234567',
  questions: 244,
  datasets: 13,
  calls: 244 * 4 * 2,
  failedCalls: 2,
  models: [
    {
      id: 'claude-opus-5-5', name: 'Claude Opus 5.5', inputTokensFrom: 'model-report', inputPerMillion: 4, outputPerMillion: 20,
      priceSource: 'https://platform.claude.com/docs/en/about-claude/pricing', priceReadOn: '2026-11-17',
      rows: [
        accuracyRow('terset', 243, 1_000_000, 40_000, [4, 20]),
        accuracyRow('json-compact', 241, 1_500_000, 40_000, [4, 20]),
        accuracyRow('json-pretty', 241, 2_000_000, 40_000, [4, 20]),
        accuracyRow('toon', 242, 1_200_000, 40_000, [4, 20]),
      ],
    },
    {
      id: 'gpt-6.1-sol', name: 'GPT 6.1 Sol', inputTokensFrom: 'model-report', inputPerMillion: 2, outputPerMillion: 10,
      priceSource: 'https://developers.openai.com/api/docs/pricing', priceReadOn: '2026-11-17',
      rows: [
        accuracyRow('terset', 242, 800_000, 20_000, [2, 10]),
        accuracyRow('json-compact', 236, 1_100_000, 20_000, [2, 10]),
        accuracyRow('json-pretty', 237, 1_600_000, 20_000, [2, 10]),
        accuracyRow('toon', 242, 1_000_000, 20_000, [2, 10]),
      ],
    },
  ],
  kinds: [accuracyKind('tabular', 41, 600, 1000, 650), accuracyKind('nested-group', 18, 300, 500, 320), accuracyKind('keyed', 17, 100, 180, 110)],
};

type StressRow = StressAccuracyFile['models'][number]['rows'][number];
type GroupFigures = readonly [scale: number, deep: number, messy: number, damage: number];

const STRESS_GROUP_TOTALS: GroupFigures = [30, 25, 40, 25];

function stressRow(format: AccuracyFormat, correct: GroupFigures, inputTokens: GroupFigures): StressRow {
  const groups = STRESS_GROUPS.map((group, index) => ({ group, correct: correct[index] ?? 0, total: STRESS_GROUP_TOTALS[index] ?? 0, inputTokens: inputTokens[index] ?? 0 }));
  const sum = (field: 'correct' | 'total' | 'inputTokens'): number => groups.reduce((total, group) => total + group[field], 0);
  return { format, correct: sum('correct'), total: sum('total'), inputTokens: sum('inputTokens'), outputTokens: 10_000, totalCost: 1, groups, sparseFieldCounts: [] };
}

/** Haiku's Terset answers to the three sparse field-count questions: one off by one, two right. */
const SPARSE_COUNTS: StressRow['sparseFieldCounts'] = ['s057', 's059', 's061'].map((questionId, index) => ({
  questionId,
  dataset: 'messy-sparse',
  prompt: `How many records include a ${['email', 'phone', 'note'][index] ?? ''} field, counting null and empty values?`,
  rowCount: 120,
  text: ['85', '83', '81'][index] ?? '',
  correct: index > 0,
}));

/** Opus and Haiku share token counts, as the two Claude models do. */
const CLAUDE_TOKENS = {
  terset: [200_000, 100_000, 150_000, 50_000],
  compact: [400_000, 200_000, 300_000, 100_000],
  pretty: [600_000, 300_000, 500_000, 200_000],
  toon: [220_000, 120_000, 160_000, 60_000],
} as const;

/**
 * Three models, one run each. Terset ties TOON for the top score on Sol and Haiku, is one
 * answer behind TOON on Opus, misses mostly long lists, and uses the fewest input tokens on every model.
 */
export const STRESS_FIXTURE: StressAccuracyFile = {
  suite: 'stress',
  source: {
    generatorSource: 'bench/src/stress/generate.ts',
    generatorSha256: 'b'.repeat(64),
    seed: 20261117,
    referenceDate: '2026-11-17T00:00:00.000Z',
    dataHashes: { 'datasets.json': 'c'.repeat(64), 'questions.json': 'd'.repeat(64) },
    encoders: { '@toon-format/toon': '4.4.0', '@stackdeck/terset': '0.3.0' },
    tokenizer: 'o200k_base',
    perCallMaxOutputTokens: 16_000,
  },
  questions: 120,
  datasets: 12,
  calls: 120 * 4 * 3,
  failedCalls: 0,
  publishedRuns: [
    { runId: 'fixture-stress-opus', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: 'claude-opus-5-5' },
    { runId: 'fixture-stress-sol', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: 'gpt-6.1-sol' },
    { runId: 'fixture-stress-haiku', runOn: '2099-01-01', publishedPath: 'bench/published/2099-01-01', model: 'claude-haiku-5-5' },
  ],
  models: [
    {
      id: 'claude-opus-5-5', name: 'Claude Opus 5.5', inputTokensFrom: 'model-report',
      rows: [
        stressRow('terset', [29, 25, 40, 25], CLAUDE_TOKENS.terset),
        stressRow('json-compact', [29, 25, 40, 22], CLAUDE_TOKENS.compact),
        stressRow('json-pretty', [30, 25, 40, 22], CLAUDE_TOKENS.pretty),
        stressRow('toon', [30, 25, 40, 25], CLAUDE_TOKENS.toon),
      ],
    },
    {
      id: 'gpt-6.1-sol', name: 'GPT 6.1 Sol', inputTokensFrom: 'model-report',
      rows: [
        stressRow('terset', [28, 25, 40, 25], [150_000, 75_000, 110_000, 40_000]),
        stressRow('json-compact', [27, 24, 40, 7], [300_000, 150_000, 220_000, 80_000]),
        stressRow('json-pretty', [28, 22, 40, 21], [500_000, 250_000, 400_000, 150_000]),
        stressRow('toon', [28, 25, 40, 25], [180_000, 90_000, 140_000, 50_000]),
      ],
    },
    {
      id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', inputTokensFrom: 'model-report',
      rows: [
        { ...stressRow('terset', [24, 25, 39, 25], CLAUDE_TOKENS.terset), sparseFieldCounts: SPARSE_COUNTS },
        stressRow('json-compact', [26, 24, 40, 22], CLAUDE_TOKENS.compact),
        stressRow('json-pretty', [27, 24, 39, 22], CLAUDE_TOKENS.pretty),
        stressRow('toon', [25, 24, 39, 25], CLAUDE_TOKENS.toon),
      ],
    },
  ],
};
