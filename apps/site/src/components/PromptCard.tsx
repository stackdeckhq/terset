// The agent prompt card, shared by home step 8 and /agents: a title, who it is
// for, the prompt as wrapping prose with its URLs and command marked, its size
// in tokens and one strong copy button.
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatCount } from '../data/numbers.ts';
import { AGENT_PROMPT, AGENT_PROMPT_FOR, AGENT_PROMPT_TITLE, INSTALL_COMMANDS } from '../data/site.ts';
import { SIZES } from '../data/sizes.ts';
import { CopyButton } from './CopyButton.tsx';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^$()|[\]\\{}/]/gu, '\\$&');
const URL_PATTERN = String.raw`https://\S+?(?=[.,]?(?:\s|$))`;
/** A URL, minus a closing period, or the install command. The capture group keeps them in split(). */
const MARKS = new RegExp(`(${URL_PATTERN}|${escapeRegExp(INSTALL_COMMANDS.pnpm)})`, 'u');

function marked(line: string): ReactNode[] {
  return line.split(MARKS).map((part, i) => {
    if (i % 2 === 0) return part;
    return part.startsWith('https://') ? (
      <span key={part} className="url">
        {part}
      </span>
    ) : (
      <code key={part}>{part}</code>
    );
  });
}

const LINES = AGENT_PROMPT.split('\n');

export interface PromptCardProps {
  /** The heading level that fits the page outline. */
  readonly level?: 2 | 3;
}

export function PromptCard({ level = 3 }: PromptCardProps) {
  const id = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className="pcard" aria-labelledby={`${id}-t`}>
      <div className="pcard-h">
        <div>
          <Heading id={`${id}-t`}>{AGENT_PROMPT_TITLE}</Heading>
          <p>{AGENT_PROMPT_FOR}</p>
        </div>
        <span className="pcard-tok">
          <b>{formatCount(SIZES.prompt)}</b> tokens
        </span>
      </div>
      <div className="pcard-b">
        {LINES.map((line) => (
          <p key={line}>{marked(line)}</p>
        ))}
      </div>
      <div className="card-actions">
        <CopyButton getText={() => AGENT_PROMPT} label="Copy prompt" describedBy={`${id}-t`} strong />
      </div>
    </section>
  );
}
