// The seed sweep as one table: for each case shape, how many seeds put Terset
// under compact JSON and under TOON, how many tie, and the median and 5th to
// 95th percentile change. A line above says what the changes compare.
// The same rows as benchmark.md. It scrolls sideways inside its own box on small screens.
import { formatCount } from '../data/bench.ts';
import { SWEEP_TABLE_HEAD, SWEEP_TABLE_NOTE, sweepTableRows } from '../data/sweep.ts';
import type { SeedSweep } from '../data/seed-sweep-schema.ts';

export function SweepTable({ sweep }: { readonly sweep: SeedSweep }) {
  return (
    <>
      <p className="tbl-note">{SWEEP_TABLE_NOTE}</p>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Seed sweep table, scrolls sideways on small screens">
        <table className="bt">
          <caption className="sr">{`For each case shape over ${formatCount(sweep.seeds)} seeds: how many seeds put Terset under compact JSON and under TOON, how many tie, and the median change and the 5th to 95th percentile range`}</caption>
          <thead>
            <tr>
              {SWEEP_TABLE_HEAD.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sweepTableRows(sweep).map(([name, ...cells]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {cells.map((cell, index) => (
                  <td key={SWEEP_TABLE_HEAD[index + 1]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
