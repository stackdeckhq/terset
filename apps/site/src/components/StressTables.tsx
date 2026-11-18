// The stress test in two cards, like the accuracy tables: every format's score and input
// tokens on each model with the run reports, then one table per group for the fold.
// Terset first, the fewest input tokens marked, scores never marked. Each table scrolls
// sideways inside its own box on small screens.
import { inline } from '../lib/markdown.ts';
import {
  STRESS_DAMAGE_NOTE,
  STRESS_QUOTED_NOTE,
  STRESS_FIELD_LABELS,
  STRESS_GROUP_LABELS,
  stressColumns,
  stressGroupRows,
  stressGroups,
  stressHeadlineNote,
  stressReportsLine,
  stressTableMarks,
  stressTableRows,
} from '../data/stress.ts';
import type { StressAccuracyFile, StressGroup } from '../data/stress.ts';

function HeadlineTable({ file }: { readonly file: StressAccuracyFile }) {
  const columns = stressColumns(file);
  const marks = stressTableMarks(file);
  return (
    <div className="acc-model">
      <h3>{`All ${String(file.questions)} questions`}</h3>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Stress test table, scrolls sideways on small screens">
        <table className="bt bt-kind">
          <caption className="sr">{`Stress test: correct answers out of ${String(file.questions)} and input tokens per format and model, one run each`}</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Format
              </th>
              {file.models.map((model) => (
                <th key={model.id} scope="colgroup" colSpan={2} className="grp">
                  {model.name}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map(({ model, field }) => (
                <th key={`${model.id}-${field}`} scope="col" className={field === 'correct' ? 'grp-start' : undefined}>
                  {STRESS_FIELD_LABELS[field]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stressTableRows(file).map(([name, ...cells], rowIndex) => (
              <tr key={name} className={name === 'Terset' ? 'is-terset' : undefined}>
                <th scope="row">{name}</th>
                {cells.map((cell, index) => {
                  const column = columns[index];
                  const classes = [column?.field === 'correct' ? 'grp-start' : '', marks[rowIndex]?.[index] ?? ''].filter(Boolean).join(' ');
                  return (
                    <td key={column === undefined ? index : `${column.model.id}-${column.field}`} className={classes === '' ? undefined : classes}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tbl-note">{stressHeadlineNote(file)}</p>
      <p className="tbl-note">{STRESS_QUOTED_NOTE}</p>
    </div>
  );
}

function GroupTable({ file, group }: { readonly file: StressAccuracyFile; readonly group: StressGroup }) {
  const { label, tests } = STRESS_GROUP_LABELS[group];
  return (
    <div className="acc-model">
      <h3>{label}</h3>
      <p className="tbl-note">{tests}</p>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`Stress test, ${label}, scrolls sideways on small screens`}>
        <table className="bt">
          <caption className="sr">{`Stress test, ${label}: correct answers per format and model, one run each`}</caption>
          <thead>
            <tr>
              <th scope="col">Format</th>
              {file.models.map((model) => (
                <th key={model.id} scope="col">
                  {model.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stressGroupRows(file, group).map(([name, ...cells]) => (
              <tr key={name} className={name === 'Terset' ? 'is-terset' : undefined}>
                <th scope="row">{name}</th>
                {cells.map((cell, index) => (
                  <td key={file.models[index]?.id ?? index}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {group === 'damage' ? <p className="tbl-note">{STRESS_DAMAGE_NOTE}</p> : null}
    </div>
  );
}

/** The open card: all questions per format and model, then the links to each run report. */
export function StressHeadline({ file }: { readonly file: StressAccuracyFile }) {
  return (
    <div className="acc">
      <HeadlineTable file={file} />
      <p className="tbl-note" dangerouslySetInnerHTML={{ __html: inline(stressReportsLine(file)) }} />
    </div>
  );
}

/** The folded card: one table per group, with the damage group's notes. */
export function StressGroupTables({ file }: { readonly file: StressAccuracyFile }) {
  return (
    <div className="acc">
      {stressGroups(file).map((group) => (
        <GroupTable key={group} file={file} group={group} />
      ))}
    </div>
  );
}
