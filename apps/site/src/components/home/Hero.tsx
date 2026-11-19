// The hero: the six orders as compact JSON. On first view the keys light up
// and fade, the count runs down, and the Terset table takes over.
// While the bench is pending, the counts read "Pending" and nothing ticks.
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BENCH, COUNTERS, PENDING_LABEL, benchTotals, compareTokens, formatCount } from '../../data/numbers.ts';
import type { Trio } from '../../data/bench-schema.ts';
import { NUM, hlToon, jsonTokens } from '../../lib/highlight.ts';
import { prefersStill } from '../../lib/motion.ts';
import { ORDERS_COMPACT, ORDERS_HL, ORDERS_RULES, ORDERS_TOON } from '../../lib/orders.ts';
import { esc } from '../../lib/text.ts';
import { ArrowIcon } from '../Icons.tsx';
import { InstallLine } from '../InstallLine.tsx';

type View = 'json' | 'toon' | 'terset';
type Phase = 'pre' | 'mark' | 'fade' | 'settle' | 'done';

const VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: 'json', label: 'JSON' },
  { id: 'toon', label: 'TOON' },
  { id: 'terset', label: 'Terset' },
];
const COUNTS: Trio | null = BENCH.status === 'ready' ? BENCH.samples.orders : null;

/**
 * The headline result: every benchmark case summed, on o200k_base. The six orders below are one
 * sample, so the lead states the total instead. Shown only while Terset is smaller than both.
 */
const HEADLINE = ((): { readonly cases: number; readonly vsJson: string; readonly vsToon: string } | null => {
  if (COUNTERS === null) return null;
  const totals = benchTotals(COUNTERS.o200k);
  if (totals.terset >= totals.json || totals.terset >= totals.toon) return null;
  return { cases: COUNTERS.o200k.cases.length, vsJson: compareTokens(totals.terset, totals.json, 'compact JSON'), vsToon: compareTokens(totals.terset, totals.toon, "TOON's best form") };
})();
const TOON_LINE_COUNT = ORDERS_TOON.split('\n').length;

/** Compact JSON with each key wrapped, so the keys can light up one after another. */
function jsonHtml(text: string): string {
  const tokens = jsonTokens(text);
  let key = 0;
  return tokens
    .map((token, i) => {
      if (token.startsWith('"') && tokens[i + 1] === ':') return `<span class="jk" style="--i:${String(key++)}">${esc(token)}</span>`;
      if (token.startsWith('"') || NUM.test(token) || token === 'null') return `<span class="jv">${esc(token)}</span>`;
      return esc(token);
    })
    .join('');
}

const JSON_HTML = jsonHtml(ORDERS_COMPACT);
const TOON_HTML = hlToon(ORDERS_TOON);
const TERSET_LINES_HTML = ORDERS_HL.split('\n')
  .map((line, n) => `<div class="tl" style="--i:${String(n + 1)}"><span>${String(n + 1)}</span><span>${line}</span></div>`)
  .join('');
/** The counter's width in ch: the longest count it can show, so ticking never moves the header. */
const COUNT_CH = COUNTS === null ? 0 : Math.max(...[COUNTS.json, COUNTS.toon, COUNTS.terset].map((n) => formatCount(n).length));

// Layout: the three views share one grid cell, so the window is always as tall
// as the tallest view at that width (TOON adds no height; it scrolls inside).
// Switching views only changes opacity, so nothing below the window ever moves.
function Stage() {
  const [view, setView] = useState<View>('json');
  const [phase, setPhase] = useState<Phase>('pre');
  const [count, setCount] = useState(COUNTS?.json ?? 0);
  const stage = useRef<HTMLElement>(null);
  const vToon = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const frame = useRef(0);
  const played = useRef(false);

  const clearAll = useCallback((): void => {
    timers.current.forEach((id) => {
      window.clearTimeout(id);
    });
    timers.current = [];
    cancelAnimationFrame(frame.current);
  }, []);

  const show = useCallback(
    (next: View): void => {
      clearAll();
      played.current = true;
      setView(next);
      setPhase('done');
      if (COUNTS !== null) setCount(COUNTS[next]);
      if (next === 'toon' && vToon.current !== null) vToon.current.scrollTop = 0;
    },
    [clearAll],
  );

  const tick = useCallback((from: number, to: number, ms: number): void => {
    const start = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(from + (to - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  const play = useCallback((): void => {
    played.current = true;
    if (prefersStill()) {
      show('terset');
      return;
    }
    const later = (ms: number, run: () => void): void => {
      timers.current.push(window.setTimeout(run, ms));
    };
    later(500, () => {
      setPhase('mark');
    });
    later(1700, () => {
      setPhase('fade');
      if (COUNTS !== null) tick(COUNTS.json, COUNTS.terset, 1100);
    });
    later(2700, () => {
      setView('terset');
      setPhase('settle');
    });
    later(3500, () => {
      setPhase('done');
    });
  }, [show, tick]);

  useEffect(() => {
    const element = stage.current;
    let observer: IntersectionObserver | undefined;
    if (element !== null && 'IntersectionObserver' in window && !prefersStill()) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting) && !played.current) {
            play();
            observer?.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(element);
    } else {
      frame.current = requestAnimationFrame(play);
    }
    return () => {
      observer?.disconnect();
      clearAll();
    };
  }, [play, clearAll]);

  const classes = ['stage', phase === 'pre' || phase === 'mark' || phase === 'fade' || phase === 'settle' ? 'pre' : '', phase === 'mark' || phase === 'fade' ? 'mark' : '', phase === 'fade' ? 'fade' : '', view === 'terset' ? 'show-t' : '', view === 'toon' ? 'show-o' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={classes} ref={stage} aria-labelledby="stage-cap">
      <div className="win">
        <div className="win-h">
          <div className="seg-d" role="group" aria-label="Show the six orders as">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => {
                  show(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {COUNTS === null ? (
            <div className="count pending">
              <span className="count-l">Tokens pending</span>
            </div>
          ) : (
            <div className="count">
              <span className="count-n" style={{ width: `${String(COUNT_CH)}ch` }}>
                {formatCount(count)}
              </span>
              <span className="count-l">tokens</span>
            </div>
          )}
        </div>
        <div className="win-b" data-view={view}>
          <div className="view v-json" aria-hidden={view === 'json' ? undefined : true} dangerouslySetInnerHTML={{ __html: JSON_HTML }} />
          <div className="view v-toon" ref={vToon} tabIndex={view === 'toon' ? 0 : -1} role="region" aria-hidden={view === 'toon' ? undefined : true} aria-label={`The six orders as TOON, ${String(TOON_LINE_COUNT)} lines`} dangerouslySetInnerHTML={{ __html: TOON_HTML }} />
          <div className="view v-terset" aria-hidden={view === 'terset' ? undefined : true}>
            <div className="tl lgl">
              <span className="tag">Fitted rules, once per prompt</span>
              <span className="fade-x">
                <span className="xs" tabIndex={view === 'terset' ? 0 : -1} role="region" aria-label="The fitted rules sentence. Scrolls sideways.">
                  {ORDERS_RULES}
                </span>
              </span>
            </div>
            <div className="fade-x tl-wrap">
              <div className="xs" tabIndex={view === 'terset' ? 0 : -1} role="region" aria-label="The six orders as Terset. Scrolls sideways.">
                <div className="tl-rows" dangerouslySetInnerHTML={{ __html: TERSET_LINES_HTML }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Terset first in the number row; the tabs above keep the JSON, TOON, Terset story order. */}
      <ul className={COUNTS === null ? 'hs pending' : 'hs'} aria-label="Tokens for the same six orders">
        <li className="on">
          <span>
            <span className="sw" aria-hidden="true" />
            Terset
          </span>
          <b>{COUNTS === null ? PENDING_LABEL : formatCount(COUNTS.terset)}</b>
        </li>
        <li>
          <span>JSON</span>
          <b>{COUNTS === null ? PENDING_LABEL : formatCount(COUNTS.json)}</b>
        </li>
        <li>
          <span>TOON, best variant</span>
          <b>{COUNTS === null ? PENDING_LABEL : formatCount(COUNTS.toon)}</b>
        </li>
      </ul>
      <p className="hs-pct">
        {COUNTS === null ? (
          'Token counts are pending. They appear once the measured results are published.'
        ) : (
          <>
            {compareTokens(COUNTS.terset, COUNTS.json, 'JSON')}. {compareTokens(COUNTS.terset, COUNTS.toon, 'TOON')}.
          </>
        )}
      </p>
      <figcaption className="cap" id="stage-cap">
        One sample: six orders, counted with o200k_base against compact JSON. Terset counts include the fitted rules sentence.
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="h-hero">
      <div className="hero-copy">
        <p className="owner">
          <b>TER</b>se <b>SET</b>s. Built by <a href="https://stackdeck.dev">StackDeck</a>.
        </p>
        <h1 id="h-hero">
          Same data.
          <br />
          <span className="grad">Fewer tokens.</span>
        </h1>
        <p className="lead">
          Terset writes JSON records as one table for a model to read.{' '}
          {HEADLINE !== null && (
            <>
              Over {String(HEADLINE.cases)} benchmark cases on o200k_base, it used{' '}
              <Link to="/benchmark" className="lead-num">
                {HEADLINE.vsJson}
              </Link>{' '}
              and {HEADLINE.vsToon}.{' '}
            </>
          )}
          Unlike TOON, it keeps the table when records skip a field or hold a list.
        </p>
        <div className="actions">
          <Link to="/" hash="b2" className="btn btn-lg btn-primary">
            Try your JSON <ArrowIcon />
          </Link>
          <Link to="/format" className="btn btn-lg btn-line">
            See the format
          </Link>
        </div>
        <InstallLine />
      </div>
      <Stage />
    </section>
  );
}
