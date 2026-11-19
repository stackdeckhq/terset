// The bench chart: four bars per case (Terset, JSON compact, YAML, TOON best variant).
// Terset comes first so readers see it before the others. Pretty JSON is in
// the table only, so the chart stays readable.
// Each case is scaled to its own largest count, so bar lengths inside a case
// compare real token counts. Every bar carries its name and its count.
// While the bench is pending, the chart shows a marked pending state instead.
// With two counters, a switch above the bars picks which counts the bars, the
// summary line and the tables show. o200k_base is shown first and on the server.
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { PENDING_NOTE, PENDING_TITLE, counterList, counterSummary, formatCount, pct } from '../data/numbers.ts';
import type { BenchFile, CaseRow, Counter, CounterId, Counters } from '../data/numbers.ts';
import { useReveal } from '../lib/motion.ts';
import { BenchTable } from './BenchTable.tsx';

export const SCALE_NOTE = 'JSON here is compact JSON. Each case is scaled to its own largest count. Bar lengths compare real token counts within a case.';
type Series = 'terset' | 'json' | 'yaml' | 'toon';

// Color says who, weight says who won: Terset's bar is always the accent and every
// other format is one gray, told apart by its row label. The smallest count in a
// case gets the `min` class: a bold number, and a stronger gray for another format.
const SERIES: readonly { readonly key: Series; readonly short: string }[] = [
  { key: 'terset', short: 'Terset' },
  { key: 'json', short: 'JSON' },
  { key: 'yaml', short: 'YAML' },
  { key: 'toon', short: 'TOON' },
];

function spoken(row: CaseRow): string {
  return `${row.name}: Terset ${formatCount(row.terset)} tokens, JSON compact ${formatCount(row.json)}, YAML ${formatCount(row.yaml)}, TOON best ${formatCount(row.toon)}. ${pct(row.terset, row.toon)} against TOON, ${pct(row.terset, row.json)} against JSON compact.`;
}

function fewerClass(terset: number, base: number): string | undefined {
  return terset < base ? 'fewer' : undefined;
}

function BarRow({ row, index }: { readonly row: CaseRow; readonly index: number }) {
  const max = Math.max(...SERIES.map((series) => row[series.key]));
  const fewest = Math.min(...SERIES.map((series) => row[series.key]));
  return (
    <li className="bar">
      <div className="bar-l">{row.name}</div>
      <div className="bar-t" aria-hidden="true">
        {SERIES.map((series, s) => (
          <span key={series.key} className={row[series.key] === fewest ? `brow ${series.key} min` : `brow ${series.key}`}>
            <span className="bname">{series.short}</span>
            <span className="btrack">
              <i style={{ '--f': (row[series.key] / max).toFixed(4), '--i': index * SERIES.length + s } as CSSProperties} />
              <em>{formatCount(row[series.key])}</em>
            </span>
          </span>
        ))}
      </div>
      {/* A delta is highlighted only when Terset uses fewer tokens. More stays plain. */}
      <div className="bar-v" aria-hidden="true">
        <span className={fewerClass(row.terset, row.toon)}>{pct(row.terset, row.toon)} vs TOON</span>
        <small className={fewerClass(row.terset, row.json)}>{pct(row.terset, row.json)} vs JSON</small>
      </div>
      <span className="sr">{spoken(row)}</span>
    </li>
  );
}

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      <span>
        <i className="terset" />
        Terset, rules included
      </span>
      <span>
        <i className="other" />
        Other formats
      </span>
    </div>
  );
}

/**
 * The counter switch: one button per counter, the pressed one is shown. The totals chart on home
 * uses it too, with its own `label`, so the two groups on that page have different names.
 */
export function CounterSwitch({
  counters,
  current,
  onPick,
  label = 'Count tokens with',
}: {
  readonly counters: readonly Counter[];
  readonly current: CounterId;
  readonly onPick: (id: CounterId) => void;
  readonly label?: string;
}) {
  return (
    <div className="ctr" role="group" aria-label={label}>
      {counters.map((counter) => (
        <button
          key={counter.id}
          type="button"
          aria-pressed={counter.id === current}
          onClick={() => {
            onPick(counter.id);
          }}
        >
          {counter.label}
        </button>
      ))}
    </div>
  );
}

// The change view: one row per case, Terset's change in tokens against TOON and against
// compact JSON. One message: bars left of the zero line mean Terset used fewer tokens.
// Both columns share one scale, so every bar length compares with every other.
export const CHANGE_NOTE = 'Left of zero: Terset used fewer tokens.';
type ChangeBase = 'toon' | 'json';
const CHANGE_BASES: readonly { readonly key: ChangeBase; readonly label: string }[] = [
  { key: 'toon', label: 'vs TOON, best variant' },
  { key: 'json', label: 'vs compact JSON' },
];

function change(row: CaseRow, base: ChangeBase): number {
  return row.terset / row[base] - 1;
}

/** The shared scale, with room on each side of zero for a label. */
function changeScale(rows: readonly CaseRow[]): { readonly lo: number; readonly span: number } {
  const all = rows.flatMap((row) => CHANGE_BASES.map((base) => change(row, base.key)));
  const lo = Math.min(-0.15, ...all);
  const hi = Math.max(0.15, ...all);
  return { lo, span: hi - lo };
}

function ChangeCell({ row, base, scale, index }: { readonly row: CaseRow; readonly base: ChangeBase; readonly scale: { readonly lo: number; readonly span: number }; readonly index: number }) {
  const value = change(row, base);
  const style = { '--z': (-scale.lo / scale.span).toFixed(4), '--w': (Math.abs(value) / scale.span).toFixed(4), '--i': index } as CSSProperties;
  return (
    <span className={value < 0 ? 'cg-cell fewer' : 'cg-cell more'} style={style}>
      <i />
      <em>{pct(row.terset, row[base])}</em>
    </span>
  );
}

function ChangeBody({ counter }: { readonly counter: Counter }) {
  const scale = changeScale(counter.cases);
  return (
    <div className="cg">
      <div className="cg-head" aria-hidden="true">
        <span />
        {CHANGE_BASES.map((base) => (
          <span key={base.key}>{base.label}</span>
        ))}
      </div>
      <ul className="cg-rows">
        {counter.cases.map((row, index) => (
          <li key={row.name} className="cg-row">
            <span className="cg-name" aria-hidden="true">
              {row.name}
            </span>
            {CHANGE_BASES.map((base) => (
              <ChangeCell key={base.key} row={row} base={base.key} scale={scale} index={index} />
            ))}
            <span className="sr">{spoken(row)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeLegend() {
  return (
    <div className="legend" aria-hidden="true">
      <span>
        <i className="terset" />
        Fewer tokens
      </span>
      <span>
        <i className="other" />
        More tokens
      </span>
    </div>
  );
}

function ReadyBody({ counter, table, tableOpen, view }: { readonly counter: Counter; readonly table: boolean; readonly tableOpen: boolean; readonly view: ChartView }) {
  return (
    <>
      {view === 'change' ? (
        <ChangeBody counter={counter} />
      ) : (
        <>
          <ul className="bars">
            {counter.cases.map((row, index) => (
              <BarRow key={row.name} row={row} index={index} />
            ))}
          </ul>
          <p className="eleven" aria-live="polite">
            {counterSummary(counter)}
          </p>
        </>
      )}
      {table ? <BenchTable counter={counter} open={tableOpen} /> : null}
    </>
  );
}

export interface BenchChartProps {
  readonly bench: BenchFile;
  /** Null while the bench is pending. */
  readonly counters: Counters | null;
  readonly headingId: string;
  readonly flat?: boolean;
  /** False where the page shows the tables elsewhere, such as behind "Show full tables". */
  readonly table?: boolean;
  readonly tableOpen?: boolean;
  /** Set when the page shows more than the chart for the picked counter, such as a headline that follows the tab. */
  readonly control?: { readonly picked: CounterId; readonly onPick: (id: CounterId) => void };
  /** "counts" draws every format's bars per case. "change" draws Terset's change against TOON and JSON, the short form for home. */
  readonly view?: ChartView;
}

type ChartView = 'counts' | 'change';

export function BenchChart({ bench, counters, headingId, flat = false, table = true, tableOpen = false, control, view = 'counts' }: BenchChartProps) {
  const ref = useRef<HTMLElement>(null);
  const shown = useReveal(ref);
  const [own, setOwn] = useState<CounterId>('o200k');
  const picked = control?.picked ?? own;
  const setPicked = control?.onPick ?? setOwn;
  const list = counters === null ? [] : counterList(counters);
  const counter = list.find((item) => item.id === picked) ?? list[0];
  const pending = bench.status === 'pending' || counter === undefined;
  const classes = ['chart', flat ? 'flat' : '', view === 'change' ? 'change' : '', pending ? 'pending' : '', shown ? 'in' : 'pre'].filter(Boolean).join(' ');
  return (
    <figure ref={ref} className={classes} aria-labelledby={headingId} data-bench={bench.status} data-counter={counter?.id}>
      <div className="chart-top">
        <div>
          <h3 id={headingId}>{counter === undefined ? 'Tokens per case' : `Tokens per case, all ${String(counter.cases.length)} cases`}</h3>
          <p className="chart-sub">{view === 'change' ? CHANGE_NOTE : SCALE_NOTE}</p>
        </div>
        {view === 'change' ? <ChangeLegend /> : <Legend />}
      </div>
      {list.length > 1 && counter !== undefined ? <CounterSwitch counters={list} current={counter.id} onPick={setPicked} /> : null}
      {bench.status === 'pending' || counter === undefined ? (
        <div className="chart-pending" role="status">
          <span className="pill">Numbers pending</span>
          <b>{PENDING_TITLE}</b>
          <p>{bench.status === 'pending' ? `${bench.reason} ${PENDING_NOTE}` : PENDING_NOTE}</p>
        </div>
      ) : (
        <ReadyBody counter={counter} table={table} tableOpen={tableOpen} view={view} />
      )}
    </figure>
  );
}
