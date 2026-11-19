// Step 4: four uneven rows, each shown as JSON and as its real Terset row.
// Rows are found by id, and cells by column or by their name=value name.
import type { CSSProperties, ReactNode } from 'react';
import { namedCell } from '../../lib/format.ts';
import { ORDERS_LINES, ORDERS_TABLE, ORDERS_TOON, TOON_SHAPE } from '../../lib/orders.ts';
import { Reveal, Step } from './Step.tsx';

interface UnevenCase {
  readonly mark: string;
  readonly title: string;
  readonly json: ReactNode;
  readonly id: string;
  readonly field: string;
}

function rowIndex(id: string): number {
  const index = ORDERS_TABLE.rows.findIndex((row) => row[0] === id);
  if (index < 0) throw new Error(`No row ${id} in the orders table`);
  return index;
}

/** A field's cell in a row: its column, or its name=value cell. -1 when the row lacks the field. */
function cellIndex(parts: readonly string[], field: string): number {
  const column = ORDERS_TABLE.fields.indexOf(field);
  if (column >= 0) return column;
  return parts.findIndex((text, i) => i >= ORDERS_TABLE.fields.length && namedCell(text)?.name === field);
}

function TersetRow({ id, field }: { readonly id: string; readonly field: string }) {
  const parts = ORDERS_TABLE.rows[rowIndex(id)] ?? [];
  const cell = cellIndex(parts, field);
  return (
    <p className="t">
      {parts.map((text, i) => {
        const body = i === cell ? <em>{text}</em> : text;
        // A cell never breaks inside (a SKU like "C-310" would split at its hyphen);
        // the row wraps only at the break chance after each tab mark.
        return (
          <span key={i}>
            <span className="cell">{body}</span>
            {i < parts.length - 1 ? (
              <>
                <span className="tb" aria-hidden="true" />
                <wbr />
              </>
            ) : null}
          </span>
        );
      })}
    </p>
  );
}

function arrow(id: string, field: string): string {
  const row = rowIndex(id);
  const found = cellIndex(ORDERS_TABLE.rows[row] ?? [], field) >= 0;
  return `Row ${String(row + 1)}, ${found ? '' : 'no '}${field} cell`;
}

const K = ({ children }: { readonly children: string }) => <span className="k">&quot;{children}&quot;</span>;

const CASES: readonly UnevenCase[] = [
  { mark: 'A', title: 'No zip for Osaka', json: <><K>ship</K>: <em>{'{"city": "Osaka"}'}</em></>, id: 'ORD-20003', field: 'ship' },
  { mark: 'B', title: 'Ship is null', json: <><K>ship</K>: <em>null</em>, <K>lines</K>: []</>, id: 'ORD-20004', field: 'ship' },
  { mark: 'C', title: 'No ship key at all', json: <><K>status</K>: &quot;paid&quot;, <em>no &quot;ship&quot;</em>, <K>lines</K>: […]</>, id: 'ORD-20005', field: 'ship' },
  { mark: 'D', title: 'A note on one order only', json: <><K>total</K>: 39.9, <em><K>note</K>: &quot;Gift wrap&quot;</em></>, id: 'ORD-20003', field: 'note' },
];

const TERSET_LENGTHS = ORDERS_LINES.map((line) => line.length);
const TOON_LINES = ORDERS_TOON.split('\n').length;
const MAX_CHARS = Math.max(...TERSET_LENGTHS, ...TOON_SHAPE.map(([indent, width]) => indent + width));
const share = (n: number): string => `${((n / MAX_CHARS) * 100).toFixed(2)}%`;
const lineStyle = (i: number, width: number, indent = 0): CSSProperties => ({ '--i': i, marginLeft: share(indent), width: share(width) }) as CSSProperties;

export function StepCases() {
  return (
    <Step id="b4" title="Real rows are messy. The table holds them.">
      <div className="vis">
        <Reveal className="cases">
          {CASES.map((item) => (
            <article key={item.mark} className="case">
              <h3>
                <i>{item.mark}</i>
                {item.title}
              </h3>
              <p className="j">{item.json}</p>
              <p className="arrow">{arrow(item.id, item.field)}</p>
              <TersetRow id={item.id} field={item.field} />
            </article>
          ))}
        </Reveal>
        <Reveal className="lines-vs" mode="pre">
          <div className="lv toon">
            <b>{TOON_LINES}</b>
            <span>lines as TOON</span>
            <div className="sil" aria-hidden="true">
              {TOON_SHAPE.map(([indent, width], i) => (
                <i key={i} style={lineStyle(i, width, indent)} />
              ))}
            </div>
          </div>
          <div className="lv ter">
            <b>{ORDERS_LINES.length}</b>
            <span>lines as Terset</span>
            <div className="sil" aria-hidden="true">
              {TERSET_LENGTHS.map((width, i) => (
                <i key={i} style={lineStyle(i, width)} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </Step>
  );
}
