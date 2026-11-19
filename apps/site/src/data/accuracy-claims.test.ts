// Overlapping 95% ranges do not show the formats are equally accurate, so no accuracy copy
// may call the result a tie or a match.
// Token counts can still tie: those lines are exact and are not checked here.
// The share image label has the same check in src/brand/og.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCURACY, accuracyHomeLine, accuracyReadmeBlock, accuracySummary } from './accuracy.ts';

const READMES = ['../../../../README.md', '../../../../packages/terset/README.md', '../../../../packages/terset-py/README.md'] as const;

/** The one sentence allowed to name equal accuracy: the one that says it is not proven. */
const NOT_PROVEN = 'That does not prove the formats are equally accurate.';

/** Words that claim the formats score the same. Any tie word counts, since this text is only about accuracy. */
const SAME_SCORE = /\bti(?:e|ed|es|ing)\b|same accuracy|as accurate as|just as well|no loss in accuracy|equally accurate/iu;

/** Tie claims about accuracy in text that also holds exact token ties. */
const ACCURACY_TIE = /accuracy (?:is|was) a tie|a tie with JSON|ti(?:e|ed) on accuracy|same accuracy|as accurate as|no loss in accuracy/iu;

function readme(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('accuracy claims', () => {
  it('never calls accuracy a tie in the home line or the summary', () => {
    for (const text of [accuracyHomeLine(ACCURACY), ...accuracySummary(ACCURACY)]) expect(text.replaceAll(NOT_PROVEN, '')).not.toMatch(SAME_SCORE);
  });

  it('never calls accuracy a tie in the README accuracy block or anywhere else in the READMEs', () => {
    expect(accuracyReadmeBlock(ACCURACY).replaceAll(NOT_PROVEN, '')).not.toMatch(SAME_SCORE);
    for (const path of READMES) expect(readme(path).replaceAll(NOT_PROVEN, ''), path).not.toMatch(ACCURACY_TIE);
  });
});
