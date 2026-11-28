// The weather file with Terset 1.2: a follow-up to the 400-question sections of /workload, placed
// right after them. It takes the data as a prop, so a test can render it from a changed copy and
// prove that every number comes from the data. Cells and lines are built in data/workload-weather-12.ts.
import type { Weather12AccuracyFile } from '../data/weather-12-accuracy.ts';
import { NO_ANSWER } from '../data/workload.ts';
import {
  WEATHER_12_PAIRED_HEAD,
  WEATHER_12_PAIRED_NOTE,
  WEATHER_12_PAIRED_TITLE,
  WEATHER_12_SCORE_HEAD,
  WEATHER_12_TITLE,
  WEATHER_12_WRONG_HEAD,
  WEATHER_12_WRONG_TITLE,
  weather12Intro,
  weather12Links,
  weather12PairedRows,
  weather12ResultLines,
  weather12ScoreRows,
  weather12WrongRows,
  weather12WrongSummary,
} from '../data/workload-weather-12.ts';
import { Lines, Text } from './WorkloadParts.tsx';

/** The id of the first weather 1.2 section, for links from the format 1.1 results. */
export const WEATHER_12_ANCHOR = 'weather12';

type Row = readonly string[];

/** Consecutive rows that share their first cell, the model, so each model heads its own group. */
function byModel(rows: readonly Row[]): readonly { readonly model: string; readonly rows: readonly Row[] }[] {
  const groups: { model: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const [model = ''] = row;
    const last = groups.at(-1);
    if (last?.model === model) last.rows.push(row);
    else groups.push({ model, rows: [row] });
  }
  return groups;
}

interface GroupedTableProps {
  readonly head: readonly string[];
  readonly rows: readonly Row[];
  readonly label: string;
  readonly caption: string;
}

/** A table whose first column is the model and second the format, each model as one row group. */
function GroupedTable({ head, rows, label, caption }: GroupedTableProps) {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`${label}, scrolls sideways on small screens`}>
      <table className="bt bt-work">
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
        {byModel(rows).map((group) => (
          <tbody key={group.model}>
            {group.rows.map(([, format = '', ...cells], index) => (
              <tr key={format}>
                {index === 0 ? (
                  <th scope="rowgroup" rowSpan={group.rows.length} className="grp-l">
                    {group.model}
                  </th>
                ) : null}
                <th scope="row" className="fmt">
                  {format}
                </th>
                {cells.map((cell, cellIndex) => (
                  <td key={head[cellIndex + 2]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function WrongTable({ file }: { readonly file: Weather12AccuracyFile }) {
  const rows = weather12WrongRows(file);
  if (rows.length === 0) return null;
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Terset 1.2 wrong answers table, scrolls sideways on small screens">
      <table className="bt bt-wrong">
        <caption className="sr">{'Every wrong Terset 1.2 answer on the weather file: the model, the question, the expected answer and what the model said'}</caption>
        <thead>
          <tr>
            {WEATHER_12_WRONG_HEAD.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([model, question, expected, said]) => (
            <tr key={`${model}-${question}`}>
              <td>{model}</td>
              <td className="q">{question}</td>
              <td>{expected}</td>
              <td className={said === NO_ANSWER ? 'is-none' : 'said'}>{said}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Weather12Sections({ file }: { readonly file: Weather12AccuracyFile }) {
  return (
    <>
      <section className="doc-section bench-sec" id={WEATHER_12_ANCHOR} aria-labelledby="weather12-h">
        <h2 id="weather12-h">{WEATHER_12_TITLE}</h2>
        <Text>
          {weather12ResultLines(file).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="work-file">
            <h3>How it ran</h3>
            <Lines lines={weather12Intro(file)} />
          </div>
        </Text>
        <GroupedTable
          head={WEATHER_12_SCORE_HEAD}
          rows={weather12ScoreRows(file)}
          label="Weather file scores table"
          caption="For each model on the weather file: correct answers and whole-prompt input tokens in compact JSON, TOON, Terset 1.1 and Terset 1.2"
        />
        <p className="tbl-note">Input tokens are summed over every weather question.</p>
      </section>

      <section className="doc-section bench-sec" id="weather12-paired" aria-labelledby="weather12-paired-h">
        <h2 id="weather12-paired-h">{WEATHER_12_PAIRED_TITLE}</h2>
        <Text>
          <p>{WEATHER_12_PAIRED_NOTE}</p>
        </Text>
        <GroupedTable
          head={WEATHER_12_PAIRED_HEAD}
          rows={weather12PairedRows(file)}
          label="Terset 1.2 paired comparison table"
          caption="For each model, Terset 1.2 against each other format on the same weather questions: how many only Terset 1.2 got right, how many only the other got right, the input token change, the gap in percentage points, its 95% interval and the exact McNemar p value"
        />
      </section>

      <section className="doc-section bench-sec" id="weather12-wrong" aria-labelledby="weather12-wrong-h">
        <h2 id="weather12-wrong-h">{WEATHER_12_WRONG_TITLE}</h2>
        <Text>
          <p>{weather12WrongSummary(file)}</p>
        </Text>
        <WrongTable file={file} />
        <Text>
          <ul className="steps-list work-links">
            {weather12Links(file).map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </Text>
      </section>
    </>
  );
}
