// The handles demo maps ids out and back, and the plain source shown on the
// page behaves the same as the typed version.
import { describe, expect, it } from 'vitest';
import { DEMO_ANSWER, DEMO_ROWS, HANDLES_DEMO_SOURCE, fromHandles, toHandles } from './handles-demo.ts';

type Pair = readonly [typeof toHandles, typeof fromHandles];

function loadShown(): Pair {
  // The page's code is plain JavaScript in a string. Run it to prove it works as shown.
  const factory = new Function(`${HANDLES_DEMO_SOURCE}\nreturn [toHandles, fromHandles];`) as () => Pair;
  return factory();
}

describe('handles demo', () => {
  it('swaps ids for 1, 2, 3 and maps them back', () => {
    const handled = toHandles(DEMO_ROWS);
    expect(handled.rows.map((row) => row.id)).toEqual(['1', '2', '3']);
    const back = fromHandles(DEMO_ANSWER, handled.back);
    expect(back.ids).toEqual([DEMO_ROWS[0].id, DEMO_ROWS[2].id]);
    expect(back.unknown).toEqual(['7']);
  });

  it('runs the shown source with the same result', () => {
    const [shownTo, shownFrom] = loadShown();
    const handled = shownTo(DEMO_ROWS);
    expect(handled.rows).toEqual(toHandles(DEMO_ROWS).rows);
    expect(shownFrom(DEMO_ANSWER, handled.back)).toEqual(fromHandles(DEMO_ANSWER, toHandles(DEMO_ROWS).back));
  });
});
