import type { Normalization, Question } from './schema.ts';

type Value = string | number | boolean | string[] | undefined;
const stripQuotes = (text: string): string => text.trim().replace(/^["']|["']$/g, '');

// Ported from the upstream deterministic normalizer. Preserve its permissive
// first-number extraction and empty-list-item behavior for comparable scores.
function normalize(text: string, kind: Question['answerType'], options: Normalization): Value {
  const { caseSensitive = false, allowCurrency = true, allowPercent = true, decimalPlaces } = options;
  if (kind === 'integer' || kind === 'number') {
    const pattern = kind === 'integer'
      ? (allowCurrency ? /[$€£¥]?\s*-?\d[\d,]*/ : /-?\d[\d,]*/)
      : (allowCurrency ? /[$€£¥]?\s*-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?%?/i : /-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?%?/i);
    const token = text.match(pattern)?.[0];
    if (token === undefined) return undefined;
    const clean = token.replace(/[$€£¥,%\s]/g, '');
    let value = kind === 'integer' ? Number.parseInt(clean, 10) : Number.parseFloat(clean);
    if (Number.isNaN(value)) return undefined;
    if (kind === 'number') {
      if (allowPercent && token.endsWith('%')) value /= 100;
      if (decimalPlaces !== undefined) value = Math.round(value * 10 ** decimalPlaces) / 10 ** decimalPlaces;
    }
    return value;
  }
  if (kind === 'boolean') {
    const value = text.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(value)) return true;
    if (['false', 'no', 'n', '0'].includes(value)) return false;
    return undefined;
  }
  if (kind === 'date') {
    const clean = stripQuotes(text);
    const prefix = clean.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (prefix) return prefix;
    const date = new Date(clean);
    if (Number.isNaN(date.getTime())) return undefined;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (kind === 'csv-list-ordered' || kind === 'csv-list-unordered') {
    const items = stripQuotes(text).split(',').map(item => item.trim()).filter(Boolean)
      .map(item => caseSensitive ? item : item.toLowerCase());
    return kind === 'csv-list-unordered' ? items.sort() : items;
  }
  const value = text.trim().replace(/^["']|["']$/g, '')
    .replace(/^```[\s\S]*?```$/g, match => match.slice(3, -3).trim().replace(/^\w+\n/, '')).trim();
  return caseSensitive ? value : value.toLowerCase();
}

export function score(answer: string, question: Pick<Question, 'groundTruth' | 'answerType' | 'normalizationOptions'>): boolean {
  const options = question.normalizationOptions ?? {};
  const actual = normalize(answer, question.answerType, options);
  const expected = normalize(question.groundTruth, question.answerType, options);
  if (actual === undefined || expected === undefined) return false;
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  if (question.answerType === 'number' && typeof actual === 'number' && typeof expected === 'number' && options.decimalPlaces === undefined) {
    return Math.abs(actual - expected) <= (options.tolerance ?? 1e-6);
  }
  return actual === expected;
}

export function wilson(correct: number, total: number): { lower: number; upper: number } | null {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || correct < 0 || correct > total) throw new Error('Invalid score counts');
  if (total === 0) return null;
  const z = 1.959963984540054;
  const p = correct / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z / denominator * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total));
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}
