// The bench as tables for one counter: the chart's numbers plus pretty JSON and
// plain CSV, then the input cost at list price. For screen readers and copying.
// CSV is n/a when the data is not one list of records.
// Columns put Terset first, then the others, the same as benchmark.md.
// Each table scrolls sideways inside its own box on small screens, never the page.
import { BENCH_TABLE_HEAD, COST_TABLE_HEAD, FITTED_RULES_NOTE, benchTableRows, benchTotalsRow, costCaption, costTableRows, costTotalsRow } from '../data/numbers.ts';
import type { Counter } from '../data/numbers.ts';

/** The toggle's two labels: one while the table is closed, one while it is open. */
export const BENCH_TABLE_TOGGLE = { show: 'Show as a table', hide: 'Hide table' } as const;

function Row({ cells, head }: { readonly cells: readonly string[]; readonly head: readonly string[] }) {
  const [name, ...counts] = cells;
  return (
    <tr>
      <th scope="row">{name}</th>
      {counts.map((cell, index) => (
        <td key={head[index + 1]}>{cell}</td>
      ))}
    </tr>
  );
}

interface TableProps {
  readonly label: string;
  readonly caption: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly totals: readonly string[];
}

function Table({ label, caption, head, rows, totals }: TableProps) {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={label}>
      <table className="bt">
        <caption className="sr">{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells) => (
            <Row key={cells[0]} cells={cells} head={head} />
          ))}
        </tbody>
        <tfoot>
          <Row cells={totals} head={head} />
        </tfoot>
      </table>
    </div>
  );
}

/** The column names for one pair of tables: the tokens, then the cost. */
interface Heads {
  readonly bench: readonly string[];
  readonly cost: readonly string[];
}

/**
 * The home page table keeps the column names it had. /benchmark and benchmark.md use
 * BENCH_TABLE_HEAD and COST_TABLE_HEAD. The columns and their order are the same.
 */
const HOME_HEADS: Heads = {
  bench: ['Case', 'Terset', 'JSON compact', 'JSON pretty', 'YAML', 'TOON best', 'CSV', 'Terset vs JSON compact', 'Terset vs TOON'],
  cost: ['Case', 'Terset', 'JSON compact', 'Terset vs JSON compact'],
};

const PAGE_HEADS: Heads = { bench: BENCH_TABLE_HEAD, cost: COST_TABLE_HEAD };

/**
 * One counter's token table and cost table, with no toggle around them. With a lead note,
 * the note sits above the token table and holds the lossy line, so the note below drops it.
 * The home page passes no lead note and keeps its notes as they were.
 */
export function BenchTables({ counter, heads = PAGE_HEADS, lead }: { readonly counter: Counter; readonly heads?: Heads; readonly lead?: string }) {
  return (
    <>
      {lead === undefined ? null : <p className="tbl-note">{lead}</p>}
      <Table
        label={`Bench table, ${counter.name} tokens, scrolls sideways on small screens`}
        caption={`${counter.name} tokens per case for Terset, compact JSON, pretty JSON, YAML, TOON best variant and plain CSV, with totals`}
        head={heads.bench}
        rows={benchTableRows(counter)}
        totals={benchTotalsRow(counter)}
      />
      <p className="tbl-note">
        {lead === undefined ? 'CSV marked lossy did not read back to the same typed data. ' : null}
        {FITTED_RULES_NOTE} Pretty JSON is in this table only, not in the chart.
      </p>
      <h4 className="tbl-h">Input cost at list price</h4>
      <p className="tbl-note">{costCaption(counter)}</p>
      <Table
        label={`Cost table, ${counter.price.model}, scrolls sideways on small screens`}
        caption={costCaption(counter)}
        head={heads.cost}
        rows={costTableRows(counter)}
        totals={costTotalsRow(counter)}
      />
    </>
  );
}

/** The home page's table toggle. */
export function BenchTable({ counter, open = false }: { readonly counter: Counter; readonly open?: boolean }) {
  return (
    <details className="tbl" open={open}>
      {/* The label follows the open state through CSS, so it is right before hydration too.
          The browser reports the expanded state of a summary on its own. */}
      <summary>
        <span className="tbl-show">{BENCH_TABLE_TOGGLE.show}</span>
        <span className="tbl-hide">{BENCH_TABLE_TOGGLE.hide}</span>
      </summary>
      <BenchTables counter={counter} heads={HOME_HEADS} />
    </details>
  );
}
