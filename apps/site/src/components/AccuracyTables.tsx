// Answer accuracy per model: one table each, Terset first, then how much more each format cost than Terset.
// Then one table by data set: Terset input tokens against compact JSON and TOON.
// Each table scrolls sideways inside its own box on small screens, never the page.
import { ACCURACY_FORMAT_NOTE, ACCURACY_KIND_NOTE, ACCURACY_TABLE_HEAD, KIND_BASE_LABELS, KIND_BASES, accuracyRunsNote, accuracyTableMarks, accuracyTableRows, kindColumns, kindTableRows, shortModelName, signMark } from '../data/accuracy.ts';
import type { AccuracyFile, AccuracyModel } from '../data/accuracy.ts';

function KindTable({ file }: { readonly file: AccuracyFile }) {
  const columns = kindColumns(file);
  return (
    <div className="acc-model">
      <h3>By data set</h3>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Input tokens by data set, scrolls sideways on small screens">
        <table className="bt bt-kind">
          <caption className="sr">{`Terset input tokens against compact JSON and against TOON, per data set and model. Minus means Terset used fewer tokens.`}</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Data
              </th>
              <th scope="col" rowSpan={2}>
                Questions
              </th>
              {KIND_BASES.map((base) => (
                <th key={base} scope="colgroup" colSpan={file.models.length} className="grp">
                  {KIND_BASE_LABELS[base]}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map(({ base, model }, index) => (
                <th key={`${base}-${model.id}`} scope="col" className={index % file.models.length === 0 ? 'grp-start' : undefined}>
                  {shortModelName(model)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kindTableRows(file).map(([label, questions, ...cells]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{questions}</td>
                {cells.map((cell, index) => {
                  const column = columns[index];
                  const classes = [index % file.models.length === 0 ? 'grp-start' : '', signMark(cell) ?? ''].filter(Boolean).join(' ');
                  return (
                    <td key={column === undefined ? index : `${column.base}-${column.model.id}`} className={classes === '' ? undefined : classes}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tbl-note">{ACCURACY_KIND_NOTE}</p>
    </div>
  );
}

/** One model's table. The lowest input tokens and cost are marked like the kind table, and so is every format Terset cost less than. */
function ModelTable({ file, model }: { readonly file: AccuracyFile; readonly model: AccuracyModel }) {
  const marks = accuracyTableMarks(model);
  return (
    <div className="acc-model">
      <h3>{model.name}</h3>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`Accuracy table, ${model.name}, scrolls sideways on small screens`}>
        <table className="bt">
          <caption className="sr">{`${model.name}: correct answers out of ${String(file.questions)}, the runs behind them, accuracy, Wilson 95% interval, input tokens and cost at API list price per format, with how much more each format cost than Terset`}</caption>
          <thead>
            <tr>
              {ACCURACY_TABLE_HEAD.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accuracyTableRows(model).map(([name, ...cells], rowIndex) => (
              <tr key={name} className={name === 'Terset' ? 'is-terset' : undefined}>
                <th scope="row">{name}</th>
                {cells.map((cell, index) => (
                  <td key={ACCURACY_TABLE_HEAD[index + 1]} className={marks[rowIndex]?.[index] ?? undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tbl-note">
        {model.name} at ${model.inputPerMillion} per million input tokens and ${model.outputPerMillion} per million output tokens, list price read on {model.priceReadOn}.
      </p>
    </div>
  );
}

export function AccuracyTables({ file }: { readonly file: AccuracyFile }) {
  return (
    <div className="acc">
      {file.models.map((model) => (
        <ModelTable key={model.id} file={file} model={model} />
      ))}
      <p className="tbl-note">{ACCURACY_FORMAT_NOTE}</p>
      <p className="tbl-note">{accuracyRunsNote(file)}</p>
      <KindTable file={file} />
    </div>
  );
}
