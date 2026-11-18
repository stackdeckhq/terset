// The real-data counts as one table: tokens per format for each frozen file,
// then Terset's change against compact JSON and TOON. The same rows as benchmark.md.
// A short note above says how to read it and what TOON best is.
// It scrolls sideways inside its own box on small screens.
import { TOKENS_NOTE, TOON_BEST_NOTE } from '../data/bench.ts';
import { REAL_TABLE_HEAD, realTableRows } from '../data/real.ts';
import type { RealData } from '../data/real-data-schema.ts';

export function RealTable({ data }: { readonly data: RealData }) {
  return (
    <>
      <p className="tbl-note">{`${TOKENS_NOTE} ${TOON_BEST_NOTE}`}</p>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Real data table, scrolls sideways on small screens">
        <table className="bt">
          <caption className="sr">{`${data.tokenizer} tokens for each real file in Terset, compact JSON, pretty JSON and TOON best, with Terset's change against compact JSON and TOON`}</caption>
          <thead>
            <tr>
              {REAL_TABLE_HEAD.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {realTableRows(data).map(([name, ...cells]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {cells.map((cell, index) => (
                  <td key={REAL_TABLE_HEAD[index + 1]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
