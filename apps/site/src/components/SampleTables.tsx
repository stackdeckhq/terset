// The sample case tables on /benchmark: for each counter, the tokens per case with a note on
// how to read them, then the input cost at list price. The page puts them in a fold under
// Sample cases, so they work by keyboard and before hydration.
import { BENCH_TABLE_NOTE, counterList } from '../data/numbers.ts';
import type { Counters } from '../data/numbers.ts';
import { BenchTables } from './BenchTable.tsx';

export function SampleTables({ counters }: { readonly counters: Counters }) {
  return (
    <div className="full-body">
      {counterList(counters).map((counter) => (
        <div key={counter.id} className="acc full-bench">
          <h3>{`Sample cases, ${counter.label}`}</h3>
          <BenchTables counter={counter} lead={BENCH_TABLE_NOTE} />
        </div>
      ))}
    </div>
  );
}
