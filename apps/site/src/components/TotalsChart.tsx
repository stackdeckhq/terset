// The totals chart at the top of home step 6: one bar per format, the sum of its counts
// over every case. Terset comes first and is the only bar in the accent; every other
// format is one gray, as in the per-case chart. The smallest total is bold.
// Bar widths are inline styles, so the server HTML draws every bar and number with no
// script. The reveal only grows the bars in; under reduced motion they appear at once.
// It follows the step's counter switch, and carries the same switch, so it shows the
// totals of the picked counter, then that counter's losses line. While the bench is pending it renders nothing: the
// per-case chart below shows the pending state.
import { Link } from '@tanstack/react-router';
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { benchTotals, counterList, formatCount, lossesLine, totalsChartNote } from '../data/numbers.ts';
import type { BenchTotals, CaseSet, CounterId, Counters } from '../data/numbers.ts';
import { useReveal } from '../lib/motion.ts';
import { CounterSwitch } from './BenchChart.tsx';

/** The formats in chart order: Terset first, then the others as the README totals table lists them. */
const FORMATS: readonly { readonly key: keyof BenchTotals; readonly label: string }[] = [
  { key: 'terset', label: 'Terset' },
  { key: 'toon', label: 'TOON best' },
  { key: 'json', label: 'Compact JSON' },
  { key: 'yaml', label: 'YAML' },
  { key: 'jsonPretty', label: 'Pretty JSON' },
];

export interface TotalsBar {
  readonly key: keyof BenchTotals;
  readonly label: string;
  readonly total: number;
  /** The bar length: this total over the largest total. */
  readonly fraction: number;
  readonly terset: boolean;
  /** True for the smallest total. */
  readonly min: boolean;
}

/** One bar per format, in chart order, scaled to the largest total. */
export function totalsBars(bench: CaseSet): readonly TotalsBar[] {
  const totals = benchTotals(bench);
  const values = FORMATS.map((format) => totals[format.key]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  return FORMATS.map((format) => {
    const total = totals[format.key];
    return { key: format.key, label: format.label, total, fraction: total / max, terset: format.key === 'terset', min: total === min };
  });
}

export interface TotalsChartProps {
  /** Null while the bench is pending. */
  readonly counters: Counters | null;
  readonly picked: CounterId;
  readonly onPick: (id: CounterId) => void;
}

const HEADING_ID = 'totals-h';

export function TotalsChart({ counters, picked, onPick }: TotalsChartProps) {
  const ref = useRef<HTMLElement>(null);
  const shown = useReveal(ref);
  const list = counters === null ? [] : counterList(counters);
  const counter = list.find((item) => item.id === picked) ?? list[0];
  if (counter === undefined) return null;
  return (
    <figure ref={ref} className={`chart totals ${shown ? 'in' : 'pre'}`} aria-labelledby={HEADING_ID} data-counter={counter.id}>
      <div className="chart-top">
        <div>
          <h3 id={HEADING_ID}>{`Total tokens, all ${String(counter.cases.length)} cases`}</h3>
          <p className="chart-sub">{`Counted with ${counter.label}.`}</p>
        </div>
      </div>
      {list.length > 1 ? <CounterSwitch counters={list} current={counter.id} onPick={onPick} label="Count the totals with" /> : null}
      <ul className="cost-bars">
        {totalsBars(counter).map((bar, index) => (
          <li key={bar.key} className={['cost-bar', bar.terset ? 'terset' : '', bar.min ? 'min' : ''].filter(Boolean).join(' ')}>
            <span className="cost-l">{bar.label}</span>
            <span className="cost-t" aria-hidden="true">
              <i style={{ '--f': bar.fraction.toFixed(4), '--i': index } as CSSProperties} />
            </span>
            <span className="cost-v">
              <b>{formatCount(bar.total)}</b>
            </span>
          </li>
        ))}
      </ul>
      <p className="totals-line">{lossesLine(counter)}</p>
      <figcaption className="tbl-note">
        {totalsChartNote(counter)}{' '}
        <Link to="/benchmark" hash="method">
          How to rerun the counts
        </Link>
      </figcaption>
    </figure>
  );
}
