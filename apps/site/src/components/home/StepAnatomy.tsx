// Step 3: the marks that carry the table's structure. The marks and their
// samples come from the format adapter, so this step follows the format.
// The six orders hold no quoted text, so a small generated example shows that mark.
import { GENERATED } from '../../data/generated.ts';
import { MARKS, highlight } from '../../lib/format.ts';
import type { MarkId } from '../../lib/format.ts';
import { ORDERS_TERSET } from '../../lib/orders.ts';
import { Reveal, Step } from './Step.tsx';

const QUOTED_MARKS: readonly MarkId[] = ['qt'];
const ORDER_MARKS: readonly MarkId[] = MARKS.map((mark) => mark.id).filter((id) => !QUOTED_MARKS.includes(id));
export const ANATOMY_HTML = highlight(ORDERS_TERSET, { marks: ORDER_MARKS, align: true });
const USERS_TERSET = GENERATED.docExamples.users.terset;
export const USERS_HTML = highlight(USERS_TERSET, { marks: QUOTED_MARKS, align: true });
if (!USERS_HTML.includes('mk qt')) throw new Error('The users example no longer has a quoted text cell');

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TITLE = `${COUNT_WORDS[MARKS.length] ?? String(MARKS.length)} marks carry all the structure.`;

export function StepAnatomy() {
  return (
    <Step id="b3" title={TITLE}>
      <Reveal className="vis">
        <div className="code anat">
          <div className="code-h">
            <span className="fn">The six orders, as the model reads them</span>
          </div>
          <div className="fade-x">
            <pre className="xs" tabIndex={0} role="region" aria-label={`The six orders as a Terset table, with ${String(ORDER_MARKS.length)} numbered marks`} dangerouslySetInnerHTML={{ __html: ANATOMY_HTML }} />
          </div>
        </div>
        <div className="code anat">
          <div className="code-h">
            <span className="fn">A user named 42</span>
          </div>
          <div className="fade-x">
            <pre className="xs" tabIndex={0} role="region" aria-label="A small users table where the name 42 is written as quoted text" dangerouslySetInnerHTML={{ __html: USERS_HTML }} />
          </div>
        </div>
        <ol className="keys">
          {MARKS.map((mark) => (
            <li key={mark.id}>
              <code>
                <i>{mark.n}</i>
                {mark.sample === '' ? (
                  <>
                    <span className="ab" />
                    &nbsp;empty cell
                  </>
                ) : (
                  <span className={mark.sampleClass}>{mark.sample}</span>
                )}
              </code>
              {mark.about}
            </li>
          ))}
        </ol>
      </Reveal>
    </Step>
  );
}
