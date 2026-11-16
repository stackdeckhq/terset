import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './data.ts';
import { score, wilson } from './scoring.ts';
import type { Question } from './schema.ts';

describe('upstream deterministic scoring', () => {
  // Recorded upstream answers from the result file attributed in data/README.md.
  // Keep only cases whose expected values still match the pinned generator.
  it.each([
    ['q1', '146288', '146288', true],
    ['q36', '1182.16', '1182.16', true],
    ['q5', 'yes', 'true', true],
    ['q2', 'Marketing', 'Marketing', true],
    ['q193', 'enabled,rollout,owner,updatedAt', 'enabled,rollout,owner,updatedAt', true],
    ['q13', '17', '20', false],
    ['q84', '0.49', '0.4996666666666667', false],
    ['q240', 'YES', 'NO', false],
    ['q238', 'timestamp,level,endpoint,statusCode,responseTime,userId,error', 'timestamp,level,endpoint,statusCode,responseTime,userId,error,retryable,message,stack', false],
  ] as const)('scores recorded answer for %s', (id, expected, actual, correct) => {
    const question = QUESTIONS.find(q => q.id === id);
    if (!question) throw new Error('Missing recorded question');
    expect(question.groundTruth).toBe(expected);
    expect(score(actual, question)).toBe(correct);
  });
  it('accepts every frozen ground truth', () => {
    for (const question of QUESTIONS) expect(score(question.groundTruth, question), question.id).toBe(true);
  });
  it.each([
    ['integer', '1234', 'The answer is $1,234.', true],
    ['integer', '42', '43', false],
    ['integer', '42', 'unknown', false],
    ['number', '0.42', '42%', true],
    ['number', '0.0015', '1.5e-3', true],
    ['number', '1', '1.0000005', true],
    ['number', '1', '1.01', false],
    ['boolean', 'YES', ' true ', true],
    ['boolean', 'NO', '0', true],
    ['boolean', 'NO', 'maybe', false],
    ['date', '2025-11-01', 'Nov 1, 2025', true],
    ['date', '2025-11-01', '2025-11-01T12:00:00Z', true],
    ['string', 'email', '```text\nEMAIL\n```', true],
    ['string', 'Engineering', '"engineering"', true],
    ['string', 'Engineering', 'Sales', false],
    ['csv-list-ordered', 'a,b,c', ' a, B ,c, ', true],
    ['csv-list-ordered', 'a,b,c', 'c,b,a', false],
    ['csv-list-unordered', 'a,b,c', 'c, a, B', true],
    ['csv-list-unordered', 'a,b,c', 'a,a,c', false],
  ] satisfies [Question['answerType'], string, string, boolean][])('%s: %s / %s', (answerType, groundTruth, actual, expected) => {
    expect(score(actual, { answerType, groundTruth })).toBe(expected);
  });
  it('honors per-question rounding and case sensitivity', () => {
    expect(score('1.234', { answerType: 'number', groundTruth: '1.23', normalizationOptions: { decimalPlaces: 2 } })).toBe(true);
    expect(score('EMAIL', { answerType: 'string', groundTruth: 'email', normalizationOptions: { caseSensitive: true } })).toBe(false);
    expect(score('42%', { answerType: 'number', groundTruth: '42', normalizationOptions: { allowPercent: false } })).toBe(true);
  });
});

describe('Wilson 95% interval', () => {
  it.each([
    [80, 100, 0.7111708344, 0.8666330667],
    [0, 10, 0, 0.2775327999],
    [10, 10, 0.7224672001, 1],
    [1, 2, 0.0945312057, 0.9054687943],
  ])('bounds for %i/%i', (correct, total, lower, upper) => {
    const interval = wilson(correct, total);
    expect(interval?.lower).toBeCloseTo(lower, 9);
    expect(interval?.upper).toBeCloseTo(upper, 9);
  });
  it('does not invent an interval for no observations', () => {
    expect(wilson(0, 0)).toBeNull();
    expect(() => wilson(2, 1)).toThrow('Invalid score');
  });
});
