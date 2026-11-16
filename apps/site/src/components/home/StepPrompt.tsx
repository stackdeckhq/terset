// Step 7: a real prompt. RULES once in the system prompt, the table and the
// question in the user message. The code lines come from the format adapter.
import { Link } from '@tanstack/react-router';
import { formatCount } from '../../data/numbers.ts';
import { IMPORT_LINE, RULES_PLACEMENT, USAGE_LINES } from '../../lib/format.ts';
import { ORDERS_HL, ORDERS_RULES, ORDERS_RULES_TOKENS } from '../../lib/orders.ts';
import { esc } from '../../lib/text.ts';
import { CodeBlock } from '../CodeBlock.tsx';
import { Reveal, Step } from './Step.tsx';

const QUESTION = 'Which orders shipped?';

const MESSAGE_HTML =
  `<span class="blk b-l"><span class="lab">System prompt, once</span>${esc(ORDERS_RULES)}</span>` +
  `<span class="blk b-t"><span class="lab">User message: the table</span><span class="fade-x"><span class="xs" tabindex="0" role="region" aria-label="User message: the table. Scrolls sideways.">${ORDERS_HL}</span></span></span>` +
  `<span class="blk b-q"><span class="lab">Question</span>${esc(QUESTION)}</span>`;

const CODE_TEXT = [IMPORT_LINE, '', ...USAGE_LINES].join('\n');
const CODE_HTML = CODE_TEXT.split('\n')
  .map((line) => esc(line).replace(/(\/\/.*)$/u, '<span class="cm">$1</span>'))
  .join('\n');

const RULES_COUNT = formatCount(ORDERS_RULES_TOKENS);

export function StepPrompt() {
  return (
    <Step id="b7" title="Rules once, then the table.">
      <Reveal className="split r7 vis">
        <div className="composer">
          <div className="code-h">
            <span className="fn">Prompt with the six orders</span>
            <span>Fitted rules: {RULES_COUNT} tokens</span>
          </div>
          <div className="msg" tabIndex={0} aria-label="Example prompt: rules in the system prompt, then the table and the question" dangerouslySetInnerHTML={{ __html: MESSAGE_HTML }} />
          <p className="split-note">{RULES_PLACEMENT}</p>
        </div>
        <div className="side">
          <CodeBlock label="prompt.js" text={CODE_TEXT} html={CODE_HTML} />
          <p className="side-link">
            <Link to="/benchmark">See the method and the limits</Link>
          </p>
        </div>
      </Reveal>
    </Step>
  );
}
