// Every table on /benchmark behind one toggle: answer accuracy per model, tokens per
// data set, then the sample case tokens and their input cost for each counter.
// The toggle is a native details element, so it works by keyboard and before hydration.
import type { AccuracyFile } from '../data/accuracy.ts';
import { counterList } from '../data/numbers.ts';
import type { Counters } from '../data/numbers.ts';
import { AccuracyTables } from './AccuracyTables.tsx';
import { BenchTables } from './BenchTable.tsx';

/** The toggle's two labels: one while the tables are closed, one while they are open. */
export const FULL_TABLES_TOGGLE = { show: 'Show full tables', hide: 'Hide full tables' } as const;

export function FullTables({ file, counters }: { readonly file: AccuracyFile; readonly counters: Counters | null }) {
  return (
    <details className="tbl full">
      {/* The label follows the open state through CSS, as in the bench table toggle. */}
      <summary>
        <span className="tbl-show">{FULL_TABLES_TOGGLE.show}</span>
        <span className="tbl-hide">{FULL_TABLES_TOGGLE.hide}</span>
      </summary>
      <div className="full-body">
        <AccuracyTables file={file} />
        {counters === null
          ? null
          : counterList(counters).map((counter) => (
              <div key={counter.id} className="acc full-bench">
                <h3>{`Sample cases, ${counter.label}`}</h3>
                <BenchTables counter={counter} />
              </div>
            ))}
      </div>
    </details>
  );
}
