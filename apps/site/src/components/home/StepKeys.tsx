// Step 1: JSON writes every key on every row. Terset writes each field name
// once in the header. Keys inside nested JSON cells still repeat, and the
// tally counts them honestly.
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { highlight } from '../../lib/format.ts';
import { useReveal } from '../../lib/motion.ts';
import { ORDERS_COUNT, ORDERS_TABLE, ORDERS_TALLY } from '../../lib/orders.ts';
import { Reveal, Step } from './Step.tsx';

const HEADER_HTML = highlight(ORDERS_TABLE.fields.join('\t')).split('\n')[0] ?? '';
const JSON_TOTAL = ORDERS_TALLY.reduce((sum, row) => sum + row.json, 0);
const TERSET_TOTAL = ORDERS_TALLY.reduce((sum, row) => sum + row.terset, 0);

/** Each row's blocks pop in together, one row after another, so the whole tally is drawn in well under a second. */
function rowStyle(row: number): CSSProperties {
  return { '--i': row } as CSSProperties;
}

function Blocks({ count, terset }: { readonly count: number; readonly terset: boolean }) {
  return (
    <span className={terset ? 'blk t' : 'blk'} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function Tally() {
  const ref = useRef<HTMLTableElement>(null);
  const shown = useReveal(ref);
  return (
    <div className="tally-wrap">
      <table className={shown ? 'tally in' : 'tally pre'} ref={ref}>
        <caption className="sr">How often each key name is written, as JSON and as Terset</caption>
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col" colSpan={2}>
              Written in JSON
            </th>
            <th scope="col" colSpan={2}>
              In Terset
            </th>
          </tr>
        </thead>
        <tbody>
          {ORDERS_TALLY.map((row, index) => (
            <tr key={row.key} style={rowStyle(index)}>
              <td>{row.key}</td>
              <td className="n">{row.json}</td>
              <td>
                <Blocks count={row.json} terset={false} />
              </td>
              <td className="n">{row.terset}</td>
              <td>
                <Blocks count={row.terset} terset />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="n">{JSON_TOTAL}</td>
            <td />
            <td className="n">{TERSET_TOTAL}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function StepKeys() {
  return (
    <Step id="b1" title="JSON repeats every key on every row.">
      <Reveal className="vis s1">
        <div className="s1-tot">
          <div className="tot">
            <b>{JSON_TOTAL}</b>
            <span>key names in the {ORDERS_COUNT} orders as JSON</span>
          </div>
          <div className="tot best">
            <b>{TERSET_TOTAL}</b>
            <span>key names in the same orders as Terset</span>
          </div>
        </div>
        <p className="s1-head">
          <small>The {ORDERS_TABLE.fields.length} field names, written once</small>
          <span dangerouslySetInnerHTML={{ __html: HEADER_HTML }} />
        </p>
        <details className="more">
          <summary>Count each key</summary>
          <Tally />
          <p className="s1-note">Uniform nested objects use dotted columns. JSON cell keys repeat and count here.</p>
        </details>
      </Reveal>
    </Step>
  );
}
