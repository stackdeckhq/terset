// Parts the /workload sections share: the text column, a short list, and one model's table
// of correct answers and input tokens, grouped by file. Each takes ready-made cells from
// workload.ts, so no number is worked out here.
import type { ReactNode } from 'react';
import type { WorkloadGroup } from '../data/workload.ts';
import { WORKLOAD_TABLE_HEAD } from '../data/workload.ts';

export function Text({ children }: { readonly children: ReactNode }) {
  return <div className="bench-text">{children}</div>;
}

export function Lines({ lines }: { readonly lines: readonly string[] }) {
  return (
    <ul className="steps-list">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

/** The mark for a change cell: fewer tokens than compact JSON in the accent tone, more plain and muted. The sign says it too. */
function changeMark(cell: string): string | undefined {
  if (cell.startsWith('−')) return 'is-less';
  if (cell.startsWith('+')) return 'is-more';
  return undefined;
}

export interface ModelTableProps {
  /** The model's name, shown as the table's heading. */
  readonly name: string;
  /** The short name of the table's scroll box, such as "Claude Opus 5.5 results table". */
  readonly label: string;
  /** The screen reader caption: what the table holds. */
  readonly caption: string;
  readonly groups: readonly WorkloadGroup[];
}

export function ModelTable({ name, label, caption, groups }: ModelTableProps) {
  return (
    <div className="acc-model">
      <h3>{name}</h3>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`${label}, scrolls sideways on small screens`}>
        <table className="bt bt-work">
          <caption className="sr">{caption}</caption>
          <thead>
            <tr>
              {WORKLOAD_TABLE_HEAD.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.dataset} className={group.dataset === 'ALL' ? 'is-total' : undefined}>
              {group.rows.map((row, index) => (
                <tr key={row.format} className={row.format === 'terset' ? 'is-terset' : undefined}>
                  {index === 0 ? (
                    <th scope="rowgroup" rowSpan={group.rows.length} className="grp-l">
                      {group.label}
                    </th>
                  ) : null}
                  <th scope="row" className="fmt">
                    {row.label}
                  </th>
                  <td>{row.correct}</td>
                  <td className={row.lowest ? 'is-less' : undefined}>
                    {row.inputTokens}
                    {row.lowest ? <span className="sr"> (fewest)</span> : null}
                  </td>
                  <td className={changeMark(row.change)}>{row.change}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
