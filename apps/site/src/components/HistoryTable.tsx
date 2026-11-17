// The number history as one table: each published number that moved, why, and the
// public PR. The same rows as benchmark.md, with one change per line. Its text cells
// wrap; on small screens the table scrolls sideways inside its own box.
import { HISTORY, HISTORY_TABLE_HEAD, historyChangeLines, prLabel, prUrl } from '../data/history.ts';
import { inline } from '../lib/markdown.ts';

export function HistoryTable() {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Number history table, scrolls sideways on small screens">
      <table className="bt bt-text">
        <caption className="sr">Every published number that moved, newest first, with the old and new value, the reason and the public PR</caption>
        <thead>
          <tr>
            {HISTORY_TABLE_HEAD.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HISTORY.map((row) => {
            const lines = historyChangeLines(row);
            const url = prUrl(row.pr);
            return (
              <tr key={lines.join(' ')}>
                <th scope="row">{row.date}</th>
                <td>
                  {lines.map((line) => (
                    <span key={line} className="bt-line">
                      {line}
                    </span>
                  ))}
                </td>
                <td dangerouslySetInnerHTML={{ __html: inline(row.why) }} />
                <td>{url === null ? prLabel(row.pr) : <a href={url}>{prLabel(row.pr)}</a>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
