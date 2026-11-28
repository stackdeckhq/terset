// The "Show tokens" toggle under the converter. The o200k_base table loads only on the
// first click, through a dynamic import, and the toggle says how big the download is
// before it starts. A failed load says so in plain words and can be tried again.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { convert } from '../../lib/convert.ts';
import { GENERATED } from '../../data/generated.ts';
import { liveTokens } from '../../lib/tokens.ts';
import { LiveCountNote, MAX_SHOWN_TOKENS, Panes, TOKENIZER_DOWNLOAD_MB, TOKEN_LOAD_FAILED, TokenView, shownPieces, toggleLabel, tokenNote } from './TokenView.tsx';

const SOURCE = readFileSync(new URL('./TokenView.tsx', import.meta.url), 'utf8');
const STEP_CONVERT = readFileSync(new URL('./StepConvert.tsx', import.meta.url), 'utf8');
const HOME_CSS = readFileSync(new URL('../../styles/home.css', import.meta.url), 'utf8');
const RANK_TABLE = new URL('../../../node_modules/gpt-tokenizer/esm/bpeRanks/o200k_base.js', import.meta.url);

function orders() {
  const result = convert(GENERATED.samples.orders.pretty);
  if (!result.ok) throw new Error('the orders sample should convert');
  return result;
}

describe('show tokens toggle', () => {
  it('states the download size the o200k_base rank table really has, gzipped', () => {
    const megabytes = gzipSync(readFileSync(RANK_TABLE)).length / 1_000_000;
    expect(Math.round(megabytes)).toBe(TOKENIZER_DOWNLOAD_MB);
  });

  // Once loaded, the label stays "Show tokens" and aria-pressed carries the state, so a screen reader
  // hears one toggle that is pressed or not, instead of a button that renames itself.
  it('says it downloads about that much before the table loads, then keeps one label for the toggle', () => {
    expect(toggleLabel({ kind: 'idle' })).toBe(`Show tokens (downloads about ${String(TOKENIZER_DOWNLOAD_MB)} MB)`);
    expect(toggleLabel({ kind: 'loading' })).toBe('Loading the tokenizer');
    expect(toggleLabel({ kind: 'failed' })).toBe('Reload the page');
    expect(toggleLabel({ kind: 'ready', shown: true })).toBe('Show tokens');
    expect(toggleLabel({ kind: 'ready', shown: false })).toBe('Show tokens');
  });

  it('renders the unpressed toggle on the server, with the size, a polite note and no token view', () => {
    const html = renderToStaticMarkup(createElement(TokenView, { result: orders() }));
    expect(html).toContain(`aria-pressed="false">Show tokens (downloads about ${String(TOKENIZER_DOWNLOAD_MB)} MB)</button>`);
    expect(html).toContain('<p class="card-note" aria-live="polite">');
    expect(html).not.toContain('class="tokv-pane');
  });

  it('draws the rules line and names it only when the text has one', () => {
    const withRules = renderToStaticMarkup(createElement(Panes, { live: liveTokens(orders().value, orders().text) }));
    expect(withRules).toContain('class="lgd"');
    expect(withRules).toMatch(/<span class="fn">Terset with its rules line, [\d,]+ tokens<\/span>/u);
    const config = convert(GENERATED.samples.config.pretty);
    if (!config.ok) throw new Error('the config sample should convert');
    const withPath = renderToStaticMarkup(createElement(Panes, { live: liveTokens(config.value, config.text) }));
    expect(withPath).toContain('class="lgd"');
    const flat = convert('{"name":"Ada"}');
    if (!flat.ok) throw new Error('the flat example should convert');
    const bare = renderToStaticMarkup(createElement(Panes, { live: liveTokens(flat.value, flat.text) }));
    expect(bare).not.toContain('class="lgd"');
    expect(bare).toMatch(/<span class="fn">Terset, [\d,]+ tokens<\/span>/u);
    expect(bare).toContain('aria-label="Terset split into tokens"');
    expect(renderToStaticMarkup(createElement(LiveCountNote, { live: liveTokens(orders().value, orders().text) }))).toMatch(/Terset <b>[\d,]+<\/b> with its rules line, compact JSON/u);
    expect(renderToStaticMarkup(createElement(LiveCountNote, { live: liveTokens(flat.value, flat.text) }))).toMatch(/: Terset <b>[\d,]+<\/b>, compact JSON/u);
  });

  it('loads the table through a dynamic import only, never a static one', () => {
    // A type-only import is erased at build time, so it never pulls the table in.
    expect(SOURCE).not.toMatch(/^import (?!type )[^;]*from '(?:gpt-tokenizer[^']*|\.\.\/\.\.\/lib\/tokens\.ts)';/mu);
    expect(SOURCE).toContain("import('../../lib/tokens.ts')");
    expect(STEP_CONVERT).toContain('<TokenView result={result} />');
  });

  // Chrome keeps a failed import() in its module map, so a second import() of the chunk fails
  // even when the network is back. Only a reload can try again, and the page says so.
  it('says a failed load in plain words, and offers a reload instead of a retry that cannot work', () => {
    expect(TOKEN_LOAD_FAILED).toBe('The tokenizer did not load. Check your connection, then reload the page. The box goes back to the sample.');
    expect(SOURCE).toContain('window.location.reload()');
    expect(SOURCE).not.toContain('createLoader');
  });

  it('caps the pieces drawn, and says how many of the total it drew', () => {
    const pieces = Array.from({ length: MAX_SHOWN_TOKENS + 5 }, (_, index) => String(index));
    const cut = shownPieces(pieces);
    expect(cut.pieces).toHaveLength(MAX_SHOWN_TOKENS);
    expect(cut.note).toBe(`First ${MAX_SHOWN_TOKENS.toLocaleString('en-US')} of ${(MAX_SHOWN_TOKENS + 5).toLocaleString('en-US')} tokens shown.`);
    expect(shownPieces(['a', 'b'])).toEqual({ pieces: ['a', 'b'], note: null });
  });

  // The Terset pane draws its 7 rules tokens in full before the capped text, so the note counts them in.
  it('counts tokens drawn before the pieces, such as the rules line, in the note', () => {
    const pieces = Array.from({ length: MAX_SHOWN_TOKENS + 5 }, (_, index) => String(index));
    const cut = shownPieces(pieces, MAX_SHOWN_TOKENS + 12);
    expect(cut.pieces).toHaveLength(MAX_SHOWN_TOKENS);
    expect(cut.note).toBe(`First ${(MAX_SHOWN_TOKENS + 7).toLocaleString('en-US')} of ${(MAX_SHOWN_TOKENS + 12).toLocaleString('en-US')} tokens shown.`);
  });

  // Pasted text has a live token count now, behind the toggle, so the bytes line points to it.
  it('points the live bytes line to Show tokens for a live count', () => {
    expect(STEP_CONVERT).toContain("{ key: 'bytes', node: `Live sizes are in bytes. Show tokens counts them with ${LIVE_TOKENIZER}.` }");
    expect(STEP_CONVERT).not.toContain('Live text has no token count');
  });

  // A refused number leaves valid JSON, so the notes wait for a conversion, not for the JSON to parse.
  it('says the counts return when the JSON converts, since a refused number has parsed', () => {
    expect(tokenNote({ kind: 'ready', shown: true }, null, false)).toBe('Token counts return when the JSON converts.');
    expect(STEP_CONVERT).toContain("{ key: 'invalid', node: 'Sizes return when the JSON converts.' }");
    expect(`${SOURCE}${STEP_CONVERT}`).not.toContain('when the JSON parses');
  });

  it('shows the toggle only when the boot script ran', () => {
    expect(HOME_CSS).toMatch(/html:not\(\.js\) \.tokv \{ display: none; \}/u);
  });
});
