// Step 5: a real round trip. The button runs decode() on the encoded orders, in the page.
// Layout: three panels of one fixed height, sized to show the whole Terset table.
// The JSON panels scroll inside. Every text that changes on a run is stacked in
// one grid cell, so the step keeps exactly the same size before and after.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { FACTS as PACKAGE_FACTS } from '../../data/generated.ts';
import { formatCount } from '../../data/numbers.ts';
import { decode } from '../../lib/format.ts';
import { prefersStill } from '../../lib/motion.ts';
import { ORDERS_COMPACT, ORDERS_COUNT, ORDERS_HL, ORDERS_LINES, ORDERS_TERSET } from '../../lib/orders.ts';
import { bytes } from '../../lib/text.ts';
import { FlowArrow } from '../Icons.tsx';
import { Stack } from '../Stack.tsx';
import type { StackItem } from '../Stack.tsx';
import { Reveal, Step } from './Step.tsx';

const STAGES = 3;
const STAGE_MS = 260;
/** Every panel is tall enough for the whole Terset table. */
const PIPE_STYLE: CSSProperties & Readonly<Record<'--rows', string>> = { '--rows': String(ORDERS_LINES.length) };

interface Outcome {
  readonly pretty: string;
  readonly count: number;
  readonly same: boolean;
}

type RunState = 'idle' | 'same' | 'diff';

function runRoundTrip(): Outcome {
  const back = decode(ORDERS_TERSET);
  const text = JSON.stringify(back);
  const orders = Array.isArray(back) ? undefined : back.orders;
  return { pretty: JSON.stringify(back, null, 2), count: Array.isArray(orders) ? orders.length : 0, same: text === ORDERS_COMPACT };
}

const FACTS: readonly { readonly value: number; readonly label: string }[] = [
  { value: PACKAGE_FACTS.fuzzObjects, label: 'seeded random roots in the fuzz round trip test' },
  { value: PACKAGE_FACTS.runtimeDependencies, label: 'runtime dependencies' },
];

const BUTTON_ITEMS: readonly StackItem<'first' | 'again'>[] = [
  { key: 'first', node: 'Run the round trip' },
  { key: 'again', node: 'Run it again' },
];
const RESULT_TEXT: Readonly<Record<RunState, string>> = {
  idle: 'Runs encode() and decode() on the six orders, in this page.',
  same: 'Equal to the input: same values, same key order.',
  diff: 'The round trip did not match.',
};
const RESULT_ITEMS: readonly StackItem<RunState>[] = (['idle', 'same', 'diff'] as const).map((key) => ({ key, node: RESULT_TEXT[key] }));
const OUT_META_ITEMS: readonly StackItem<RunState>[] = [
  { key: 'idle', node: 'Run it to see' },
  {
    key: 'same',
    node: (
      <>
        {ORDERS_COUNT} orders, <span className="ok">equal to the input</span>
      </>
    ),
  },
  { key: 'diff', node: 'Not equal to the input' },
];

export function StepRoundTrip() {
  const [lit, setLit] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);

  useEffect(
    () => () => {
      timers.current.forEach((id) => {
        window.clearTimeout(id);
      });
    },
    [],
  );

  const run = (): void => {
    if (busy.current) return;
    const result = runRoundTrip();
    if (prefersStill()) {
      setLit(STAGES);
      setOutcome(result);
      return;
    }
    busy.current = true;
    setLit(0);
    for (let i = 1; i <= STAGES; i++) {
      timers.current.push(
        window.setTimeout(
          () => {
            setLit(i);
            if (i === STAGES) {
              setOutcome(result);
              busy.current = false;
            }
          },
          120 + (i - 1) * STAGE_MS,
        ),
      );
    }
  };

  const state: RunState = outcome === null ? 'idle' : outcome.same ? 'same' : 'diff';
  const on = (stage: number): string => (lit >= stage ? ' on' : '');
  return (
    <Step id="b5" title="Decode it. Get the same JSON back.">
      <Reveal className="vis">
        <div className="pipe" style={PIPE_STYLE}>
          <div className={`node star${on(1)}`}>
            <div className="node-h">
              <span>Terset table</span>
              <code>{ORDERS_LINES.length} lines</code>
            </div>
            <div className="panel fade-x">
              <pre className="xs" tabIndex={0} role="region" aria-label="The six orders as a Terset table. Scrolls sideways." dangerouslySetInnerHTML={{ __html: ORDERS_HL }} />
            </div>
            <div className="meta">
              {formatCount(bytes(ORDERS_TERSET))} bytes
            </div>
          </div>
          <div className={`edge${on(2)}`}>
            <FlowArrow />
            <span>decode()</span>
          </div>
          <div className={`node${on(3)}`}>
            <div className="node-h">
              <span>Back to JSON</span>
              <code>output</code>
            </div>
            {outcome === null ? (
              <div className="panel light empty">
                <p>
                  <b>Waiting for&nbsp;decode()</b>
                </p>
              </div>
            ) : (
              <div className="panel light fade-y">
                <pre tabIndex={0} role="region" aria-label="The decoded JSON, the output. Scrolls.">
                  {outcome.pretty}
                </pre>
              </div>
            )}
            <div className="meta">
              <Stack items={OUT_META_ITEMS} current={state} />
            </div>
          </div>
        </div>
        <div className="card-actions rt-row">
          <p className={state === 'same' ? 'card-note rt-res ok' : 'card-note rt-res'}>
            <Stack items={RESULT_ITEMS} current={state} />
          </p>
          <button className="btn btn-primary" type="button" onClick={run}>
            <Stack items={BUTTON_ITEMS} current={outcome === null ? 'first' : 'again'} />
          </button>
          <span className="sr" aria-live="polite">
            {state === 'idle' ? '' : RESULT_TEXT[state]}
          </span>
        </div>
        <div className="facts">
          {FACTS.map((fact) => (
            <div key={fact.label} className="fact">
              <b>{formatCount(fact.value)}</b>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </Step>
  );
}
