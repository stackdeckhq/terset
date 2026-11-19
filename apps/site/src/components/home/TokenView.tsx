// Step 2: the "Show tokens" view under the converter. The o200k_base rank table is about
// a megabyte gzipped, so it loads only on the first click, through a dynamic import of
// lib/tokens.ts, and the toggle states the download size before it starts. Then each
// token of the compact JSON and of the Terset text with its rules line gets one of two
// soft shades, with a live count for each. A failed load says so and offers a reload, since
// the browser keeps a failed import() and a second one in the same page fails too.
// The count is o200k_base only, and the note says so. Nothing here animates.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatCount } from '../../data/numbers.ts';
import type { ConvertResult } from '../../lib/convert.ts';
import type { JsonRoot } from '../../lib/format.ts';
import { LIVE_TOKENIZER, TOKENIZER_DOWNLOAD_MB } from '../../lib/live-tokenizer.ts';
import type { LiveTokens } from '../../lib/tokens.ts';

export { TOKENIZER_DOWNLOAD_MB };

/** The most tokens drawn per pane, so a long paste stays fast to draw. The counts always cover the whole text. */
export const MAX_SHOWN_TOKENS = 3000;

export const TOKEN_LOAD_FAILED = 'The tokenizer did not load. Check your connection, then reload the page. The box goes back to the sample.';

const DOWNLOAD = `(downloads about ${String(TOKENIZER_DOWNLOAD_MB)} MB)`;

export type TokenState = { readonly kind: 'idle' } | { readonly kind: 'loading' } | { readonly kind: 'failed' } | { readonly kind: 'ready'; readonly shown: boolean };

export function toggleLabel(state: TokenState): string {
  switch (state.kind) {
    case 'idle':
      return `Show tokens ${DOWNLOAD}`;
    case 'loading':
      return 'Loading the tokenizer';
    case 'failed':
      return 'Reload the page';
    case 'ready':
      // One label once loaded: aria-pressed says whether the tokens show.
      return 'Show tokens';
  }
}

type LiveFn = (value: JsonRoot, text: string) => LiveTokens;

// The server build sees `import.meta.env.SSR` as true and drops the import, so the worker never
// carries the 2.4 MB table. Only a click in the browser loads it, once: the component keeps the result.
function loadLive(): Promise<LiveFn> {
  return import.meta.env.SSR ? Promise.reject(new Error('the tokenizer loads only in the browser')) : import('../../lib/tokens.ts').then((module) => module.liveTokens);
}

/**
 * The pieces to draw, at most MAX_SHOWN_TOKENS, and a note when some were left out.
 * `total` is the pane's whole count. It is larger than `pieces` when the pane draws other
 * tokens in full first, such as the rules line, and the note counts those as drawn.
 */
export function shownPieces(pieces: readonly string[], total: number = pieces.length): { readonly pieces: readonly string[]; readonly note: string | null } {
  if (pieces.length <= MAX_SHOWN_TOKENS) return { pieces, note: null };
  const drawn = MAX_SHOWN_TOKENS + total - pieces.length;
  return { pieces: pieces.slice(0, MAX_SHOWN_TOKENS), note: `First ${formatCount(drawn)} of ${formatCount(total)} tokens shown.` };
}

/** One span per token, in two alternating shades. `offset` keeps the shades alternating across two runs. */
function Tokens({ pieces, offset = 0 }: { readonly pieces: readonly string[]; readonly offset?: number }) {
  return (
    <>
      {pieces.map((piece, index) => (
        // The pieces are fixed for one render and never reorder, so the index is a stable key.
        <span key={index} className={(index + offset) % 2 === 0 ? 'tk' : 'tk b'}>
          {piece}
        </span>
      ))}
    </>
  );
}

function Pane({ title, label, wrap, children, note }: { readonly title: string; readonly label: string; readonly wrap: boolean; readonly children: ReactNode; readonly note: string | null }) {
  return (
    <div className="code tokv-pane">
      <div className="code-h">
        <span className="fn">{title}</span>
      </div>
      <pre className={wrap ? 'out xs tokv-out wrap-pre' :'out xs tokv-out'} tabIndex={0} role="region" aria-label={label}>
        {children}
        {note === null ? null : <span className="tokv-cut">{note}</span>}
      </pre>
    </div>
  );
}

/** Both panes. Text with no table gets no rules line, so its pane names Terset alone. */
export function Panes({ live }: { readonly live: LiveTokens }) {
  const json = shownPieces(live.json.pieces, live.json.count);
  const text = shownPieces(live.terset.text, live.terset.count);
  const rules = live.terset.rules;
  const hasRules = rules.length > 0;
  return (
    <div className="pane2 tokv-panes">
      <Pane title={`Compact JSON, ${formatCount(live.json.count)} tokens`} label="Compact JSON split into tokens" wrap note={json.note}>
        <Tokens pieces={json.pieces} />
      </Pane>
      <Pane
        title={`${hasRules ? 'Terset with its rules line' : 'Terset'}, ${formatCount(live.terset.count)} tokens`}
        label={hasRules ? 'Terset and its rules line split into tokens' : 'Terset split into tokens'}
        wrap={false}
        note={text.note}
      >
        {hasRules ? (
          <span className="lgd">
            <Tokens pieces={rules} />
          </span>
        ) : null}
        <Tokens pieces={text.pieces} offset={rules.length} />
      </Pane>
    </div>
  );
}

// The note is a polite live region, so a screen reader hears the load start and the counts arrive.
function note(state: TokenState, live: LiveTokens | null, ok: boolean): ReactNode {
  if (state.kind === 'loading') return `Loading ${LIVE_TOKENIZER}, about ${String(TOKENIZER_DOWNLOAD_MB)} MB.`;
  if (state.kind !== 'ready' || !state.shown) return `Colors each token and counts your JSON live with ${LIVE_TOKENIZER}.`;
  if (!ok || live === null) return 'Token counts return when the JSON parses.';
  return <LiveCountNote live={live} />;
}

/** The live counts in one sentence. It names the rules line only when the text has one, like the pane title. */
export function LiveCountNote({ live }: { readonly live: LiveTokens }) {
  return (
    <>
      Live count, {LIVE_TOKENIZER} only: Terset <b>{formatCount(live.terset.count)}</b>
      {live.terset.rules.length > 0 ? ' with its rules line' : ''}, compact JSON <b>{formatCount(live.json.count)}</b>.
    </>
  );
}

export function TokenView({ result }: { readonly result: ConvertResult }) {
  const [count, setCount] = useState<LiveFn | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [shown, setShown] = useState(false);
  const state: TokenState = count === null ? { kind: phase } : { kind: 'ready', shown };
  const live = useMemo(() => (count !== null && shown && result.ok ? count(result.value, result.text) : null), [count, shown, result]);

  const onClick = (): void => {
    if (count !== null) {
      setShown((value) => !value);
      return;
    }
    if (phase === 'loading') return;
    if (phase === 'failed') {
      window.location.reload();
      return;
    }
    setPhase('loading');
    loadLive().then(
      (fn) => {
        setCount(() => fn);
        setShown(true);
      },
      () => {
        setPhase('failed');
      },
    );
  };

  return (
    <div className="tokv">
      <div className="card-actions tokv-bar">
        <p className="card-note" aria-live="polite">
          {note(state, live, result.ok)}
        </p>
        <button type="button" className="btn btn-line" aria-pressed={state.kind === 'failed' ? undefined : state.kind === 'ready' && state.shown} onClick={onClick}>
          {toggleLabel(state)}
        </button>
      </div>
      {state.kind === 'failed' ? (
        <p className="tokv-msg" role="alert">
          {TOKEN_LOAD_FAILED}
        </p>
      ) : null}
      {live === null ? null : <Panes live={live} />}
    </div>
  );
}
