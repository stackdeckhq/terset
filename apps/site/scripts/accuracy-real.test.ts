import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { REAL_ACCURACY_OUTPUT, realAccuracyText } from './accuracy-real.ts';

it('keeps the real accuracy data in sync with the published runs', () => {
  const checkedIn = readFileSync(REAL_ACCURACY_OUTPUT, 'utf8');
  expect(checkedIn).toBe(realAccuracyText());
});
