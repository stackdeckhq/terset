// Step 6: the token counts. The six orders up top, then all cases.
// The headline and every figure come from the bench data. Pending shows pending.
// The headline, the six orders and the foot note follow the chart's counter tab.
// o200k_base, like the hero, is the default and what the server renders.
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ACCURACY, accuracyHomeLine } from '../../data/accuracy.ts';
import { BENCH, COUNTERS, PENDING_LABEL, counterList, countersNote, formatCount, pct } from '../../data/numbers.ts';
import type { BenchFile, CounterId, Counters } from '../../data/numbers.ts';
import type { Trio } from '../../data/bench-schema.ts';
import { homeHeadline } from '../../data/proof.ts';
import type { HomeHeadline } from '../../data/proof.ts';
import { BenchChart } from '../BenchChart.tsx';
import { Reveal, Step } from './Step.tsx';

const ACCURACY_LINE = accuracyHomeLine(ACCURACY);

/** Everything in step 6 that changes with the chart's counter tab. */
export interface BenchView {
  readonly id: CounterId;
  readonly headline: HomeHeadline;
  /** The six orders on this counter. Null while the bench is pending. */
  readonly orders: Trio | null;
  /** Names the six orders as a group for screen readers. */
  readonly ordersLabel: string;
  readonly foot: string;
}

/** Who counted the six orders, in a sentence. */
const ORDERS_COUNTED_BY: Readonly<Record<CounterId, string>> = { o200k: 'o200k_base', claude: "Claude's token count" };

/** One view per counter tab, o200k_base first. One pending view while the bench is pending. */
export function benchViews(bench: BenchFile, counters: Counters | null): readonly BenchView[] {
  if (counters === null) return [{ id: 'o200k', headline: homeHeadline(bench, null), orders: null, ordersLabel: 'Tokens for the six orders', foot: countersNote(bench, null) }];
  const list = counterList(counters);
  const paired = list.length > 1;
  return list.map((counter) => ({
    id: counter.id,
    headline: homeHeadline(bench, counters, counter.id),
    orders: counter.samples.orders,
    ordersLabel: paired ? `Tokens for the six orders, ${ORDERS_COUNTED_BY[counter.id]}` : 'Tokens for the six orders',
    foot: paired ? `${countersNote(bench, counters)} The six orders above use ${ORDERS_COUNTED_BY[counter.id]}.` : countersNote(bench, counters),
  }));
}

const VIEWS = benchViews(BENCH, COUNTERS);
function firstView(views: readonly BenchView[]): BenchView {
  const first = views[0];
  if (first === undefined) throw new Error('Step 6 needs at least one view');
  return first;
}

const FIRST_VIEW = firstView(VIEWS);

/**
 * Every view's text in one grid cell, so the box keeps the size of the longest one and a
 * tab switch moves nothing. Only the picked view is visible, to eyes and to screen readers.
 */
function Swap({ picked, render }: { readonly picked: CounterId; readonly render: (view: BenchView) => ReactNode }) {
  const only = VIEWS.length === 1 ? VIEWS[0] : undefined;
  if (only !== undefined) return <>{render(only)}</>;
  return (
    <span className="swap">
      {VIEWS.map((view) => (
        <span key={view.id} className={view.id === picked ? 'swap-on' : 'swap-off'} data-counter={view.id}>
          {render(view)}
        </span>
      ))}
    </span>
  );
}

function headlineTitle({ headline }: BenchView): ReactNode {
  return headline.tag === null ? (
    headline.title
  ) : (
    <>
      {headline.title} <span className="tok">{headline.tag}</span>
    </>
  );
}

function count(pick: (orders: Trio) => number): (view: BenchView) => string {
  return (view) => (view.orders === null ? PENDING_LABEL : formatCount(pick(view.orders)));
}

export function StepBench() {
  const [picked, setPicked] = useState<CounterId>('o200k');
  const view = VIEWS.find((item) => item.id === picked) ?? FIRST_VIEW;
  const line = VIEWS.every((item) => item.headline.line === null) ? undefined : <Swap picked={picked} render={(item) => item.headline.line} />;
  return (
    <Step id="b6" title={<Swap picked={picked} render={headlineTitle} />} line={line} live>
      {/* Terset first, then JSON and TOON, so readers see Terset before the others. */}
      <Reveal className={view.orders === null ? 'trio pending' : 'trio'} label={view.ordersLabel}>
        <div className="best">
          <b>
            <Swap picked={picked} render={count((orders) => orders.terset)} />
          </b>
          {/* &nbsp; keeps the last two words together, so none sits alone in the narrow 390 px column. */}
          <span>Terset, rules&nbsp;included</span>
          {view.orders === null ? null : (
            <small>
              <Swap picked={picked} render={(item) => (item.orders === null ? null : `${pct(item.orders.terset, item.orders.json)} against JSON`)} />
            </small>
          )}
        </div>
        <div>
          <b>
            <Swap picked={picked} render={count((orders) => orders.json)} />
          </b>
          <span>Compact JSON</span>
        </div>
        <div>
          <b>
            <Swap picked={picked} render={count((orders) => orders.toon)} />
          </b>
          <span>TOON, best&nbsp;variant</span>
        </div>
      </Reveal>
      <BenchChart bench={BENCH} counters={COUNTERS} headingId="chart-h" control={{ picked, onPick: setPicked }} view="change" />
      <p className="acc-home">
        {ACCURACY_LINE}{' '}
        <Link to="/benchmark" hash="accuracy">
          See accuracy and cost
        </Link>
      </p>
      <p className="foot-note">
        <Swap picked={picked} render={(item) => item.foot} />
      </p>
    </Step>
  );
}
