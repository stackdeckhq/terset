// The 400-question sections of /workload, placed after the 40-question run on the same files.
// It takes the data as a prop, so a test can render it from a changed copy and prove that every
// number comes from the data. Cells and lines are built in data/workload-400.ts.
import { formatCount } from '../data/bench.ts';
import type { Real400AccuracyFile } from '../data/real-400-accuracy-schema.ts';
import { NO_ANSWER, WORKLOAD_MODEL_NAMES, fileResults, workloadGroups } from '../data/workload.ts';
import {
  PAIRED_HEAD,
  WRONG_400_HEAD,
  kindHead,
  kindTable,
  pairedGroups,
  pairedReading,
  real400Headline,
  real400Intro,
  real400Links,
  real400RunNotes,
  real400StrictNote,
  real400WrongSummary,
  wrong400Groups,
} from '../data/workload-400.ts';
import type { Weather12AccuracyFile } from '../data/weather-12-accuracy.ts';
import { WEATHER_12_POINTER_LINK, weather12Pointer } from '../data/workload-weather-12.ts';
import { Fold } from './Fold.tsx';
import { Lines, ModelTable, Text } from './WorkloadParts.tsx';
import { WEATHER_12_ANCHOR } from './WorkloadWeather12.tsx';

type Model = Real400AccuracyFile['models'][number];

/** The id of the first 400-question section, for links from the top of the page. */
export const REAL_400_ANCHOR = 'q400';

function KindTable({ file, model }: { readonly file: Real400AccuracyFile; readonly model: Model }) {
  const name = WORKLOAD_MODEL_NAMES[model.id];
  const table = kindTable(file, model);
  return (
    <div className="acc-model">
      <h3>{name}</h3>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`${name} wrong answers by kind, scrolls sideways on small screens`}>
        <table className="bt bt-kind">
          <caption className="sr">{`${name}: wrong answers of ${formatCount(file.questions)} by question kind and format`}</caption>
          <thead>
            <tr>
              {kindHead(file).map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.kind}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td key={file.formats[index]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">All kinds</th>
              {table.total.map((cell, index) => (
                <td key={file.formats[index]}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PairedTable({ file }: { readonly file: Real400AccuracyFile }) {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Paired comparison table, scrolls sideways on small screens">
      <table className="bt bt-work bt-pair">
        <caption className="sr">{`For each model, Terset against each other format on the same ${formatCount(file.questions)} questions: how many only Terset got right, how many only the other format got right, the gap in percentage points, its 95% interval and the exact McNemar p value`}</caption>
        <thead>
          <tr>
            {PAIRED_HEAD.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        {pairedGroups(file).map((group) => (
          <tbody key={group.id}>
            {group.rows.map((row, index) => (
              <tr key={row.comparison}>
                {index === 0 ? (
                  <th scope="rowgroup" rowSpan={group.rows.length} className="grp-l">
                    {group.model}
                  </th>
                ) : null}
                <th scope="row" className="fmt">
                  {row.comparison}
                </th>
                <td>{row.tersetOnly}</td>
                <td>{row.otherOnly}</td>
                <td>{row.gap}</td>
                <td>{row.interval}</td>
                <td>{row.p}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function WrongFolds({ file }: { readonly file: Real400AccuracyFile }) {
  return wrong400Groups(file).map((group) => (
    <Fold key={group.id} title={`${group.model}: every wrong answer`} about={`${formatCount(group.rows.length)} wrong answers, each with the question, the expected answer and what the model said.`}>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`${group.model} wrong answers table, scrolls sideways on small screens`}>
        <table className="bt bt-wrong">
          <caption className="sr">{`Every wrong answer from ${group.model}: the format, the file, the question kind, the question, the expected answer and what the model said`}</caption>
          <thead>
            <tr>
              {WRONG_400_HEAD.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map(([format, dataset, kind, question, expected, said]) => (
              <tr key={`${format}-${question}`}>
                <td>{format}</td>
                <td>{dataset}</td>
                <td>{kind}</td>
                <td className="q">{question}</td>
                <td>{expected}</td>
                <td className={said === NO_ANSWER ? 'is-none' : 'said'}>{said}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Fold>
  ));
}

/** These runs used Terset 1.1. On the weather file, 1.2 changed the result, so this links to that run. */
function Weather12Pointer({ file }: { readonly file: Weather12AccuracyFile }) {
  return (
    <p>
      {`${weather12Pointer(file)} `}
      <a href={`#${WEATHER_12_ANCHOR}`}>{WEATHER_12_POINTER_LINK}</a>
    </p>
  );
}

export interface Real400SectionsProps {
  readonly file: Real400AccuracyFile;
  /** The weather file again with Terset 1.2, which the weather results here point to. */
  readonly weather12: Weather12AccuracyFile;
}

export function Real400Sections({ file, weather12 }: Real400SectionsProps) {
  const run = `${formatCount(file.questions)} questions`;
  const strictNote = real400StrictNote(file);
  return (
    <>
      <section className="doc-section bench-sec" id={REAL_400_ANCHOR} aria-labelledby="q400-h">
        <h2 id="q400-h">{`${run} on the same files`}</h2>
        <Text>
          {real400Headline(file).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Weather12Pointer file={weather12} />
          <div className="work-file">
            <h3>How it ran</h3>
            <Lines lines={real400Intro(file)} />
          </div>
        </Text>
        <div className="acc">
          {file.models.map((model) => {
            const name = WORKLOAD_MODEL_NAMES[model.id];
            return (
              <ModelTable
                key={model.id}
                name={name}
                label={`${name} ${run} totals table`}
                caption={`${name}, ${run}: correct answers and whole-prompt input tokens per format, both files together, with the change against compact JSON`}
                groups={workloadGroups(file, model).filter((group) => group.dataset === 'ALL')}
              />
            );
          })}
        </div>
        <p className="tbl-note">Input tokens are summed over every question on both files. Bold marks the fewest input tokens. Minus means fewer tokens than compact JSON.</p>
      </section>

      <section className="doc-section bench-sec" id="q400-paired" aria-labelledby="q400-paired-h">
        <h2 id="q400-paired-h">The same question in two formats</h2>
        <Text>
          {pairedReading(file).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Text>
        <PairedTable file={file} />
      </section>

      <section className="doc-section bench-sec" id="q400-files" aria-labelledby="q400-files-h">
        <h2 id="q400-files-h">{`${run}, file by file`}</h2>
        <Text>
          {fileResults(file).map((result) => (
            <div key={result.dataset} className="work-file">
              <h3>{result.label}</h3>
              <Lines lines={result.lines} />
              {result.dataset === weather12.dataset ? <Weather12Pointer file={weather12} /> : null}
            </div>
          ))}
        </Text>
        <div className="acc">
          {file.models.map((model) => {
            const name = WORKLOAD_MODEL_NAMES[model.id];
            return (
              <ModelTable
                key={model.id}
                name={name}
                label={`${name} ${run} per file table`}
                caption={`${name}, ${run}: correct answers and whole-prompt input tokens per file and format, with the change against compact JSON`}
                groups={workloadGroups(file, model).filter((group) => group.dataset !== 'ALL')}
              />
            );
          })}
        </div>
        <p className="tbl-note">Input tokens are summed over every question on that file. Bold marks the fewest input tokens in each group. Minus means fewer tokens than compact JSON.</p>
      </section>

      <section className="doc-section bench-sec" id="q400-wrong" aria-labelledby="q400-wrong-h">
        <h2 id="q400-wrong-h">{`${run}: wrong answers`}</h2>
        <Text>
          <p>{real400WrongSummary(file)}</p>
          {strictNote === null ? null : <p>{strictNote}</p>}
        </Text>
        <div className="acc">
          {file.models.map((model) => (
            <KindTable key={model.id} file={file} model={model} />
          ))}
        </div>
        <div className="work-folds">
          <WrongFolds file={file} />
        </div>
      </section>

      <section className="doc-section bench-sec" id="q400-runs" aria-labelledby="q400-runs-h">
        <h2 id="q400-runs-h">{`${run}: run notes and files`}</h2>
        <Text>
          <Lines lines={real400RunNotes(file)} />
          <ul className="steps-list work-links">
            {real400Links(file).map((link) => (
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
