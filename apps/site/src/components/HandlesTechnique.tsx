// The short-handles technique: swap long ids for 1, 2, 3 before the prompt,
// map them back after. A site demo, not a package export. The measured
// answer counts and their limits sit right under it.
import { DEMO_ANSWER, DEMO_ROWS, HANDLES_DEMO_SOURCE, fromHandles, toHandles } from '../lib/handles-demo.ts';
import { NAMES_KEPT, QUALITY_ARMS, QUALITY_FAIRNESS, QUALITY_LIMITS, RUNS_PER_ARM } from '../data/quality.ts';
import { CodeBlock } from './CodeBlock.tsx';

const HANDLED = toHandles(DEMO_ROWS);
const MAPPED = fromHandles(DEMO_ANSWER, HANDLED.back);

function DemoTable() {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Long ids and their short handles, scrolls sideways on small screens">
      <table className="bt hd-demo">
        <caption className="sr">Each long id and the short handle the prompt uses instead</caption>
        <thead>
          <tr>
            <th scope="col">Handle in the prompt</th>
            <th scope="col">Real id, kept in your code</th>
            <th scope="col">Name</th>
          </tr>
        </thead>
        <tbody>
          {HANDLED.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.id}</th>
              <td>
                <code>{HANDLED.back.get(row.id)}</code>
              </td>
              <td>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Answer() {
  return (
    <ul className="steps-list hd-answer">
      <li>
        <b>The model answers:</b> <code>{JSON.stringify(DEMO_ANSWER)}</code>
      </li>
      <li>
        <b>Mapped back:</b>{' '}
        {MAPPED.ids.map((id) => (
          <code key={id}>{id}</code>
        ))}
      </li>
      <li>
        <b>Not in the input:</b> <code>{MAPPED.unknown.join(', ')}</code>. Report it or ask again. Never guess.
      </li>
    </ul>
  );
}

function Results() {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label="Accepted runs per arm, scrolls sideways on small screens">
      <table className="bt">
        <caption className="sr">Accepted runs out of {RUNS_PER_ARM} for each arm</caption>
        <thead>
          <tr>
            <th scope="col">Arm</th>
            <th scope="col">Accepted, of {RUNS_PER_ARM}</th>
            <th scope="col">Failed on a wrong id</th>
          </tr>
        </thead>
        <tbody>
          {QUALITY_ARMS.map((arm) => (
            <tr key={arm.label}>
              <th scope="row">{arm.label}</th>
              <td>{arm.accepted}</td>
              <td>{arm.wrongId ?? 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HandlesTechnique() {
  return (
    <section className="doc-section handles" aria-labelledby="handles-h">
      <h2 id="handles-h">Technique: short handles</h2>
      <p>
        Long ids are easy for a model to copy wrong. Before the prompt, swap each one for 1, 2, 3. After the answer, map the handles back and flag any the input never had. This is a
        technique your code applies. It is not part of the package.
      </p>
      <DemoTable />
      <Answer />
      <CodeBlock label="handles.js, a demo to adapt" text={HANDLES_DEMO_SOURCE} />
      <h3>Measured result</h3>
      <p>A file-organizing task with 30 to 100 items. Accepted answers out of {RUNS_PER_ARM} runs per arm:</p>
      <Results />
      <ul className="steps-list">
        <li>
          Repair means your code fixes small, safe slips in the answer by fixed, deterministic rules before it checks it. It does not ask the model again. Names with hard characters came back byte for byte: {NAMES_KEPT.kept} of {NAMES_KEPT.of}.
        </li>
        <li>{QUALITY_FAIRNESS}</li>
        <li>
          <b>Limits.</b> {QUALITY_LIMITS}
        </li>
      </ul>
    </section>
  );
}
