// Shared pieces of a home step: the section shell and a block that reveals on scroll.
import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { StepId } from '../../data/steps.ts';
import { useReveal } from '../../lib/motion.ts';

export interface StepProps {
  readonly id: StepId;
  /** Text, or text plus its tag when the heading swaps them itself (see `live`). */
  readonly title: ReactNode;
  /** A small label next to the title, such as the tokenizer behind a count. */
  readonly tag?: string | null;
  readonly line?: ReactNode;
  /** True when the heading and line change in place, such as with a chart tab: screen readers hear the new text, politely. */
  readonly live?: boolean;
  readonly children: ReactNode;
}

export function Step({ id, title, tag = null, line, live = false, children }: StepProps) {
  const head = (
    <>
      {tag === null ? (
        <h2 id={`h-${id}`}>{title}</h2>
      ) : (
        <h2 id={`h-${id}`} className="with-tag">
          {title} <span className="tok">{tag}</span>
        </h2>
      )}
      {line === undefined ? null : <p className="line">{line}</p>}
    </>
  );
  return (
    <section className="step" id={id} aria-labelledby={`h-${id}`}>
      {live ? (
        <div className="step-head" aria-live="polite" aria-atomic="true">
          {head}
        </div>
      ) : (
        head
      )}
      {children}
    </section>
  );
}

export interface RevealProps {
  readonly className: string;
  /** Use "pre" for blocks that animate their parts instead of fading in. */
  readonly mode?: 'rv' | 'pre';
  /** Names the block as a group for screen readers. */
  readonly label?: string;
  readonly children: ReactNode;
}

export function Reveal({ className, mode = 'rv', label, children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useReveal(ref);
  const state = mode === 'rv' ? (shown ? 'rv in' : 'rv') : shown ? 'in' : 'pre';
  return (
    <div ref={ref} className={`${className} ${state}`} role={label === undefined ? undefined : 'group'} aria-label={label}>
      {children}
    </div>
  );
}
