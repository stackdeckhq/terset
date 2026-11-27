// The /workload page: answer accuracy and whole-prompt input tokens on two real public files.
// It takes the data as props, so a test can render it from another file and prove that
// every number on the page comes from the data. The route passes the committed files.
// It reuses the /benchmark layout: heading left, text right on wide screens, tables in cards.
import type { ReactNode } from 'react';
import { formatCount } from '../data/bench.ts';
import type { RealData } from '../data/real-data-schema.ts';
import type { RealAccuracyFile } from '../data/real-accuracy-schema.ts';
import { realLines } from '../data/real.ts';
import {
  NO_ANSWER,
  WORKLOAD_MODEL_NAMES,
  WORKLOAD_TABLE_HEAD,
  WRONG_ANSWERS_HEAD,
  fileResults,
  outputCapNotes,
  workloadGroups,
  workloadHeadline,
  workloadLinks,
  workloadMethod,
  workloadPrices,
  wrongAnswerRows,
} from '../data/workload.ts';
import { DocPage } from './DocPage.tsx';

export const WORKLOAD_TITLE = 'Accuracy on real files';

function Text({ children }: { readonly children: ReactNode }) {
  return <div className="bench-text">{children}</div>;
}

function Lines({ lines }: { readonly lines: readonly string[] }) {
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

type Model = RealAccuracyFile['models'][number];

function ModelTable({ file, model }: { readonly file: RealAccuracyFile; readonly model: Model }) {
  const name = WORKLOAD_MODEL_NAMES[model.id];
  return (
    <div className="acc-model">
      <h3>{name}</h3>
      <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={`${name} results table, scrolls sideways on small screens`}>
        <table className="bt bt-work">
          <caption className="sr">{`${name}: correct answers and whole-prompt input tokens per file and format, with the change against compact JSON`}</caption>
          <thead>
            <tr>
              {WORKLOAD_TABLE_HEAD.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          {workloadGroups(file, model).map((group) => (
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

export function WorkloadPage({ file, real }: { readonly file: RealAccuracyFile; readonly real: RealData }) {
  const frozenOn = [...new Set(real.files.map((item) => item.fetched))].join(' and ');
  const wrong = wrongAnswerRows(file);
  const answers = file.questions * file.formats.length * file.models.length;
  const capNotes = outputCapNotes(file);
  return (
    <DocPage
      kicker="Benchmark, real files"
      title={WORKLOAD_TITLE}
      lead={workloadHeadline(file).join(' ')}
      actions={
        <a className="btn btn-line" href="/benchmark">
          Full benchmark
        </a>
      }
    >
      <div className="bench-page work-page">
        <section className="doc-section bench-sec proof-first" id="results" aria-labelledby="res-h">
          <h2 id="res-h">Results by model</h2>
          <Text>
            <p>
              {`Real public files: the USGS earthquake feed for one day and the National Weather Service forecast grid for one square. ${formatCount(file.questions)} questions, ${formatCount(file.formats.length)} formats, ${formatCount(file.models.length)} models.`}
            </p>
          </Text>
          <div className="acc">
            {file.models.map((model) => (
              <ModelTable key={model.id} file={file} model={model} />
            ))}
          </div>
          <p className="tbl-note">Input tokens are summed over every question on that file. Bold marks the fewest input tokens in each group. Minus means fewer tokens than compact JSON.</p>
        </section>

        <section className="doc-section bench-sec" id="by-file" aria-labelledby="file-h">
          <h2 id="file-h">Where Terset saves tokens, and where it does not</h2>
          <Text>
            {fileResults(file).map((result) => (
              <div key={result.dataset} className="work-file">
                <h3>{result.label}</h3>
                <Lines lines={result.lines} />
              </div>
            ))}
            <div className="work-file">
              <h3>The files alone</h3>
              <p>{`Counted with ${real.tokenizer}, with no question and no instructions:`}</p>
              <Lines lines={realLines(real)} />
            </div>
          </Text>
        </section>

        <section className="doc-section bench-sec" id="wrong" aria-labelledby="wrong-h">
          <h2 id="wrong-h">Every wrong answer</h2>
          <Text>
            <p>{`${formatCount(wrong.length)} wrong of ${formatCount(answers)} answers.`}</p>
          </Text>
          <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Wrong answers table, scrolls sideways on small screens">
            <table className="bt bt-wrong">
              <caption className="sr">Every wrong answer: the model, the format, the file, the question, the expected answer and what the model said</caption>
              <thead>
                <tr>
                  {WRONG_ANSWERS_HEAD.map((cell) => (
                    <th key={cell} scope="col">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wrong.map(([model, format, dataset, question, expected, said]) => (
                  <tr key={`${model}-${format}-${question}`}>
                    <td>{model}</td>
                    <td>{format}</td>
                    <td>{dataset}</td>
                    <td className="q">{question}</td>
                    <td>{expected}</td>
                    <td className={said === NO_ANSWER ? 'is-none' : undefined}>{said}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {capNotes.length === 0 ? null : (
            <Text>
              {capNotes.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Text>
          )}
        </section>

        <section className="doc-section bench-sec" id="method" aria-labelledby="method-h">
          <h2 id="method-h">Method</h2>
          <Text>
            <Lines lines={workloadMethod(file, frozenOn)} />
          </Text>
        </section>

        <section className="doc-section bench-sec" id="raw" aria-labelledby="raw-h">
          <h2 id="raw-h">Raw runs and questions</h2>
          <Text>
            <ul className="steps-list work-links">
              {workloadLinks(file).map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
            <div className="work-prices">
              <p className="tbl-note">Tokens are the main unit here. The run reports also give cost at these list prices:</p>
              <ul className="tbl-note">
                {workloadPrices(file).map((price) => (
                  <li key={price.model}>
                    {`${price.model}: ${price.line} `}
                    <a href={price.sourceUrl}>{`${price.model} price page`}</a>
                  </li>
                ))}
              </ul>
            </div>
          </Text>
        </section>
      </div>
    </DocPage>
  );
}
