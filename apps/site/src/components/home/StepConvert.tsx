// Step 2: the live converter. Paste JSON, get the table from the real encoder.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { GENERATED } from '../../data/generated.ts';
import { BENCH, COUNTERS, PENDING_TITLE, counterList, formatCount } from '../../data/numbers.ts';
import { SAMPLE_IDS, SAMPLE_LABELS, SAMPLES } from '../../data/samples.ts';
import type { SampleId } from '../../data/samples.ts';
import { STATUSES, convert, promptText, statusOf } from '../../lib/convert.ts';
import type { ConvertResult, Status } from '../../lib/convert.ts';
import { highlight } from '../../lib/format.ts';
import { LIVE_TOKENIZER } from '../../lib/live-tokenizer.ts';
import { esc } from '../../lib/text.ts';
import { CopyButton } from '../CopyButton.tsx';
import { Stack } from '../Stack.tsx';
import type { StackItem } from '../Stack.tsx';
import { Step } from './Step.tsx';
import { TokenView } from './TokenView.tsx';

const DEBOUNCE_MS = 150;
const SAMPLE_JSON: Readonly<Record<SampleId, string>> = {
  orders: JSON.stringify(SAMPLES.orders),
  servers: JSON.stringify(SAMPLES.servers),
  config: JSON.stringify(SAMPLES.config),
};

function sampleFor(result: ConvertResult): SampleId | null {
  if (!result.ok) return null;
  const text = JSON.stringify(result.value);
  return SAMPLE_IDS.find((id) => SAMPLE_JSON[id] === text) ?? null;
}

function outHtml(result: ConvertResult): string {
  if (!result.ok) return `<span class="err"><b>${esc(result.title)}</b>${esc(result.detail)}</span>`;
  return highlight(result.text, { align: true });
}

/**
 * The text the copy buttons may copy: the encoded result for what was typed, or null while
 * newer input waits for the timer or after a refused input, so a button never copies an older result.
 */
export function copyable(source: string, settled: string, result: ConvertResult): string | null {
  return source === settled && result.ok ? result.text : null;
}

type TokenKey = 'invalid' | 'bytes' | SampleId;

function tokenKey(result: ConvertResult): TokenKey {
  if (!result.ok) return 'invalid';
  return sampleFor(result) ?? 'bytes';
}

/** The sample's counts on every counter, one sentence each. Pasted text gets its live count from Show tokens. */
function sampleLine(sample: SampleId): ReactNode {
  if (COUNTERS === null) return PENDING_TITLE;
  const list = counterList(COUNTERS);
  return (
    <>
      {list.map((counter, index) => {
        const counts = counter.samples[sample];
        const lead = list.length === 1 ? 'Tokens for this sample' : index === 0 ? `Sample tokens, ${counter.name}` : counter.name;
        return (
          <span key={counter.id} className="tok-c">
            {lead}: Terset <b>{formatCount(counts.terset)}</b>, JSON <b>{formatCount(counts.json)}</b>, TOON <b>{formatCount(counts.toon)}</b>.{' '}
          </span>
        );
      })}
    </>
  );
}

// Every line the token row can show, so the row keeps the height of the longest.
const TOKEN_ITEMS: readonly StackItem<TokenKey>[] = [
  { key: 'invalid', node: 'Sizes return when the JSON converts.' },
  { key: 'bytes', node: `Live sizes are in bytes. Show tokens counts them with ${LIVE_TOKENIZER}.` },
  ...SAMPLE_IDS.map((sample) => ({ key: sample, node: sampleLine(sample) })),
];
const STATUS_ITEMS: readonly StackItem<Status>[] = STATUSES.map((status) => ({ key: status, node: status }));

function TokenLine({ result }: { readonly result: ConvertResult }) {
  return (
    <p className={BENCH.status === 'pending' ? 'tokline pending' : 'tokline'}>
      <Stack items={TOKEN_ITEMS} current={tokenKey(result)} />
    </p>
  );
}

function Meter({ result }: { readonly result: ConvertResult }) {
  const json = result.ok ? result.jsonBytes : 0;
  const terset = result.ok ? result.tersetBytes : 0;
  const max = Math.max(json, terset, 1);
  const width = (n: number): string => `${((n / max) * 100).toFixed(1)}%`;
  return (
    <div className="meter" role="group" aria-label="Size in bytes">
      {/* Terset first, then JSON, so readers see Terset before the others. */}
      <div className="mrow">
        <span className="lbl">Terset</span>
        <span className="track">
          <span className="fill t" style={{ width: width(terset) }} />
        </span>
        <span className="v">{formatCount(terset)} B</span>
      </div>
      <div className="mrow">
        <span className="lbl">Compact JSON</span>
        <span className="track">
          <span className="fill j" style={{ width: width(json) }} />
        </span>
        <span className="v">{formatCount(json)} B</span>
      </div>
      <TokenLine result={result} />
    </div>
  );
}

export function StepConvert() {
  const id = useId();
  const [preset, setPreset] = useState<SampleId | null>('orders');
  const [source, setSource] = useState(() => GENERATED.samples.orders.pretty);
  const [settled, setSettled] = useState(source);
  const timer = useRef<number | undefined>(undefined);
  const result = useMemo(() => convert(settled), [settled]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const onInput = (text: string): void => {
    setSource(text);
    setPreset(null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSettled(text);
    }, DEBOUNCE_MS);
  };

  const pick = (next: SampleId): void => {
    window.clearTimeout(timer.current);
    const text = GENERATED.samples[next].pretty;
    setPreset(next);
    setSource(text);
    setSettled(text);
  };

  const status = statusOf(result);
  const good = result.ok && result.roundTrip;
  const copy = copyable(source, settled, result);
  return (
    <Step id="b2" title="Paste rows. Get the table.">
      <div className="vis conv">
        <div className="ctl">
          <fieldset className="seg">
            <legend className="sr">Sample data</legend>
            {SAMPLE_IDS.map((sample) => (
              <span key={sample} className="pm-opt">
                <input
                  type="radio"
                  name={`${id}-preset`}
                  id={`${id}-${sample}`}
                  value={sample}
                  checked={preset === sample}
                  onChange={() => {
                    pick(sample);
                  }}
                />
                <label htmlFor={`${id}-${sample}`}>{SAMPLE_LABELS[sample]}</label>
              </span>
            ))}
          </fieldset>
          <span className={good ? 'rt' : 'rt bad'}>
            <span className="rt-dot" aria-hidden="true" />
            <Stack items={STATUS_ITEMS} current={status} />
          </span>
          <span className="sr" role="status">
            {status}
          </span>
        </div>
        <div className="pane2">
          <div className="ed">
            <div className="ed-h">
              <label className="fn" htmlFor={`${id}-in`}>
                Your JSON
              </label>
            </div>
            <textarea
              id={`${id}-in`}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              value={source}
              onChange={(event) => {
                onInput(event.target.value);
              }}
            />
          </div>
          <div className="code out-wrap">
            <div className="code-h">
              <span className="fn" id={`${id}-out-label`}>
                Terset, from the real encoder
              </span>
              <span className="code-h-acts">
                <CopyButton getText={() => (copy === null ? '' : promptText(copy))} label="Copy for a prompt" labelled disabled={copy === null} feedbackKey={copy ?? ''} describedBy={`${id}-out-label`} />
                <CopyButton getText={() => copy ?? ''} disabled={copy === null} feedbackKey={copy ?? ''} describedBy={`${id}-out-label`} />
              </span>
            </div>
            <div className="fade-x out-fade">
              <pre className="out xs" id="converter-out" tabIndex={0} role="region" aria-labelledby={`${id}-out-label`} dangerouslySetInnerHTML={{ __html: outHtml(result) }} />
            </div>
          </div>
        </div>
        <Meter result={result} />
        <TokenView result={result} />
      </div>
    </Step>
  );
}
