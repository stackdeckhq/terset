// One copy button for the whole site: Clipboard API with a fallback,
// a "Copied" state, a spoken status and a 44 px target.
// The small button is an icon with a tooltip; the labelled and strong ones keep their text label.
import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard.ts';

type CopyState = 'idle' | 'copied' | 'failed';

const RESET_MS = 2000;
const SPOKEN: Readonly<Record<Exclude<CopyState, 'idle'>, string>> = {
  copied: 'Copied to the clipboard.',
  failed: 'Copy failed. Select the text and copy it.',
};
const DONE_LABELS: Readonly<Record<Exclude<CopyState, 'idle'>, string>> = {
  copied: 'Copied',
  failed: 'Copy failed',
};

export interface CopyButtonProps {
  /** The text to copy, read at click time so live output is always current. */
  readonly getText: () => string;
  /** What the button does. The strong button shows it; the small one uses it as its name and tooltip. */
  readonly label?: string;
  /** Names what is copied, for screen readers. */
  readonly describedBy?: string;
  readonly onLight?: boolean;
  /** A full-size primary button, for the main action of a card. */
  readonly strong?: boolean;
  /** A small button that shows its label beside the icon, for a second copy action next to an icon one. */
  readonly labelled?: boolean;
  /**
   * Nothing to copy yet: the button is marked aria-disabled and a click does nothing.
   * It is not truly disabled, so it keeps its place in the tab order and never drops focus.
   */
  readonly disabled?: boolean;
  /**
   * Identifies the text on offer when it changes over time. "Copied" or "Copy failed" shows only
   * while this still equals its value at the click, so a late result never lands on newer text.
   */
  readonly feedbackKey?: string;
}

/** The outcome of the last copy, and the feedbackKey it was started with. */
interface CopyResult {
  readonly state: Exclude<CopyState, 'idle'>;
  readonly of: string | undefined;
}

/** What the button shows: the last copy's outcome, but only for the text still on offer and never while disabled. */
export function shownState(last: CopyResult | null, feedbackKey: string | undefined, disabled: boolean): CopyState {
  return last === null || disabled || last.of !== feedbackKey ? 'idle' : last.state;
}

function buttonClass(onLight: boolean, strong: boolean, labelled: boolean): string {
  if (strong) return 'btn btn-primary copy-strong';
  const shape = labelled ? 'mini-btn copy-text' : 'mini-btn copy-icon';
  return onLight ? `${shape} on-light` : shape;
}

export function CopyButton({ getText, label = 'Copy', describedBy, onLight = false, strong = false, labelled = false, disabled = false, feedbackKey }: CopyButtonProps) {
  const [last, setLast] = useState<CopyResult | null>(null);
  const state = shownState(last, feedbackKey, disabled);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const onClick = async (): Promise<void> => {
    if (disabled) return;
    const ok = await copyText(getText());
    // feedbackKey is the one from the click, so the outcome stays tied to the text that was copied.
    setLast({ state: ok ? 'copied' : 'failed', of: feedbackKey });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setLast(null);
    }, RESET_MS);
  };

  const current = state === 'idle' ? label : DONE_LABELS[state];
  const showsLabel = strong || labelled;
  return (
    <>
      <button
        type="button"
        className={buttonClass(onLight, strong, labelled)}
        data-state={state === 'idle' ? undefined : state}
        aria-label={showsLabel ? undefined : current}
        aria-describedby={describedBy}
        aria-disabled={disabled ? true : undefined}
        onClick={() => {
          void onClick();
        }}
      >
        <CopyIcon done={state === 'copied'} />
        {showsLabel ? (
          <StrongLabel label={label} state={state} />
        ) : (
          <span className="copy-tip" aria-hidden="true">
            {current}
          </span>
        )}
      </button>
      <span className="sr" role="status">
        {state === 'idle' ? '' : SPOKEN[state]}
      </span>
    </>
  );
}

// All three labels sit in one grid cell, so the button keeps the width of the
// longest one and never moves its neighbors when the state changes.
function StrongLabel({ label, state }: { readonly label: string; readonly state: CopyState }) {
  const labels: readonly (readonly [CopyState, string])[] = [['idle', label], ['copied', DONE_LABELS.copied], ['failed', DONE_LABELS.failed]];
  return (
    <span className="cb-l">
      {labels.map(([key, text]) => (
        <span key={key} aria-hidden={key === state ? undefined : true} data-on={key === state ? '' : undefined}>
          {text}
        </span>
      ))}
    </span>
  );
}

function CopyIcon({ done }: { readonly done: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      {done ? (
        <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 3.5v-1A1 1 0 0 0 9.5 1.5h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
